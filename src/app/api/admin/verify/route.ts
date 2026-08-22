import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateAdminSessionToken } from '@/lib/domain';

export async function POST(req: NextRequest) {
  const client = await db.connect();
  try {
    const body = await req.json();
    const { streamId, passcode } = body;

    if (!streamId || !passcode) {
      return NextResponse.json(
        { success: false, error: 'Stream ID and Admin PIN are required' },
        { status: 400 }
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
      return NextResponse.json(
        { success: false, error: 'Invalid terminal stream ID' },
        { status: 404 }
      );
    }

    const expectedPasscode = res.rows[0].admin_passcode || '123456';

    if (passcode.trim() !== expectedPasscode.trim()) {
      return NextResponse.json(
        { success: false, error: 'Incorrect Admin Access PIN' },
        { status: 401 }
      );
    }

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
