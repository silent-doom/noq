import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { publishQueueUpdate } from '@/lib/ably';
import { checkRateLimit, recordRateLimitHit } from '@/lib/rateLimit';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  req: NextRequest,
  { params }: { params: { streamId: string } | Promise<{ streamId: string }> }
) {
  const forwarded = req.headers.get('x-forwarded-for');
  const clientIp = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';

  // Anti-flooding rate limit on walk-in registrations (max 30 per 5 mins per IP)
  const rateKey = `walkin:${clientIp}`;
  const rateCheck = await checkRateLimit(rateKey, 30, 5 * 60);

  if (!rateCheck.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many walk-in requests. Please wait a moment.' },
      { status: 429 }
    );
  }

  const client = await db.connect();
  try {
    const resolvedParams = await params;
    const { streamId } = resolvedParams;

    if (!streamId || typeof streamId !== 'string' || !UUID_REGEX.test(streamId.trim())) {
      return NextResponse.json({ success: false, error: 'Valid streamId UUID is required' }, { status: 400 });
    }

    const { customer_name, customer_phone } = await req.json();

    if (!customer_name || typeof customer_name !== 'string' || !customer_name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Customer name is required' },
        { status: 400 }
      );
    }

    if (!customer_phone || typeof customer_phone !== 'string' || !customer_phone.trim()) {
      return NextResponse.json(
        { success: false, error: 'Customer phone number is required' },
        { status: 400 }
      );
    }

    const sanitizedName = customer_name.trim().slice(0, 100);
    const sanitizedPhone = customer_phone.replace(/[^\d+]/g, '').slice(0, 20);

    await client.query('BEGIN');

    // Lock the stream row first to serialise concurrent walk-in inserts
    const streamCheck = await client.query(
      `SELECT id FROM queue_streams WHERE id = $1 FOR UPDATE`,
      [streamId.trim()]
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
      [streamId.trim()]
    );

    const nextTokenNum = Number(counterRes.rows[0].last_token_number);

    const insertRes = await client.query(
      `INSERT INTO tokens (stream_id, token_number, customer_name, customer_phone, status, access_channel)
       VALUES ($1, $2, $3, $4, 'WAITING', 'WALK_IN')
       RETURNING *`,
      [streamId.trim(), nextTokenNum, sanitizedName, sanitizedPhone]
    );

    const newToken = insertRes.rows[0];
    await client.query('COMMIT');
    await recordRateLimitHit(rateKey, 5 * 60);

    await publishQueueUpdate(streamId.trim(), 'TOKEN_ADDED', { token: newToken });

    return NextResponse.json({ success: true, token: newToken });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error creating walk-in token:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}