import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdminSessionToken } from '@/lib/domain';
import {
  ensureSlotTables,
  createAppointment,
  getAppointmentsForStream,
  updateAppointmentStatus,
  getAppointmentById,
} from '@/lib/slotBooking';
import { logApiError } from '@/lib/incidentLogger';

export const runtime = 'nodejs';

// POST /api/slots/appointments
// Public — customer books a slot
export async function POST(req: NextRequest) {
  const client = await db.connect();
  try {
    await ensureSlotTables(client);

    const body = await req.json();
    const { streamId, customerName, customerPhone, slotDate, slotTime } = body;

    if (!streamId || !customerName || !customerPhone || !slotDate || !slotTime) {
      return NextResponse.json(
        { success: false, error: 'streamId, customerName, customerPhone, slotDate, slotTime are all required' },
        { status: 400 }
      );
    }

    // Validate date is not in the past
    const requestedDate = new Date(slotDate + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (requestedDate < today) {
      return NextResponse.json({ success: false, error: 'Cannot book slots in the past' }, { status: 400 });
    }

    const appointment = await createAppointment(client, {
      streamId,
      customerName,
      customerPhone,
      slotDate,
      slotTime,
    });

    return NextResponse.json({
      success: true,
      message: 'Slot booked successfully! Your appointment confirmation is ready.',
      appointment,
      appointmentRef: appointment.appointment_ref,
      appointmentId: appointment.id,
    });
  } catch (error: any) {
    await logApiError(req, 'DATABASE', error);
    const isUserError =
      error.message?.includes('not enabled') ||
      error.message?.includes('fully booked') ||
      error.message?.includes('does not exist') ||
      error.message?.includes('past');
    return NextResponse.json(
      { success: false, error: error.message },
      { status: isUserError ? 400 : 500 }
    );
  } finally {
    client.release();
  }
}

// GET /api/slots/appointments?streamId=X&date=YYYY-MM-DD[&appointmentId=Y]
// Operator auth for stream listings, OR public lookup for single appointment by ID
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const appointmentId = searchParams.get('appointmentId');
  const streamId = searchParams.get('streamId');
  const date = searchParams.get('date');

  if (!appointmentId && !streamId) {
    return NextResponse.json({ success: false, error: 'streamId or appointmentId required' }, { status: 400 });
  }

  // Operator auth required for stream list queries
  if (!appointmentId && streamId) {
    const authHeader =
      req.headers.get('x-admin-token') || req.headers.get('authorization')?.replace('Bearer ', '');
    if (!verifyAdminSessionToken(authHeader, streamId)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  const client = await db.connect();
  try {
    await ensureSlotTables(client);

    if (appointmentId) {
      const appt = await getAppointmentById(client, appointmentId);
      if (!appt) {
        return NextResponse.json({ success: false, error: 'Appointment not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, appointment: appt });
    }

    const appointments = await getAppointmentsForStream(client, streamId!, date || undefined);
    return NextResponse.json({ success: true, appointments, count: appointments.length });
  } catch (error: any) {
    await logApiError(req, 'DATABASE', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// PATCH /api/slots/appointments — operator updates appointment status
export async function PATCH(req: NextRequest) {
  const client = await db.connect();
  try {
    await ensureSlotTables(client);

    const body = await req.json();
    const { appointmentId, status, streamId } = body;

    if (!appointmentId || !status || !streamId) {
      return NextResponse.json(
        { success: false, error: 'appointmentId, status, and streamId are required' },
        { status: 400 }
      );
    }
    if (!['CONFIRMED', 'CANCELLED', 'NO_SHOW'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'status must be CONFIRMED, CANCELLED, or NO_SHOW' },
        { status: 400 }
      );
    }

    const authHeader =
      req.headers.get('x-admin-token') || req.headers.get('authorization')?.replace('Bearer ', '');
    if (!verifyAdminSessionToken(authHeader, streamId)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const updated = await updateAppointmentStatus(client, appointmentId, status);
    return NextResponse.json({ success: true, appointment: updated });
  } catch (error: any) {
    await logApiError(req, 'DATABASE', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
