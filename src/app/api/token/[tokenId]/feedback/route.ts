import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: { tokenId: string } | Promise<{ tokenId: string }> }
) {
  const client = await db.connect();
  try {
    const resolvedParams = await Promise.resolve(params);
    const { tokenId } = resolvedParams;
    const body = await req.json();
    const { rating, comment } = body;

    const numRating = Number(rating);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      return NextResponse.json(
        { success: false, error: 'Rating must be an integer between 1 and 5' },
        { status: 400 }
      );
    }

    // Lookup token
    const tokenRes = await client.query(
      `SELECT stream_id FROM tokens WHERE id = $1`,
      [tokenId]
    );

    if (tokenRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Token not found' },
        { status: 404 }
      );
    }

    const streamId = tokenRes.rows[0].stream_id;

    // Check if feedback already submitted for this token
    const existingRes = await client.query(
      `SELECT id FROM feedbacks WHERE token_id = $1`,
      [tokenId]
    );

    if (existingRes.rows.length > 0) {
      // Update existing feedback
      await client.query(
        `UPDATE feedbacks SET rating = $1, comment = $2, created_at = NOW() WHERE token_id = $3`,
        [numRating, comment?.trim() || null, tokenId]
      );
    } else {
      // Insert new feedback
      await client.query(
        `INSERT INTO feedbacks (token_id, stream_id, rating, comment)
         VALUES ($1, $2, $3, $4)`,
        [tokenId, streamId, numRating, comment?.trim() || null]
      );
    }

    return NextResponse.json({ success: true, message: 'Thank you for your feedback!' });
  } catch (error: any) {
    console.error('Error submitting feedback:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to submit feedback' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
