import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { publishQueueUpdate } from '@/lib/ably';

export async function POST(
  req: NextRequest,
  { params }: { params: { streamId: string } }
) {
  const { streamId } = params;
  if (!streamId) {
    return NextResponse.json({ success: false, error: 'streamId is required' }, { status: 400 });
  }

  const client = await db.connect();
  try {
    const body = await req.json();
    const { stationName = 'Doctor Room 1', patientName = 'Emergency Patient', notes = 'Stat consultation' } = body;

    // Verify stream exists
    const streamRes = await client.query(
      `SELECT s.id, b.name AS business_name 
       FROM queue_streams s 
       JOIN businesses b ON s.business_id = b.id 
       WHERE s.id = $1`,
      [streamId]
    );

    if (streamRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Queue stream not found' }, { status: 404 });
    }

    const businessName = streamRes.rows[0].business_name;

    // Broadcast EMERGENCY_CALL across Ably real-time channel
    const emergencyPayload = {
      type: 'EMERGENCY_CALL',
      businessName,
      stationName,
      patientName,
      notes,
      triggeredAt: new Date().toISOString(),
    };

    // Non-blocking publish to display screens and passes
    publishQueueUpdate(streamId, 'EMERGENCY_CALL', emergencyPayload).catch((err) =>
      console.error('[Emergency Call Ably Error]:', err)
    );

    return NextResponse.json({
      success: true,
      message: `Emergency STAT alert broadcasted for ${stationName}.`,
      alert: emergencyPayload,
    });
  } catch (error: any) {
    console.error('Emergency trigger error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to dispatch emergency alert' }, { status: 500 });
  } finally {
    client.release();
  }
}
