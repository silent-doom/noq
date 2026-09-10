import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureSlotTables, getAvailableSlots } from '@/lib/slotBooking';
import { logApiError } from '@/lib/incidentLogger';

export const runtime = 'nodejs';

// GET /api/slots/available?streamId=X&date=YYYY-MM-DD
// Public — returns time slot availability for a given stream + date.
// Returns [] when slot_booking_enabled = false (safe for the UI to gate the tab).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const streamId = searchParams.get('streamId');
  const date = searchParams.get('date');

  if (!streamId || !date) {
    return NextResponse.json(
      { success: false, error: 'streamId and date (YYYY-MM-DD) are required' },
      { status: 400 }
    );
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { success: false, error: 'Invalid date format. Use YYYY-MM-DD' },
      { status: 400 }
    );
  }

  // Prevent booking more than 7 days ahead
  const requestedDate = new Date(date + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((requestedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return NextResponse.json(
      { success: false, error: 'Cannot book slots in the past' },
      { status: 400 }
    );
  }
  if (diffDays > 7) {
    return NextResponse.json(
      { success: false, error: 'Cannot book slots more than 7 days in advance' },
      { status: 400 }
    );
  }

  const client = await db.connect();
  try {
    await ensureSlotTables(client);
    const slots = await getAvailableSlots(client, streamId, date);
    return NextResponse.json({ success: true, date, slots, count: slots.length });
  } catch (error: any) {
    await logApiError(req, 'DATABASE', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
