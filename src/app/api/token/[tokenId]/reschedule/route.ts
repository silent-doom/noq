import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { publishQueueUpdate } from '@/lib/ably';

export async function POST(
  req: NextRequest,
  { params }: { params: { tokenId: string } | Promise<{ tokenId: string }> }
) {
  const client = await db.connect();
  try {
    const resolvedParams = await Promise.resolve(params);
    const { tokenId } = resolvedParams;
    const body = await req.json();
    const { action, requestedDate, requestedSlot, delayMinutes = 15 } = body;

    // 1. Patient Self-Cancellation
    if (action === 'CANCEL_SPOT') {
      const cancelRes = await client.query(
        `UPDATE tokens 
         SET status = 'CANCELLED', updated_at = NOW() 
         WHERE id = $1 
         RETURNING *`,
        [tokenId]
      );
      if (cancelRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Token not found' }, { status: 404 });
      }
      const cancelledToken = cancelRes.rows[0];
      await publishQueueUpdate(cancelledToken.stream_id, 'TOKEN_UPDATED', { token: cancelledToken });
      return NextResponse.json({
        success: true,
        message: 'Your spot has been cancelled successfully.',
        token: cancelledToken,
      });
    }

    // 2. Patient Running Late (Self-delay)
    if (action === 'RUNNING_LATE') {
      // Mark token as running late and move back in sequence by marking status or updating priority
      const lateRes = await client.query(
        `UPDATE tokens 
         SET reschedule_status = 'RUNNING_LATE',
             notes = COALESCE(notes || ' • ', '') || 'Patient running ~' || $2 || ' mins late',
             updated_at = NOW() 
         WHERE id = $1 
         RETURNING *`,
        [tokenId, delayMinutes]
      );

      if (lateRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Token not found' }, { status: 404 });
      }

      const lateToken = lateRes.rows[0];
      await publishQueueUpdate(lateToken.stream_id, 'TOKEN_UPDATED', { token: lateToken, action: 'RUNNING_LATE' });
      return NextResponse.json({
        success: true,
        message: `Noted! Staff notified that you are running ~${delayMinutes} mins late.`,
        token: lateToken,
      });
    }

    // 3. Future Slot Reschedule Request
    if (!requestedDate?.trim() || !requestedSlot?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Please specify an action (RUNNING_LATE / CANCEL_SPOT) or provide date and time slot.' },
        { status: 400 }
      );
    }

    await client.query('BEGIN');

    // Lock and update token
    const tokenRes = await client.query(
      `UPDATE tokens 
       SET reschedule_requested_date = $1, 
           reschedule_requested_slot = $2, 
           reschedule_status = 'PENDING',
           status = 'SKIPPED',
           updated_at = NOW() 
       WHERE id = $3 
       RETURNING *`,
      [requestedDate.trim(), requestedSlot.trim(), tokenId]
    );

    if (tokenRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Token not found' }, { status: 404 });
    }

    const updatedToken = tokenRes.rows[0];
    await client.query('COMMIT');

    // Publish real-time notification to stream channel
    await publishQueueUpdate(updatedToken.stream_id, 'RESCHEDULE_REQUESTED', { token: updatedToken });

    return NextResponse.json({
      success: true,
      message: 'Reschedule request submitted successfully. Pending admin approval.',
      token: updatedToken,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error submitting reschedule request:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
