import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notifyNowServing, notifyUpcomingTurn } from '@/lib/notifications';
import { publishQueueUpdate } from '@/lib/ably';

export async function POST(
  req: NextRequest,
  { params }: { params: { streamId: string } | Promise<{ streamId: string }> }
) {
  const client = await db.connect();
  try {
    const resolvedParams = await Promise.resolve(params);
    const { streamId } = resolvedParams;

    await client.query('BEGIN');

    // 1. Lock the stream row to serialise concurrent "Call Next" taps
    const streamCheck = await client.query(
      `SELECT id FROM queue_streams WHERE id = $1 FOR UPDATE`,
      [streamId]
    );

    if (streamCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Stream not found' }, { status: 404 });
    }

    // 2. Mark current SERVING tokens as COMPLETED (with timestamps)
    await client.query(
      `UPDATE tokens 
       SET status = 'COMPLETED', completed_serving_at = NOW(), updated_at = NOW() 
       WHERE stream_id = $1 AND status = 'SERVING'`,
      [streamId]
    );

    // 3. Fetch the next WAITING token (canonical order: token_number ASC)
    const nextTokenRes = await client.query(
      `SELECT * FROM tokens 
       WHERE stream_id = $1 AND status = 'WAITING' 
       ORDER BY token_number ASC 
       LIMIT 1
       FOR UPDATE`,
      [streamId]
    );

    if (nextTokenRes.rows.length === 0) {
      // Queue is now empty — clear stream state
      await client.query(
        `UPDATE queue_streams 
         SET current_serving_token = NULL, active_token_started_at = NULL, updated_at = NOW() 
         WHERE id = $1`,
        [streamId]
      );

      await client.query('COMMIT');
      await publishQueueUpdate(streamId, 'TOKEN_CALLED', { serving_token: null });
      return NextResponse.json({ success: true, message: 'Queue is now empty', serving_token: null });
    }

    const nextToken = nextTokenRes.rows[0];

    // 4. Set new token to SERVING
    const updatedTokenRes = await client.query(
      `UPDATE tokens 
       SET status = 'SERVING', started_serving_at = NOW(), updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [nextToken.id]
    );

    // 5. Update queue stream state
    await client.query(
      `UPDATE queue_streams 
       SET current_serving_token = $1, active_token_started_at = NOW(), updated_at = NOW() 
       WHERE id = $2`,
      [nextToken.token_number, streamId]
    );

    // 6. Peek at the upcoming token (2nd in line) for advance notification
    const upcomingTokenRes = await client.query(
      `SELECT * FROM tokens 
       WHERE stream_id = $1 AND status = 'WAITING' AND id != $2 
       ORDER BY token_number ASC LIMIT 1`,
      [streamId, nextToken.id]
    );

    await client.query('COMMIT');

    // Fire real-time Ably update
    await publishQueueUpdate(streamId, 'TOKEN_CALLED', { serving_token: updatedTokenRes.rows[0] });

    // 7. Fire async SMS notifications (non-blocking, after commit)
    if (nextToken.customer_phone) {
      notifyNowServing(nextToken.customer_name, nextToken.customer_phone, nextToken.token_number);
    }

    if (upcomingTokenRes.rows.length > 0) {
      const upcoming = upcomingTokenRes.rows[0];
      if (upcoming.customer_phone) {
        notifyUpcomingTurn(upcoming.customer_name, upcoming.customer_phone, upcoming.token_number, 2);
      }
    }

    return NextResponse.json({ success: true, serving_token: updatedTokenRes.rows[0] });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error advancing queue (stream/next):', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}