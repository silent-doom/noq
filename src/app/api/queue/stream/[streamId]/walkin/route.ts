import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { publishQueueUpdate } from '@/lib/ably';

export async function POST(
  req: NextRequest,
  { params }: { params: { streamId: string } | Promise<{ streamId: string }> }
) {
  const client = await db.connect();
  try {
    const resolvedParams = await params;
    const { streamId } = resolvedParams;
    const { customer_name, customer_phone } = await req.json();

    if (!customer_name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Customer name is required' },
        { status: 400 }
      );
    }

    if (!customer_phone?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Customer phone number is required' },
        { status: 400 }
      );
    }

    await client.query('BEGIN');

    // Lock the stream row first to serialise concurrent walk-in inserts
    const streamCheck = await client.query(
      `SELECT id FROM queue_streams WHERE id = $1 FOR UPDATE`,
      [streamId]
    );

    if (streamCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Queue stream not found' }, { status: 404 });
    }

    // Atomically increment the stream's daily token counter
    const counterRes = await client.query(
      `UPDATE queue_streams 
       SET last_token_number = last_token_number + 1, updated_at = NOW() 
       WHERE id = $1 
       RETURNING last_token_number`,
      [streamId]
    );

    const nextTokenNum = Number(counterRes.rows[0].last_token_number);
    const phoneVal = customer_phone.trim();

    const insertRes = await client.query(
      `INSERT INTO tokens (stream_id, token_number, customer_name, customer_phone, status, access_channel)
       VALUES ($1, $2, $3, $4, 'WAITING', 'WALK_IN')
       RETURNING *`,
      [streamId, nextTokenNum, customer_name.trim(), phoneVal]
    );

    const newToken = insertRes.rows[0];
    await client.query('COMMIT');

    await publishQueueUpdate(streamId, 'TOKEN_ADDED', { token: newToken });

    return NextResponse.json({ success: true, token: newToken });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error creating walk-in token:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}