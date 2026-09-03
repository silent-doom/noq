import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateAdminSessionToken } from '@/lib/domain';
import { checkRateLimit, recordRateLimitHit, clearRateLimit } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  const client = await db.connect();
  try {
    const body = await req.json();
    const { streamId, passcode } = body;

    const forwarded = req.headers.get('x-forwarded-for');
    const clientIp = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';

    if (!streamId || !passcode) {
      return NextResponse.json(
        { success: false, error: 'Stream ID and Admin PIN are required' },
        { status: 400 }
      );
    }

    const rateKey = `admin:verify:${clientIp}:${streamId}`;
    const rateCheck = await checkRateLimit(rateKey, 5, 15 * 60); // 5 attempts per 15 mins

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many incorrect PIN attempts. Terminal locked for 15 minutes to protect patient data.',
          locked: true,
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    // Verify passcode against stream's business
    const res = await client.query(
      `SELECT b.admin_passcode, b.name AS business_name
       FROM queue_streams s
       JOIN businesses b ON s.business_id = b.id
       WHERE s.id = $1`,
      [streamId]
    );

    if (res.rows.length === 0) {
      await recordRateLimitHit(rateKey, 15 * 60);
      return NextResponse.json(
        { success: false, error: 'Invalid terminal stream ID' },
        { status: 404 }
      );
    }

    const expectedPasscode = res.rows[0].admin_passcode || '123456';

    if (passcode.trim() !== expectedPasscode.trim()) {
      const failedCount = await recordRateLimitHit(rateKey, 15 * 60);
      const remaining = Math.max(0, 5 - failedCount);
      return NextResponse.json(
        {
          success: false,
          error: `Incorrect Admin Access PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before 15m lockout.`,
          remainingAttempts: remaining,
        },
        { status: 401 }
      );
    }

    // Success: clear rate limit attempts
    await clearRateLimit(rateKey);

    const sessionToken = generateAdminSessionToken(streamId, passcode.trim());

    return NextResponse.json({
      success: true,
      message: 'Authenticated successfully',
      businessName: res.rows[0].business_name,
      sessionToken,
    });
  } catch (error: any) {
    console.error('Admin Auth Verification Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal verification failure' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
