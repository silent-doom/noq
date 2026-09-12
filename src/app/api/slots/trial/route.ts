import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdminSessionToken } from '@/lib/domain';
import { ensureSlotTables, computeSlotAddonState, startSlotTrial } from '@/lib/slotBooking';
import { logApiError } from '@/lib/incidentLogger';

export const runtime = 'nodejs';

// POST /api/slots/trial
// Operator auth required — starts a 7-day free trial for slot booking add-on
export async function POST(req: NextRequest) {
  const client = await db.connect();
  try {
    await ensureSlotTables(client);

    const body = await req.json();
    const { streamId } = body;

    if (!streamId) {
      return NextResponse.json({ success: false, error: 'streamId is required' }, { status: 400 });
    }

    // Operator auth
    const authHeader =
      req.headers.get('x-admin-token') ||
      req.headers.get('authorization')?.replace('Bearer ', '');
    if (!verifyAdminSessionToken(authHeader, streamId)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve business
    const streamRes = await client.query(
      `SELECT qs.business_id, b.name, b.slot_booking_enabled, b.slot_addon_status, b.slot_addon_trial_started_at, b.slot_addon_trial_ends_at, b.slot_addon_next_billing
       FROM queue_streams qs
       JOIN businesses b ON qs.business_id = b.id
       WHERE qs.id = $1`,
      [streamId]
    );

    if (streamRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Stream not found' }, { status: 404 });
    }

    const biz = streamRes.rows[0];
    const currentState = computeSlotAddonState(biz);

    // If already active or currently in trial
    if (currentState.isEnabled) {
      return NextResponse.json({
        success: true,
        message: currentState.isTrial ? 'Free trial is already active' : 'Slot add-on is already active',
        slotAddon: currentState,
      });
    }

    // If business already consumed a trial previously
    if (biz.slot_addon_trial_started_at) {
      return NextResponse.json(
        {
          success: false,
          error: 'Your 7-day free trial has already been used. Please subscribe for ₹299/mo to continue.',
          slotAddon: currentState,
        },
        { status: 400 }
      );
    }

    // Start 7-day trial
    const newState = await startSlotTrial(client, biz.business_id, 7);

    return NextResponse.json({
      success: true,
      message: '🎉 7-Day Free Trial activated! Your customers can now book future slots.',
      slotAddon: newState,
    });
  } catch (error: any) {
    await logApiError(req, 'DATABASE', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
