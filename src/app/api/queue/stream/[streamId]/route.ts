import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { publishQueueUpdate } from '@/lib/ably';
import { verifyAdminSessionToken, maskPhoneNumber } from '@/lib/domain';

export async function GET(
  req: NextRequest,
  { params }: { params: { streamId: string } | Promise<{ streamId: string }> }
) {
  const client = await db.connect();
  try {
    // Safe params resolution for Next.js 14 & Next.js 15
    const resolvedParams = await Promise.resolve(params);
    const { streamId } = resolvedParams;

    const authHeader = req.headers.get('x-admin-token') || req.headers.get('authorization')?.replace('Bearer ', '');
    const isAdmin = verifyAdminSessionToken(authHeader, streamId);

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

    const safeTokens = tokensRes.rows.map((tok: any) => ({
      ...tok,
      customer_phone: isAdmin ? tok.customer_phone : (tok.customer_phone ? maskPhoneNumber(tok.customer_phone) : null),
    }));

    return NextResponse.json({
      success: true,
      stream: streamRes.rows[0],
      tokens: safeTokens,
      isAdmin,
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

    const { broadcast_message, opening_time, closing_time, operating_days, queue_structure, stations } = body;
    const rawPace =
      body.pace_per_patient_mins ??
      body.pace ??
      body.current_effective_time_mins;
    const paceVal = rawPace !== undefined && rawPace !== null && !isNaN(Number(rawPace)) ? Number(rawPace) : null;

    const setClauses: string[] = [];
    const paramsArray: any[] = [];

    if (broadcast_message !== undefined) {
      paramsArray.push(broadcast_message?.trim() || null);
      setClauses.push(`broadcast_message = $${paramsArray.length}`);
    }

    if (paceVal !== null && paceVal > 0) {
      paramsArray.push(paceVal);
      setClauses.push(`pace_per_patient_mins = $${paramsArray.length}`);
      paramsArray.push(paceVal);
      setClauses.push(`current_effective_time_mins = $${paramsArray.length}`);
    }

    if (opening_time) {
      paramsArray.push(opening_time.trim());
      setClauses.push(`opening_time = $${paramsArray.length}`);
    }

    if (closing_time) {
      paramsArray.push(closing_time.trim());
      setClauses.push(`closing_time = $${paramsArray.length}`);
    }

    if (operating_days && Array.isArray(operating_days)) {
      paramsArray.push(JSON.stringify(operating_days));
      setClauses.push(`operating_days = $${paramsArray.length}`);
    }

    if (queue_structure) {
      paramsArray.push(queue_structure);
      setClauses.push(`queue_structure = $${paramsArray.length}`);
    }

    if (stations && Array.isArray(stations)) {
      paramsArray.push(JSON.stringify(stations));
      setClauses.push(`stations = $${paramsArray.length}`);
    }

    if (setClauses.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid parameters provided to update stream' },
        { status: 400 }
      );
    }

    setClauses.push(`updated_at = NOW()`);
    paramsArray.push(streamId);

    const updateRes = await client.query(
      `UPDATE queue_streams 
       SET ${setClauses.join(', ')} 
       WHERE id = $${paramsArray.length} 
       RETURNING *`,
      paramsArray
    );

    if (updateRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Stream not found' },
        { status: 404 }
      );
    }

    const updatedStream = updateRes.rows[0];
    await publishQueueUpdate(streamId, 'STREAM_UPDATED', { stream: updatedStream });

    return NextResponse.json({ success: true, stream: updatedStream });
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