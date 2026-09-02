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

import { checkLoginRateLimit, recordFailedLoginAttempt, clearLoginAttempts } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  const client = await db.connect();
  try {
    const body = await req.json();
    const { username, password } = body;
    const identifier = (username || '').trim();
    const secret = (password || '').trim();

    if (!identifier || !secret) {
      return NextResponse.json(
        { success: false, error: 'Username or phone number, and PIN or password are required.' },
        { status: 400 }
      );
    }

    // Extract client IP for rate limiting
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || '127.0.0.1';

    // 1. Check brute force rate limit
    const rateCheck = await checkLoginRateLimit(identifier, clientIp);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many failed attempts. Login locked for ${Math.ceil(rateCheck.retryAfterSeconds / 60)} minutes to protect your account.`,
        },
        { status: 429 }
      );
    }

    // Ensure columns exist (safe migration)
    await client.query(`
      ALTER TABLE businesses
        ADD COLUMN IF NOT EXISTS username VARCHAR(100),
        ADD COLUMN IF NOT EXISTS password_hash TEXT,
        ADD COLUMN IF NOT EXISTS admin_passcode VARCHAR(20) DEFAULT '123456';
    `);

    // Clean phone number digits if entered as phone
    const cleanDigits = identifier.replace(/[^0-9]/g, '');
    const last10 = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : '';

    // Look up business by username, registered phone number, or QR slug
    const res = await client.query(
      `SELECT b.id, b.name, b.username, b.phone, b.password_hash, b.admin_passcode, qs.id AS stream_id
       FROM businesses b
       LEFT JOIN queue_streams qs ON qs.business_id = b.id
       WHERE LOWER(COALESCE(b.username, '')) = LOWER($1)
          OR ($2 <> '' AND b.phone LIKE '%' || $2)
          OR LOWER(COALESCE(b.qr_code_slug, '')) = LOWER($1)
       ORDER BY b.created_at DESC
       LIMIT 1`,
      [identifier, last10]
    );

    if (res.rows.length === 0) {
      const attempts = await recordFailedLoginAttempt(identifier, clientIp);
      const remaining = Math.max(0, 5 - attempts);
      const errorMsg = remaining > 0
        ? `No business found matching this username or phone. (${remaining} attempt${remaining === 1 ? '' : 's'} remaining)`
        : 'Too many failed login attempts. Terminal locked for 15 minutes.';
      return NextResponse.json(
        { success: false, error: errorMsg },
        { status: remaining > 0 ? 401 : 429 }
      );
    }

    const row = res.rows[0];
    let isValid = false;

    // 1. Verify hashed password if present
    if (row.password_hash) {
      isValid = await verifyPassword(secret, row.password_hash);
    }

    // 2. Also check 6-digit admin passcode / PIN (for doctors logging in with their PIN)
    if (!isValid && row.admin_passcode) {
      isValid = row.admin_passcode.trim() === secret;
    }

    if (!isValid) {
      const attempts = await recordFailedLoginAttempt(identifier, clientIp);
      const remaining = Math.max(0, 5 - attempts);
      const errorMsg = remaining > 0
        ? `Incorrect PIN or password. (${remaining} attempt${remaining === 1 ? '' : 's'} remaining)`
        : 'Too many failed login attempts. Terminal locked for 15 minutes.';
      return NextResponse.json(
        { success: false, error: errorMsg },
        { status: remaining > 0 ? 401 : 429 }
      );
    }

    // Authentication succeeded: clear rate limit counter
    await clearLoginAttempts(identifier, clientIp);

    const streamId = row.stream_id;
    const sessionToken = generateAdminSessionToken(streamId, secret);

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
