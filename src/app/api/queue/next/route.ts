import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notifyNowServing, notifyUpcomingTurn } from '@/lib/notifications';

export async function POST(req: NextRequest) {
  const client = await db.connect();
  try {
    const { streamId } = await req.json();

    if (!streamId) {
      return NextResponse.json({ error: 'streamId is required' }, { status: 400 });
    }

    await client.query('BEGIN');

    // 1. Mark currently serving token as COMPLETED
    await client.query(
      `UPDATE tokens 
       SET status = 'COMPLETED', updated_at = NOW() 
       WHERE stream_id = $1 AND status = 'SERVING'`,
      [streamId]
    );

    // 2. Find next WAITING token
    const nextTokenRes = await client.query(
      `SELECT * FROM tokens 
       WHERE stream_id = $1 AND status = 'WAITING' 
       ORDER BY token_number ASC LIMIT 1 
       FOR UPDATE`,
      [streamId]
    );

    if (nextTokenRes.rows.length === 0) {
      // Reset current serving token counter on stream
      await client.query(
        `UPDATE queue_streams SET current_serving_token = 0 WHERE id = $1`,
        [streamId]
      );
      await client.query('COMMIT');
      return NextResponse.json({ success: true, message: 'Queue is now empty', nowServing: null });
    }

    const nextToken = nextTokenRes.rows[0];

    // 3. Mark next token as SERVING
    await client.query(
      `UPDATE tokens 
       SET status = 'SERVING', updated_at = NOW() 
       WHERE id = $1`,
      [nextToken.id]
    );

    // 4. Update queue_stream current_serving_token
    await client.query(
      `UPDATE queue_streams 
       SET current_serving_token = $1 
       WHERE id = $2`,
      [nextToken.token_number, streamId]
    );

    // 5. Query upcoming token (2 spots away) to alert them in advance
    const upcomingTokenRes = await client.query(
      `SELECT * FROM tokens 
       WHERE stream_id = $1 AND status = 'WAITING' AND id != $2 
       ORDER BY token_number ASC LIMIT 1`,
      [streamId, nextToken.id]
    );

    await client.query('COMMIT');

    // 6. Trigger Asynchronous Notifications (non-blocking)
    if (nextToken.customer_phone) {
      notifyNowServing(nextToken.customer_name, nextToken.customer_phone, nextToken.token_number);
    }

    if (upcomingTokenRes.rows.length > 0) {
      const upcoming = upcomingTokenRes.rows[0];
      if (upcoming.customer_phone) {
        notifyUpcomingTurn(upcoming.customer_name, upcoming.customer_phone, upcoming.token_number, 2);
      }
    }

    return NextResponse.json({
      success: true,
      nowServing: nextToken,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error advancing queue:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  } finally {
    client.release();
  }
}