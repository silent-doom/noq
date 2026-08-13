import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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

    // Safe to read MAX now — stream row is locked
    const maxTokenRes = await client.query(
      `SELECT COALESCE(MAX(token_number), 0) AS max_token FROM tokens WHERE stream_id = $1`,
      [streamId]
    );

    const nextTokenNum = Number(maxTokenRes.rows[0].max_token) + 1;
    const phoneVal = customer_phone.trim();

    const insertRes = await client.query(
      `INSERT INTO tokens (stream_id, token_number, customer_name, customer_phone, status, access_channel)
       VALUES ($1, $2, $3, $4, 'WAITING', 'WALK_IN')
       RETURNING *`,
      [streamId, nextTokenNum, customer_name.trim(), phoneVal]
    );

    await client.query('COMMIT');

    return NextResponse.json({ success: true, token: insertRes.rows[0] });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error creating walk-in token:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}