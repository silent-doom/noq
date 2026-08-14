import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { publishQueueUpdate } from '@/lib/ably';
import { sendSMS } from '@/lib/notifications';
import { sendTokenPushNotification } from '@/lib/push';

export async function POST(
  req: NextRequest,
  { params }: { params: { tokenId: string } | Promise<{ tokenId: string }> }
) {
  const client = await db.connect();
  try {
    const resolvedParams = await Promise.resolve(params);
    const { tokenId } = resolvedParams;
    const body = await req.json();
    const { action } = body; // 'APPROVE' or 'REJECT'

    if (!action || (action !== 'APPROVE' && action !== 'REJECT')) {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Must be APPROVE or REJECT.' },
        { status: 400 }
      );
    }

    await client.query('BEGIN');

    // 1. Fetch original token
    const origRes = await client.query(
      `SELECT * FROM tokens WHERE id = $1 FOR UPDATE`,
      [tokenId]
    );

    if (origRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Token not found' }, { status: 404 });
    }

    const origToken = origRes.rows[0];

    if (action === 'REJECT') {
      await client.query(
        `UPDATE tokens SET reschedule_status = 'REJECTED', updated_at = NOW() WHERE id = $1`,
        [tokenId]
      );
      await client.query('COMMIT');
      await publishQueueUpdate(origToken.stream_id, 'RESCHEDULE_REJECTED', { tokenId });
      return NextResponse.json({ success: true, message: 'Reschedule request rejected.' });
    }

    // 2. Action === 'APPROVE': Generate New Token for requested date & slot
    const maxRes = await client.query(
      `SELECT COALESCE(MAX(token_number), 0) AS max_token FROM tokens WHERE stream_id = $1`,
      [origToken.stream_id]
    );
    const nextTokenNum = Number(maxRes.rows[0].max_token) + 1;

    const requestedDate = origToken.reschedule_requested_date || 'Tomorrow';
    const requestedSlot = origToken.reschedule_requested_slot || '10:00 AM';

    const newTokenRes = await client.query(
      `INSERT INTO tokens (stream_id, token_number, customer_name, customer_phone, status, access_channel, reschedule_status)
       VALUES ($1, $2, $3, $4, 'WAITING', 'RESCHEDULED', 'APPROVED')
       RETURNING *`,
      [origToken.stream_id, nextTokenNum, origToken.customer_name, origToken.customer_phone]
    );

    const newToken = newTokenRes.rows[0];

    // Mark original token as APPROVED
    await client.query(
      `UPDATE tokens SET reschedule_status = 'APPROVED', updated_at = NOW() WHERE id = $1`,
      [tokenId]
    );

    await client.query('COMMIT');

    // Fire Ably real-time event
    await publishQueueUpdate(origToken.stream_id, 'RESCHEDULE_APPROVED', {
      originalTokenId: tokenId,
      newToken,
    });

    // Send SMS & Push notification confirmation
    const msg = `Hi ${origToken.customer_name}! Your appointment reschedule request for ${requestedDate} at ${requestedSlot} has been APPROVED! Your new token is #${newToken.token_number}. - noQ`;
    if (origToken.customer_phone) {
      await sendSMS({ to: origToken.customer_phone, message: msg });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    sendTokenPushNotification({
      tokenId: newToken.id,
      title: `✅ Reschedule Approved! Token #${newToken.token_number}`,
      body: `Your appointment for ${requestedDate} at ${requestedSlot} is confirmed.`,
      url: `${appUrl}/t/${newToken.id}`,
    });

    return NextResponse.json({
      success: true,
      message: 'Reschedule request approved and new token issued.',
      newToken,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error approving reschedule:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
