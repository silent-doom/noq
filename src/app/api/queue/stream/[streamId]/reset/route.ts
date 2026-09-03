import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdminSessionToken } from '@/lib/domain';

/**
 * POST /api/queue/stream/[streamId]/reset
 *
 * Performs a daily queue reset for a given stream:
 * - Cancels all WAITING and SERVING tokens (archives them)
 * - Preserves SKIPPED (waitlisted) tokens
 * - Resets current_serving_token to 0
 * - Updates last_reset_date to today
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { streamId: string } | Promise<{ streamId: string }> }
) {
  const client = await db.connect();
  try {
    const resolvedParams = await Promise.resolve(params);
    const { streamId } = resolvedParams;

    // Operator Authentication Guard
    const authHeader = req.headers.get('x-admin-token') || req.headers.get('x-admin-session') || req.headers.get('authorization')?.replace('Bearer ', '');
    const superAdminHeader = req.headers.get('x-superadmin-key');
    const isValidAdmin = verifyAdminSessionToken(authHeader, streamId);
    const isValidSuperAdmin = Boolean(superAdminHeader && superAdminHeader === (process.env.SUPERADMIN_SECRET || 'noq-vault-9842-x7k9p-mstr'));

    if (!isValidAdmin && !isValidSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Operator session required to reset queue' },
        { status: 401 }
      );
    }

    // Ensure the last_reset_date column exists
    await client.query(`
      ALTER TABLE queue_streams
        ADD COLUMN IF NOT EXISTS last_reset_date DATE;
    `);

    // Fetch stream info
    const streamRes = await client.query(
      `SELECT id, opening_time, closing_time, last_reset_date
       FROM queue_streams
       WHERE id = $1`,
      [streamId]
    );

    if (streamRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Stream not found.' }, { status: 404 });
    }

    const stream = streamRes.rows[0];
    const now = new Date();

    // Reset window start: Fixed at 4:00 AM local time
    // This allows late-night businesses (open till 2-3 AM) to finish their day naturally,
    // and early-morning businesses to accept new bookings before they open.
    const resetWindowStart = new Date(now);
    resetWindowStart.setHours(4, 0, 0, 0);
    // Today's date string (YYYY-MM-DD) in local time
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const lastResetDate = stream.last_reset_date
      ? stream.last_reset_date instanceof Date
        ? stream.last_reset_date.toISOString().split('T')[0]
        : String(stream.last_reset_date).split('T')[0]
      : null;

    // Determine if reset is needed
    const isNewDay = lastResetDate !== todayStr;
    const isPastResetWindow = now >= resetWindowStart;

    if (!isNewDay) {
      return NextResponse.json({
        success: true,
        resetPerformed: false,
        message: 'Queue already reset for today.',
        lastResetDate,
      });
    }

    if (!isPastResetWindow) {
      return NextResponse.json({
        success: true,
        resetPerformed: false,
        message: `Reset window starts at ${resetWindowStart.toLocaleTimeString()} (4:00 AM fixed threshold). Too early to reset.`,
        resetWindowStart: resetWindowStart.toISOString(),
      });
    }

    // Perform the reset inside a transaction
    await client.query('BEGIN');

    // Cancel all WAITING and SERVING tokens
    const cancelRes = await client.query(
      `UPDATE tokens
       SET status = 'CANCELLED', updated_at = NOW()
       WHERE stream_id = $1
         AND status IN ('WAITING', 'SERVING')
       RETURNING id`,
      [streamId]
    );

    // Reset stream's current_serving_token counter and update last_reset_date
    await client.query(
      `UPDATE queue_streams
       SET current_serving_token = 0,
           last_token_number = 0,
           last_reset_date = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [streamId, todayStr]
    );

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      resetPerformed: true,
      cancelledCount: cancelRes.rowCount ?? 0,
      message: `Daily queue reset complete. ${cancelRes.rowCount} token(s) archived. Waitlisted (SKIPPED) tokens preserved.`,
      lastResetDate: todayStr,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Queue reset error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Queue reset failed.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
