import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkRateLimit, recordRateLimitHit } from '@/lib/rateLimit';

const VALID_CHANNELS = ['WALK_IN', 'PHYSICAL_QR', 'WEB_DIRECT', 'LINK', 'REMOTE'];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for');
  const clientIp = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';

  // Anti-Spam / Anti-DDoS rate limiting: max 20 tokens per 5 minutes per IP
  const rateKey = `token:issue:${clientIp}`;
  const rateCheck = await checkRateLimit(rateKey, 20, 5 * 60);

  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many token creation requests. Please wait a few moments before trying again.' },
      { status: 429 }
    );
  }

  const client = await db.connect();
  try {
    const body = await req.json();
    const { streamId, customerName, customerPhone, accessChannel } = body;

    if (!streamId || typeof streamId !== 'string' || !UUID_REGEX.test(streamId.trim())) {
      return NextResponse.json({ error: 'Valid streamId UUID is required' }, { status: 400 });
    }

    if (!customerName || typeof customerName !== 'string' || customerName.trim().length === 0) {
      return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
    }

    // Input sanitization & size limits
    const sanitizedName = customerName.trim().slice(0, 100);
    const sanitizedPhone = customerPhone && typeof customerPhone === 'string'
      ? customerPhone.replace(/[^\d+]/g, '').slice(0, 20)
      : '';

    const channel = VALID_CHANNELS.includes(accessChannel) 
      ? accessChannel 
      : 'WALK_IN';

    await client.query('BEGIN');

    // 1. Lock the parent queue stream row to serialize token issuance safely
    const streamCheck = await client.query(
      `SELECT id FROM queue_streams WHERE id = $1 FOR UPDATE`,
      [streamId.trim()]
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
      [streamId.trim()]
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
      [streamId.trim(), sanitizedName, sanitizedPhone, nextTokenNumber, channel]
    );

    await client.query('COMMIT');
    await recordRateLimitHit(rateKey, 5 * 60);

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