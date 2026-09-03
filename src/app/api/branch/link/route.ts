import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkRateLimit, recordRateLimitHit, clearRateLimit } from '@/lib/rateLimit';
import { verifyAdminSessionToken, maskPhoneNumber } from '@/lib/domain';

export async function GET(req: NextRequest) {
  const client = await db.connect();
  try {
    const { searchParams } = new URL(req.url);
    const streamId = searchParams.get('streamId');

    if (!streamId) {
      return NextResponse.json({ success: false, error: 'streamId is required' }, { status: 400 });
    }

    // Operator Authentication Guard
    const authHeader = req.headers.get('x-admin-token') || req.headers.get('x-admin-session') || req.headers.get('authorization')?.replace('Bearer ', '');
    const superAdminHeader = req.headers.get('x-superadmin-key');
    const isValidAdmin = verifyAdminSessionToken(authHeader, streamId);
    const isValidSuperAdmin = Boolean(superAdminHeader && superAdminHeader === (process.env.SUPERADMIN_SECRET || 'noq-vault-9842-x7k9p-mstr'));

    if (!isValidAdmin && !isValidSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Operator session required to view linked branches' },
        { status: 401 }
      );
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS branch_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        stream_a_id UUID NOT NULL,
        stream_b_id UUID NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE (stream_a_id, stream_b_id)
      );
    `);

    const res = await client.query(
      `SELECT 
        qs.id AS stream_id,
        qs.stream_name,
        b.name AS business_name,
        b.category,
        b.phone
       FROM branch_links bl
       JOIN queue_streams qs ON (bl.stream_b_id = qs.id)
       JOIN businesses b ON qs.business_id = b.id
       WHERE bl.stream_a_id = $1`,
      [streamId]
    );

    const safeBranches = res.rows.map((branch) => ({
      ...branch,
      phone: branch.phone ? maskPhoneNumber(branch.phone) : null,
    }));

    return NextResponse.json({
      success: true,
      branches: safeBranches,
    });
  } catch (error: any) {
    console.error('Error fetching linked branches:', error);
    return NextResponse.json({ success: false, error: 'Failed to retrieve linked branches' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const client = await db.connect();
  try {
    const body = await req.json();
    const { sourceStreamId, targetStreamId, targetPasscode } = body;

    if (!sourceStreamId || !targetStreamId || !targetPasscode) {
      return NextResponse.json(
        { success: false, error: 'sourceStreamId, targetStreamId, and targetPasscode are required' },
        { status: 400 }
      );
    }

    if (sourceStreamId === targetStreamId) {
      return NextResponse.json(
        { success: false, error: 'Cannot link a clinic to itself' },
        { status: 400 }
      );
    }

    const forwarded = req.headers.get('x-forwarded-for');
    const clientIp = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
    const rateKey = `branch:link:${clientIp}:${targetStreamId}`;

    const rateCheck = await checkRateLimit(rateKey, 5, 15 * 60);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many incorrect branch pairing attempts. Action locked for 15 minutes.' },
        { status: 429 }
      );
    }

    // 1. Verify target stream & target passcode
    const targetCheck = await client.query(
      `SELECT qs.id AS stream_id, qs.stream_name, b.id AS business_id, b.name AS business_name, b.admin_passcode
       FROM queue_streams qs
       JOIN businesses b ON qs.business_id = b.id
       WHERE qs.id = $1`,
      [targetStreamId]
    );

    if (targetCheck.rows.length === 0) {
      await recordRateLimitHit(rateKey, 15 * 60);
      return NextResponse.json(
        { success: false, error: 'Target branch / clinic stream ID not found' },
        { status: 404 }
      );
    }

    const targetBiz = targetCheck.rows[0];
    const expectedPasscode = targetBiz.admin_passcode || '123456';

    if (targetPasscode.trim() !== expectedPasscode.trim()) {
      const failedCount = await recordRateLimitHit(rateKey, 15 * 60);
      const remaining = Math.max(0, 5 - failedCount);
      return NextResponse.json(
        { success: false, error: `Incorrect Admin PIN for target branch. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` },
        { status: 401 }
      );
    }

    await clearRateLimit(rateKey);

    // 2. Ensure table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS branch_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        stream_a_id UUID NOT NULL,
        stream_b_id UUID NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE (stream_a_id, stream_b_id)
      );
    `);

    // 3. Insert bidirectional branch link
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO branch_links (stream_a_id, stream_b_id)
       VALUES ($1, $2)
       ON CONFLICT (stream_a_id, stream_b_id) DO NOTHING`,
      [sourceStreamId, targetStreamId]
    );

    await client.query(
      `INSERT INTO branch_links (stream_a_id, stream_b_id)
       VALUES ($1, $2)
       ON CONFLICT (stream_a_id, stream_b_id) DO NOTHING`,
      [targetStreamId, sourceStreamId]
    );

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: `Successfully linked with ${targetBiz.business_name} (${targetBiz.stream_name})`,
      branch: {
        stream_id: targetBiz.stream_id,
        business_name: targetBiz.business_name,
        stream_name: targetBiz.stream_name,
      },
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error linking branch:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
