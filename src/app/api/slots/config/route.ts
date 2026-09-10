import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdminSessionToken } from '@/lib/domain';
import {
  ensureSlotTables,
  getWorkingHoursForStream,
  upsertWorkingHours,
  deleteWorkingHoursForDay,
} from '@/lib/slotBooking';
import { logApiError } from '@/lib/incidentLogger';

export const runtime = 'nodejs';

// GET /api/slots/config?streamId=X
// Public — returns working hours config + slot_booking_enabled flag
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const streamId = searchParams.get('streamId');
  if (!streamId) {
    return NextResponse.json({ success: false, error: 'streamId required' }, { status: 400 });
  }

  const client = await db.connect();
  try {
    await ensureSlotTables(client);

    const streamRes = await client.query(
      `SELECT qs.id, qs.stream_name, b.slot_booking_enabled, b.slot_addon_next_billing, b.name AS business_name
       FROM queue_streams qs
       JOIN businesses b ON qs.business_id = b.id
       WHERE qs.id = $1`,
      [streamId]
    );
    if (streamRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Stream not found' }, { status: 404 });
    }

    const stream = streamRes.rows[0];
    const workingHours = await getWorkingHoursForStream(client, streamId);

    return NextResponse.json({
      success: true,
      slotBookingEnabled: Boolean(stream.slot_booking_enabled),
      slotAddonNextBilling: stream.slot_addon_next_billing,
      businessName: stream.business_name,
      workingHours,
    });
  } catch (error: any) {
    await logApiError(req, 'DATABASE', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// POST /api/slots/config
// Operator auth required — upsert working hours for a stream
export async function POST(req: NextRequest) {
  const client = await db.connect();
  try {
    await ensureSlotTables(client);

    const body = await req.json();
    const { streamId, dayOfWeek, openTime, closeTime, slotDurationMins = 30, maxPerSlot = 1 } = body;

    if (!streamId || dayOfWeek === undefined || !openTime || !closeTime) {
      return NextResponse.json(
        { success: false, error: 'streamId, dayOfWeek, openTime, closeTime are required' },
        { status: 400 }
      );
    }
    if (dayOfWeek < 0 || dayOfWeek > 6) {
      return NextResponse.json({ success: false, error: 'dayOfWeek must be 0–6' }, { status: 400 });
    }

    // Operator auth
    const authHeader =
      req.headers.get('x-admin-token') ||
      req.headers.get('authorization')?.replace('Bearer ', '');
    if (!verifyAdminSessionToken(authHeader, streamId)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve businessId
    const streamRes = await client.query(
      `SELECT business_id, slot_booking_enabled FROM queue_streams qs JOIN businesses b ON qs.business_id = b.id WHERE qs.id = $1`,
      [streamId]
    );
    if (streamRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Stream not found' }, { status: 404 });
    }
    if (!streamRes.rows[0].slot_booking_enabled) {
      return NextResponse.json(
        { success: false, error: 'Slot booking add-on is not enabled for this business' },
        { status: 403 }
      );
    }

    const row = await upsertWorkingHours(
      client,
      streamId,
      streamRes.rows[0].business_id,
      Number(dayOfWeek),
      openTime,
      closeTime,
      Number(slotDurationMins),
      Number(maxPerSlot)
    );

    return NextResponse.json({ success: true, workingHours: row });
  } catch (error: any) {
    await logApiError(req, 'DATABASE', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// DELETE /api/slots/config?streamId=X&dayOfWeek=N
// Operator auth required — deactivate a day's config
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const streamId = searchParams.get('streamId');
  const dayOfWeek = Number(searchParams.get('dayOfWeek'));

  if (!streamId || isNaN(dayOfWeek)) {
    return NextResponse.json(
      { success: false, error: 'streamId and dayOfWeek required' },
      { status: 400 }
    );
  }

  const authHeader =
    req.headers.get('x-admin-token') ||
    req.headers.get('authorization')?.replace('Bearer ', '');
  if (!verifyAdminSessionToken(authHeader, streamId)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const client = await db.connect();
  try {
    await ensureSlotTables(client);
    await deleteWorkingHoursForDay(client, streamId, dayOfWeek);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    await logApiError(req, 'DATABASE', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
