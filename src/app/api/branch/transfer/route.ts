import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { publishQueueUpdate } from '@/lib/ably';
import { sendTokenPushNotification } from '@/lib/push';
import { notifyUpcomingTurn } from '@/lib/notifications';
import { isValidPhoneNumber } from '@/lib/domain';

export async function POST(req: NextRequest) {
  const client = await db.connect();
  try {
    const body = await req.json();
    const { tokenId, targetStreamId, reason } = body;

    if (!tokenId || !targetStreamId) {
      return NextResponse.json(
        { success: false, error: 'tokenId and targetStreamId are required' },
        { status: 400 }
      );
    }

    await client.query('BEGIN');

    // 1. Fetch current token details
    const tokenRes = await client.query(
      `SELECT t.*, s.id AS source_stream_id, b.name AS source_biz_name
       FROM tokens t
       JOIN queue_streams s ON t.stream_id = s.id
       JOIN businesses b ON s.business_id = b.id
       WHERE t.id = $1
       FOR UPDATE`,
      [tokenId]
    );

    if (tokenRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Token not found' }, { status: 404 });
    }

    const currentToken = tokenRes.rows[0];
    const sourceStreamId = currentToken.stream_id;

    if (sourceStreamId === targetStreamId) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Token is already in this clinic queue' }, { status: 400 });
    }

    // 2. Fetch destination stream and business info
    const targetRes = await client.query(
      `SELECT s.id AS stream_id, s.stream_name, b.name AS business_name
       FROM queue_streams s
       JOIN businesses b ON s.business_id = b.id
       WHERE s.id = $1
       FOR UPDATE`,
      [targetStreamId]
    );

    if (targetRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Destination clinic stream not found' }, { status: 404 });
    }

    const targetStream = targetRes.rows[0];

    // 3. Allocate next token number in target stream
    const maxTokenRes = await client.query(
      `SELECT COALESCE(MAX(token_number), 0) AS max_token 
       FROM tokens 
       WHERE stream_id = $1`,
      [targetStreamId]
    );

    const newTokenNumber = Number(maxTokenRes.rows[0].max_token) + 1;

    // 4. Update token to target stream
    const updateRes = await client.query(
      `UPDATE tokens 
       SET stream_id = $1, token_number = $2, status = 'WAITING', assigned_station = NULL, updated_at = NOW() 
       WHERE id = $3 
       RETURNING *`,
      [targetStreamId, newTokenNumber, tokenId]
    );

    const transferredToken = updateRes.rows[0];

    await client.query('COMMIT');

    // 5. Publish real-time events to both source and target streams
    await publishQueueUpdate(sourceStreamId, 'TOKEN_TRANSFERRED', {
      tokenId,
      transferredTo: targetStream.business_name,
    });

    await publishQueueUpdate(targetStreamId, 'TOKEN_RECEIVED', {
      token: transferredToken,
      transferredFrom: currentToken.source_biz_name,
    });

    // 6. Push & SMS Notification to Patient
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    sendTokenPushNotification({
      tokenId,
      title: `🔄 Queue Transferred to ${targetStream.business_name}`,
      body: `Hi ${currentToken.customer_name}! Your pass has been moved to ${targetStream.business_name}. Your new token is #${newTokenNumber}.`,
      url: `${appUrl}/t/${tokenId}`,
    });

    if (currentToken.sms_opt_in && isValidPhoneNumber(currentToken.customer_phone)) {
      notifyUpcomingTurn(
        currentToken.customer_name,
        currentToken.customer_phone,
        newTokenNumber,
        3
      );
    }

    return NextResponse.json({
      success: true,
      message: `Patient transferred to ${targetStream.business_name} (New Token #${newTokenNumber})`,
      token: transferredToken,
      destination: targetStream,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error transferring token between branches:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
