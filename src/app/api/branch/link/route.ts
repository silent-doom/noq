import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const client = await db.connect();
  try {
    const { searchParams } = new URL(req.url);
    const streamId = searchParams.get('streamId');

    if (!streamId) {
      return NextResponse.json({ success: false, error: 'streamId is required' }, { status: 400 });
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

    return NextResponse.json({
      success: true,
      branches: res.rows,
    });
  } catch (error: any) {
    console.error('Error fetching linked branches:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
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

    // 1. Verify target stream & target passcode
    const targetCheck = await client.query(
      `SELECT qs.id AS stream_id, qs.stream_name, b.id AS business_id, b.name AS business_name, b.admin_passcode
       FROM queue_streams qs
       JOIN businesses b ON qs.business_id = b.id
       WHERE qs.id = $1`,
      [targetStreamId]
    );

    if (targetCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Target branch / clinic stream ID not found' },
        { status: 404 }
      );
    }

    const targetBiz = targetCheck.rows[0];
    const expectedPasscode = targetBiz.admin_passcode || '123456';

    if (targetPasscode.trim() !== expectedPasscode.trim()) {
      return NextResponse.json(
        { success: false, error: 'Incorrect Admin PIN for target branch' },
        { status: 401 }
      );
    }

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
