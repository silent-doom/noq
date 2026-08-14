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
    const { requestedDate, requestedSlot } = body;

    if (!requestedDate?.trim() || !requestedSlot?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Please provide both requested date and time slot.' },
        { status: 400 }
      );
    }

    await client.query('BEGIN');

    // Ensure reschedule columns exist
    await client.query(`
      ALTER TABLE tokens 
      ADD COLUMN IF NOT EXISTS reschedule_requested_date VARCHAR(30),
      ADD COLUMN IF NOT EXISTS reschedule_requested_slot VARCHAR(30),
      ADD COLUMN IF NOT EXISTS reschedule_status VARCHAR(20);
    `);

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
