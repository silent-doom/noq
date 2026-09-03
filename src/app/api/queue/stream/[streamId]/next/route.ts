import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notifyNowServing, notifyUpcomingTurn } from '@/lib/notifications';
import { publishQueueUpdate } from '@/lib/ably';
import { sendTokenPushNotification } from '@/lib/push';
import { isValidPhoneNumber, verifyAdminSessionToken } from '@/lib/domain';

export async function POST(
  req: NextRequest,
  { params }: { params: { streamId: string } | Promise<{ streamId: string }> }
) {
  const client = await db.connect();
  try {
    const resolvedParams = await Promise.resolve(params);
    const { streamId } = resolvedParams;

    // Operator Authentication Guard
    const authHeader = req.headers.get('x-admin-token') || req.headers.get('x-admin-session') || req.headers.get('authorization')?.replace('Bearer ', '');
    const superAdminHeader = req.headers.get('x-superadmin-key');
    const isValidAdmin = verifyAdminSessionToken(authHeader, streamId);
    const isValidSuperAdmin = Boolean(superAdminHeader && superAdminHeader === (process.env.SUPERADMIN_SECRET || 'noq-vault-9842-x7k9p-mstr'));

    if (!isValidAdmin && !isValidSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Operator session required to advance the queue' },
        { status: 401 }
      );
    }

    let counterName = 'Counter 1';
    try {
      const body = await req.json();
      if (body?.counter_name?.trim()) {
        counterName = body.counter_name.trim();
      }
    } catch (e) {}

    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE tokens 
      ADD COLUMN IF NOT EXISTS assigned_station VARCHAR(100);
    `);

    // 1. Lock the stream row to serialise concurrent "Call Next" taps
    const streamCheck = await client.query(
      `SELECT id FROM queue_streams WHERE id = $1 FOR UPDATE`,
      [streamId]
    );

    if (streamCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Stream not found' }, { status: 404 });
    }

    // 2. Advance the queue in a single optimized CTE (Common Table Expression) round-trip!
    // This completes the old token, grabs the next waiting token, updates its status, and updates the stream.
    const advanceRes = await client.query(
      `WITH completed AS (
         UPDATE tokens 
         SET status = 'COMPLETED', completed_serving_at = NOW(), updated_at = NOW() 
         WHERE stream_id = $1 AND status = 'SERVING' AND (assigned_station = $2 OR assigned_station IS NULL)
         RETURNING id
       ),
       next_waiting AS (
         SELECT id FROM tokens 
         WHERE stream_id = $1 AND status = 'WAITING' 
         ORDER BY token_number ASC LIMIT 1 FOR UPDATE
       ),
       updated_next AS (
         UPDATE tokens 
         SET status = 'SERVING', assigned_station = $2, started_serving_at = NOW(), updated_at = NOW() 
         WHERE id = (SELECT id FROM next_waiting)
         RETURNING *
       ),
       update_stream AS (
         UPDATE queue_streams 
         SET current_serving_token = (SELECT token_number FROM updated_next), active_token_started_at = NOW(), updated_at = NOW() 
         WHERE id = $1 AND EXISTS (SELECT 1 FROM updated_next)
       )
       SELECT * FROM updated_next`,
      [streamId, counterName]
    );

    if (advanceRes.rows.length === 0) {
      // Queue is now empty — clear stream state if no other station is serving
      const remainingServing = await client.query(
        `SELECT COUNT(*) FROM tokens WHERE stream_id = $1 AND status = 'SERVING'`,
        [streamId]
      );

      if (Number(remainingServing.rows[0].count) === 0) {
        await client.query(
          `UPDATE queue_streams 
           SET current_serving_token = NULL, active_token_started_at = NULL, updated_at = NOW() 
           WHERE id = $1`,
          [streamId]
        );
      }

      await client.query('COMMIT');
      
      // Fire non-blocking Ably update
      publishQueueUpdate(streamId, 'TOKEN_CALLED', { serving_token: null, counter_name: counterName });
      
      return NextResponse.json({ success: true, message: 'Queue is now empty', serving_token: null });
    }

    const nextToken = advanceRes.rows[0];
    const servingTokenPayload = {
      ...nextToken,
      assigned_station: counterName,
      counter_name: counterName,
    };

    // 3. Peek at the upcoming token (2nd in line) for advance notification
    const upcomingTokenRes = await client.query(
      `SELECT * FROM tokens 
       WHERE stream_id = $1 AND status = 'WAITING' AND id != $2 
       ORDER BY token_number ASC LIMIT 1`,
      [streamId, nextToken.id]
    );

    await client.query('COMMIT');

    // Fire real-time Ably update (Non-blocking so we don't lag the dashboard response)
    publishQueueUpdate(streamId, 'TOKEN_CALLED', { serving_token: servingTokenPayload });

    // Fire Lock-Screen Native Web Push Notification
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    sendTokenPushNotification({
      tokenId: nextToken.id,
      title: `🔔 YOUR TURN NOW! Token #${nextToken.token_number}`,
      body: `Hi ${nextToken.customer_name}! Your token is NOW SERVING at ${counterName}. Please proceed immediately.`,
      url: `${appUrl}/t/${nextToken.id}`,
    });

    // 7. Fire async SMS notifications (non-blocking, only if customer opted in with valid phone)
    if (nextToken.sms_opt_in && isValidPhoneNumber(nextToken.customer_phone)) {
      notifyNowServing(nextToken.customer_name, nextToken.customer_phone, nextToken.token_number);
    }

    if (upcomingTokenRes.rows.length > 0) {
      const upcoming = upcomingTokenRes.rows[0];
      if (upcoming.sms_opt_in && isValidPhoneNumber(upcoming.customer_phone)) {
        notifyUpcomingTurn(upcoming.customer_name, upcoming.customer_phone, upcoming.token_number, 2);
      }
    }

    return NextResponse.json({ success: true, serving_token: servingTokenPayload });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error advancing queue (stream/next):', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}