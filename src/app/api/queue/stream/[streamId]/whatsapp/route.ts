import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { publishQueueUpdate } from '@/lib/ably';

export async function POST(
  req: NextRequest,
  { params }: { params: { streamId: string } | Promise<{ streamId: string }> }
) {
  const client = await db.connect();
  try {
    const resolvedParams = await Promise.resolve(params);
    const { streamId } = resolvedParams;
    const body = await req.json();
    const { from_phone, customer_name } = body;

    if (!from_phone?.trim() || !customer_name?.trim()) {
      return NextResponse.json(
        {
          success: false,
          reply: 'Please provide your full name and valid phone number to book a token.',
        },
        { status: 400 }
      );
    }

    await client.query('BEGIN');

    // 1. Lock stream
    const streamCheck = await client.query(
      `SELECT qs.id, b.name AS business_name 
       FROM queue_streams qs 
       LEFT JOIN businesses b ON qs.business_id = b.id 
       WHERE qs.id = $1 FOR UPDATE`,
      [streamId]
    );

    if (streamCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { success: false, reply: 'Queue stream not found.' },
        { status: 404 }
      );
    }

    const businessName = streamCheck.rows[0].business_name || 'Clinic Queue';

    // 2. Read and increment max token
    const counterRes = await client.query(
      `UPDATE queue_streams 
       SET last_token_number = last_token_number + 1, updated_at = NOW() 
       WHERE id = $1 
       RETURNING last_token_number`,
      [streamId]
    );
    const nextTokenNum = Number(counterRes.rows[0].last_token_number);

    // 3. Insert Token
    const insertRes = await client.query(
      `INSERT INTO tokens (stream_id, token_number, customer_name, customer_phone, status, access_channel)
       VALUES ($1, $2, $3, $4, 'WAITING', 'REMOTE')
       RETURNING *`,
      [streamId, nextTokenNum, customer_name.trim(), from_phone.trim()]
    );

    const newToken = insertRes.rows[0];

    await client.query('COMMIT');

    await publishQueueUpdate(streamId, 'TOKEN_ADDED', { token: newToken });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const passUrl = `${appUrl}/t/${newToken.id}`;
    const replyText = `✅ *Reservation Confirmed!*\n\nHello ${customer_name.trim()},\nYour token for *${businessName}* is *#${newToken.token_number}*.\n\n📲 Track live queue position:\n${passUrl}`;

    return NextResponse.json({
      success: true,
      token: newToken,
      whatsappReply: replyText,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('WhatsApp Bot Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
