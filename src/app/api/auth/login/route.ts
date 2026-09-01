import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateAdminSessionToken } from '@/lib/domain';

// Simple bcrypt-style comparison using built-in crypto
// For production, swap in bcryptjs: npm install bcryptjs
async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  // We store passwords as: sha256(plain + salt) where stored = salt:hash
  // This avoids adding a new dependency while still being salted.
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const { createHash } = await import('crypto');
  const computed = createHash('sha256').update(plain + salt).digest('hex');
  return computed === hash;
}

export async function POST(req: NextRequest) {
  const client = await db.connect();
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username?.trim() || !password?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Username and password are required.' },
        { status: 400 }
      );
    }

    // Ensure columns exist (safe migration)
    await client.query(`
      ALTER TABLE businesses
        ADD COLUMN IF NOT EXISTS username VARCHAR(100),
        ADD COLUMN IF NOT EXISTS password_hash TEXT;
    `);

    // Look up business by username
    const res = await client.query(
      `SELECT b.id, b.name, b.username, b.password_hash, qs.id AS stream_id
       FROM businesses b
       LEFT JOIN queue_streams qs ON qs.business_id = b.id
       WHERE LOWER(b.username) = LOWER($1)
       ORDER BY qs.created_at DESC
       LIMIT 1`,
      [username.trim()]
    );

    if (res.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid username or password.' },
        { status: 401 }
      );
    }

    const row = res.rows[0];

    if (!row.password_hash) {
      return NextResponse.json(
        {
          success: false,
          error:
            'This account was created before the login system was introduced. Please contact support or use your Stream ID + Admin PIN to access your dashboard.',
        },
        { status: 403 }
      );
    }

    const valid = await verifyPassword(password, row.password_hash);
    if (!valid) {
      return NextResponse.json(
        { success: false, error: 'Invalid username or password.' },
        { status: 401 }
      );
    }

    const streamId = row.stream_id;
    const sessionToken = generateAdminSessionToken(streamId, password);

    return NextResponse.json({
      success: true,
      businessName: row.name,
      streamId,
      sessionToken,
      dashboardUrl: `/dashboard?streamId=${streamId}`,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
