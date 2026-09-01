import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const VALID_CHANNELS = ['WALK_IN', 'PHYSICAL_QR', 'WEB_DIRECT', 'LINK', 'REMOTE'];

export async function POST(req: NextRequest) {
  const client = await db.connect();
  try {
    const body = await req.json();
    const { streamId, customerName, customerPhone, accessChannel } = body;

    if (!streamId || !customerName) {
      return NextResponse.json(
        { error: 'streamId and customerName are required' },
        { status: 400 }
      );
    }

    const channel = VALID_CHANNELS.includes(accessChannel) 
      ? accessChannel 
      : 'WALK_IN';

    await client.query('BEGIN');

    // 1. Lock the parent queue stream row to serialize token issuance safely
    const streamCheck = await client.query(
      `SELECT id FROM queue_streams WHERE id = $1 FOR UPDATE`,
      [streamId]
    );

    if (streamCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Queue stream not found' }, { status: 404 });
    }

    // 2. Atomically increment the stream's daily token counter
    const counterRes = await client.query(
      `UPDATE queue_streams 
       SET last_token_number = last_token_number + 1, updated_at = NOW() 
       WHERE id = $1 
       RETURNING last_token_number`,
      [streamId]
    );

    const nextTokenNumber = Number(counterRes.rows[0].last_token_number);

    // 3. Insert new token
    const insertRes = await client.query(
      `INSERT INTO tokens (
        stream_id, customer_name, customer_phone, 
        token_number, status, access_channel
       ) 
       VALUES ($1, $2, $3, $4, 'WAITING', $5) 
       RETURNING *`,
      [streamId, customerName.trim(), customerPhone ? customerPhone.trim() : '', nextTokenNumber, channel]
    );

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      data: insertRes.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error issuing token:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  } finally {
    client.release();
  }
}