import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { tokenId: string } | Promise<{ tokenId: string }> }
) {
  const client = await db.connect();
  try {
    const resolvedParams = await params;
    const { tokenId } = resolvedParams;

    await client.query(`
      ALTER TABLE tokens 
      ADD COLUMN IF NOT EXISTS assigned_station VARCHAR(100);
    `);

    const tokenRes = await client.query(
      `SELECT 
        t.id,
        t.token_number,
        t.customer_name,
        t.customer_phone,
        t.status,
        t.assigned_station,
        t.stream_id,
        t.access_channel,
        t.created_at,
        t.reschedule_requested_date,
        t.reschedule_requested_slot,
        t.reschedule_status,
        t.sms_opt_in,
        s.current_serving_token,
        s.current_effective_time_mins,
        s.pace_per_patient_mins,
        s.active_token_started_at,
        s.broadcast_message,
        s.opening_time,
        s.closing_time,
        s.operating_days,
        COALESCE(s.google_maps_url, b.google_maps_url) AS google_maps_url,
        b.name AS business_name,
        b.category
       FROM tokens t
       JOIN queue_streams s ON t.stream_id = s.id
       LEFT JOIN businesses b ON s.business_id = b.id
       WHERE t.id = $1`,
      [tokenId]
    );

    if (tokenRes.rows.length === 0) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    const token = tokenRes.rows[0];

    // Fix #5: Count spots ahead by token_number ordering (consistent with how
    // the queue advances), not by created_at (which diverges for re-inserted guests).
    const aheadRes = await client.query(
      `SELECT COUNT(*) AS spots_ahead
       FROM tokens
       WHERE stream_id = $1 
         AND status IN ('SERVING', 'WAITING') 
         AND token_number < $2`,
      [token.stream_id, token.token_number]
    );

    const spotsAhead = Number(aheadRes.rows[0]?.spots_ahead || 0);

    const basePaceMins = Number(
      token.pace_per_patient_mins || token.current_effective_time_mins || 10
    );
    let dynamicWaitMins = spotsAhead * basePaceMins;
    let delayStatus = 'ON_TIME';
    let delayMins = 0;

    if (token.active_token_started_at && spotsAhead > 0) {
      const startTime = new Date(token.active_token_started_at).getTime();
      const currentTime = Date.now();
      const elapsedMins = Math.floor((currentTime - startTime) / 60000);

      if (elapsedMins > basePaceMins) {
        delayMins = elapsedMins - basePaceMins;
        delayStatus = 'DELAYED';
        dynamicWaitMins = (spotsAhead - 1) * basePaceMins + 1 + delayMins;
      } else {
        const remainingForCurrent = Math.max(1, basePaceMins - elapsedMins);
        dynamicWaitMins = (spotsAhead - 1) * basePaceMins + remainingForCurrent;
      }
    }

    // Build ETA range per spec:
    // < 15 min → narrow ±2 min band; > 30 min → wider ±7 min band
    const clampedWait = Math.max(1, dynamicWaitMins);
    const bandHalf = clampedWait < 15 ? 2 : 7;
    const estWaitMin = Math.max(1, clampedWait - bandHalf);
    const estWaitMax = clampedWait + bandHalf;

    let waitlistPosition = 0;
    if (token.status === 'SKIPPED') {
      const waitlistPosRes = await client.query(
        `SELECT COUNT(*) AS pos
         FROM tokens
         WHERE stream_id = $1 
           AND status = 'SKIPPED' 
           AND token_number <= $2`,
        [token.stream_id, token.token_number]
      );
      waitlistPosition = Number(waitlistPosRes.rows[0]?.pos || 0);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: token.id,
        token_number: Number(token.token_number),
        customer_name: token.customer_name,
        customer_phone: token.customer_phone,
        status: token.status,
        assigned_station: token.assigned_station || null,
        access_channel: token.access_channel || 'WALK_IN',
        stream_id: token.stream_id,
        business_name: token.business_name || 'Clinic Queue',
        category: token.category || 'general',
        broadcast_message: token.broadcast_message || null,
        current_serving_token: Number(token.current_serving_token || 0),
        spots_ahead: spotsAhead,
        est_wait_mins: clampedWait,
        est_wait_min: estWaitMin,
        est_wait_max: estWaitMax,
        pace_per_patient_mins: basePaceMins,
        delay_status: delayStatus,
        delay_mins: delayMins,
        waitlist_position: waitlistPosition,
        reschedule_requested_date: token.reschedule_requested_date || null,
        reschedule_requested_slot: token.reschedule_requested_slot || null,
        reschedule_status: token.reschedule_status || null,
        sms_opt_in: Boolean(token.sms_opt_in),
        opening_time: token.opening_time || null,
        closing_time: token.closing_time || null,
        google_maps_url: token.google_maps_url || null,
      },
    });
  } catch (error: any) {
    console.error('Error fetching token pass:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { tokenId: string } | Promise<{ tokenId: string }> }
) {
  const client = await db.connect();
  try {
    const resolvedParams = await params;
    const { tokenId } = resolvedParams;
    const body = await req.json();
    const { status, fair_priority, customerPhone, smsOptIn } = body;

    await client.query('BEGIN');

    // Handle SMS opt-in / phone number update
    if ((customerPhone || typeof smsOptIn === 'boolean') && !status) {
      const optRes = await client.query(
        `UPDATE tokens 
         SET customer_phone = COALESCE($1, customer_phone),
             sms_opt_in = COALESCE($2, sms_opt_in),
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [customerPhone?.trim() || null, typeof smsOptIn === 'boolean' ? smsOptIn : true, tokenId]
      );
      await client.query('COMMIT');
      return NextResponse.json({ success: true, data: optRes.rows[0], token: optRes.rows[0] });
    }

    const tokenRes = await client.query(`SELECT * FROM tokens WHERE id = $1 FOR UPDATE`, [tokenId]);

    if (tokenRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    const currentToken = tokenRes.rows[0];
    const streamId = currentToken.stream_id;

    // --- 1. FAIR RE-INSERTION (From Waitlist back to Main Queue) ---
    if (fair_priority && status === 'WAITING') {
      // Guard: only SKIPPED tokens may be re-inserted
      if (currentToken.status !== 'SKIPPED') {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: `Cannot re-insert a token with status '${currentToken.status}'` },
          { status: 422 }
        );
      }

      const waitingRes = await client.query(
        `SELECT id, token_number FROM tokens 
         WHERE stream_id = $1 AND status = 'WAITING' 
         ORDER BY token_number ASC`,
        [streamId]
      );

      const waitingTokens = waitingRes.rows;

      // Place re-inserted token at position 3 (2 spots behind current serving),
      // achieved by assigning a token_number midpoint between the 2nd and 3rd
      // waiting tokens. If fewer than 3 waiting, append after the last one.
      let newTokenNumber: number;

      if (waitingTokens.length === 0) {
        // No one waiting — get max token_number and go after it
        const maxRes = await client.query(
          `SELECT COALESCE(MAX(token_number), 0) AS max_tok FROM tokens WHERE stream_id = $1`,
          [streamId]
        );
        newTokenNumber = Number(maxRes.rows[0].max_tok) + 1;
      } else if (waitingTokens.length === 1) {
        newTokenNumber = Number(waitingTokens[0].token_number) + 1;
      } else if (waitingTokens.length === 2) {
        newTokenNumber = Number(waitingTokens[1].token_number) + 1;
      } else {
        // Midpoint between 2nd and 3rd entries (fractional → round down)
        const t2 = Number(waitingTokens[1].token_number);
        const t3 = Number(waitingTokens[2].token_number);
        // If they're consecutive, bump everything after and insert between them
        if (t3 - t2 <= 1) {
          // Shift all tokens from position 3 onwards up by 1 to make room
          await client.query(
            `UPDATE tokens 
             SET token_number = token_number + 1 
             WHERE stream_id = $1 AND status = 'WAITING' AND token_number >= $2`,
            [streamId, t3]
          );
          newTokenNumber = t2 + 1;
        } else {
          newTokenNumber = Math.floor((t2 + t3) / 2);
        }
      }

      // Fix #1: Corrected SQL — single SET clause with proper column assignments
      const fairUpdateRes = await client.query(
        `UPDATE tokens 
         SET status = 'WAITING', token_number = $1, updated_at = NOW()
         WHERE id = $2 
         RETURNING *`,
        [newTokenNumber, tokenId]
      );

      await client.query('COMMIT');
      return NextResponse.json({ success: true, data: fairUpdateRes.rows[0] });
    }

    // --- 2. REGULAR STATUS UPDATE (SERVING, SKIPPED, COMPLETED, CANCELLED) ---
    const assignedStationVal = body.assigned_station || body.counter_name || null;
    let query = `UPDATE tokens SET status = $1, updated_at = NOW()`;
    const paramsArray: any[] = [status];

    if (assignedStationVal) {
      paramsArray.push(assignedStationVal);
      query += `, assigned_station = $${paramsArray.length}`;
    }

    if (status === 'SERVING') {
      query += `, started_serving_at = NOW()`;
    } else if (status === 'COMPLETED') {
      query += `, completed_serving_at = NOW()`;
    }

    paramsArray.push(tokenId);
    query += ` WHERE id = $${paramsArray.length} RETURNING *`;

    const updateRes = await client.query(query, paramsArray);
    const updatedToken = updateRes.rows[0];

    // --- 3. STREAM SYNC: Update Stream Active State ---
    if (status === 'SERVING') {
      await client.query(
        `UPDATE queue_streams 
         SET current_serving_token = $1, active_token_started_at = NOW(), updated_at = NOW() 
         WHERE id = $2`,
        [updatedToken.token_number, streamId]
      );
    } else if (status === 'SKIPPED' || status === 'COMPLETED' || status === 'CANCELLED') {
      // Only clear stream state if this was the actively serving token (or if matches token_number)
      await client.query(
        `UPDATE queue_streams 
         SET current_serving_token = NULL, active_token_started_at = NULL, updated_at = NOW() 
         WHERE id = $1 AND (current_serving_token = $2 OR current_serving_token IS NOT NULL)`,
        [streamId, updatedToken.token_number]
      );
    }

    await client.query('COMMIT');
    return NextResponse.json({ success: true, data: updatedToken });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error updating token status:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}