import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const client = await db.connect();

  try {
    const body = await req.json();
    const { streamId, tokenId } = body;

    if (!streamId) {
      return NextResponse.json(
        { success: false, error: 'streamId is required' },
        { status: 400 }
      );
    }

    await client.query('BEGIN');

    // Lock stream row to prevent concurrent skip/next conflicts
    const streamCheck = await client.query(
      `SELECT id FROM queue_streams WHERE id = $1 FOR UPDATE`,
      [streamId]
    );

    if (streamCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Stream not found' }, { status: 404 });
    }

    // STEP 1: Resolve which token to skip and read its current status
    let skippedTokenStatus: string | null = null;

    if (tokenId) {
      // Skip a specific token (could be WAITING or SERVING)
      const tokenLookup = await client.query(
        `SELECT status FROM tokens WHERE id = $1 FOR UPDATE`,
        [tokenId]
      );

      if (tokenLookup.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ success: false, error: 'Token not found' }, { status: 404 });
      }

      skippedTokenStatus = tokenLookup.rows[0].status;

      await client.query(
        `UPDATE tokens 
         SET status = 'SKIPPED', updated_at = NOW() 
         WHERE id = $1`,
        [tokenId]
      );
    } else {
      // Skip the currently SERVING token
      const servingLookup = await client.query(
        `SELECT id, status FROM tokens 
         WHERE stream_id = $1 AND status = 'SERVING' 
         LIMIT 1 FOR UPDATE`,
        [streamId]
      );

      if (servingLookup.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { success: false, error: 'No token is currently being served' },
          { status: 404 }
        );
      }

      skippedTokenStatus = 'SERVING';

      await client.query(
        `UPDATE tokens 
         SET status = 'SKIPPED', updated_at = NOW() 
         WHERE stream_id = $1 AND status = 'SERVING'`,
        [streamId]
      );
    }

    // STEP 2: Only auto-promote the next WAITING token when the skipped token
    // was SERVING. If it was WAITING (moved to waitlist by operator), the
    // currently serving session is still in progress — leave it untouched.
    let nextServingToken = null;

    if (skippedTokenStatus === 'SERVING') {
      const nextTokenRes = await client.query(
        `SELECT * FROM tokens 
         WHERE stream_id = $1 AND status = 'WAITING' 
         ORDER BY token_number ASC 
         LIMIT 1
         FOR UPDATE`,
        [streamId]
      );

      if (nextTokenRes.rows.length > 0) {
        const promotedRes = await client.query(
          `UPDATE tokens 
           SET status = 'SERVING', started_serving_at = NOW(), updated_at = NOW() 
           WHERE id = $1
           RETURNING *`,
          [nextTokenRes.rows[0].id]
        );
        nextServingToken = promotedRes.rows[0];

        await client.query(
          `UPDATE queue_streams 
           SET current_serving_token = $1, active_token_started_at = NOW(), updated_at = NOW() 
           WHERE id = $2`,
          [nextServingToken.token_number, streamId]
        );
      } else {
        // No more waiting tokens — clear stream active state
        await client.query(
          `UPDATE queue_streams 
           SET current_serving_token = NULL, active_token_started_at = NULL, updated_at = NOW() 
           WHERE id = $1`,
          [streamId]
        );
      }
    }
    // If a WAITING token was moved to waitlist, the stream state stays as-is.

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: skippedTokenStatus === 'SERVING'
        ? 'Serving token skipped, next guest promoted'
        : 'Guest moved to waitlist',
      nowServing: nextServingToken,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error skipping token:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to skip token' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}