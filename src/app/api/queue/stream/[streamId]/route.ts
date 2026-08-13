import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { streamId: string } | Promise<{ streamId: string }> }
) {
  const client = await db.connect();
  try {
    // Safe params resolution for Next.js 14 & Next.js 15
    const resolvedParams = await Promise.resolve(params);
    const { streamId } = resolvedParams;

    // Fetch stream with parent business name and category
    const streamRes = await client.query(
      `SELECT qs.*, b.name AS business_name, b.category 
       FROM queue_streams qs 
       LEFT JOIN businesses b ON qs.business_id = b.id 
       WHERE qs.id = $1`,
      [streamId]
    );

    if (streamRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Queue stream not found' },
        { status: 404 }
      );
    }

    // Fetch ALL tokens (SERVING, WAITING, SKIPPED) ordered by token_number ASC
    const tokensRes = await client.query(
      `SELECT * FROM tokens 
       WHERE stream_id = $1 
       ORDER BY token_number ASC, created_at ASC`,
      [streamId]
    );

    return NextResponse.json({
      success: true,
      stream: streamRes.rows[0],
      tokens: tokensRes.rows,
    });
  } catch (error: any) {
    console.error('Error fetching stream:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { streamId: string } | Promise<{ streamId: string }> }
) {
  const client = await db.connect();
  try {
    const resolvedParams = await Promise.resolve(params);
    const { streamId } = resolvedParams;
    const body = await req.json();

    const { broadcast_message } = body;
    const rawPace =
      body.pace_per_patient_mins ??
      body.pace ??
      body.current_effective_time_mins;
    const paceVal = rawPace !== undefined ? Number(rawPace) : null;

    let updateRes;

    if (broadcast_message !== undefined && paceVal !== null && !isNaN(paceVal) && paceVal > 0) {
      updateRes = await client.query(
        `UPDATE queue_streams 
         SET broadcast_message = $1, pace_per_patient_mins = $2, current_effective_time_mins = $3, updated_at = NOW() 
         WHERE id = $4 
         RETURNING *`,
        [broadcast_message?.trim() || null, paceVal, paceVal, streamId]
      );
    } else if (broadcast_message !== undefined) {
      updateRes = await client.query(
        `UPDATE queue_streams 
         SET broadcast_message = $1, updated_at = NOW() 
         WHERE id = $2 
         RETURNING *`,
        [broadcast_message?.trim() || null, streamId]
      );
    } else if (paceVal !== null && !isNaN(paceVal) && paceVal > 0) {
      updateRes = await client.query(
        `UPDATE queue_streams 
         SET pace_per_patient_mins = $1, current_effective_time_mins = $2, updated_at = NOW() 
         WHERE id = $3 
         RETURNING *`,
        [paceVal, paceVal, streamId]
      );
    } else {
      return NextResponse.json(
        { success: false, error: 'No valid parameters provided to update stream' },
        { status: 400 }
      );
    }

    if (updateRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Stream not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, stream: updateRes.rows[0] });
  } catch (error: any) {
    console.error('Error updating queue stream pace:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}