import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateDomainStations } from '@/lib/domain';
import { ensureSubscriptionTables, calculateNextBillingDate } from '@/lib/subscription';

// Salt + SHA-256 password hashing (no external deps)
async function hashPassword(plain: string): Promise<string> {
  const { createHash, randomBytes } = await import('crypto');
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(plain + salt).digest('hex');
  return `${salt}:${hash}`;
}

export async function POST(req: NextRequest) {
  const client = await db.connect();
  try {
    const body = await req.json();
    const {
      username,
      password,
      name,
      category,
      phone,
      googleMapsUrl,
      adminPasscode,
      baseServiceTimeMins,
      maxDailyCapacity,
      openingTime,
      closingTime,
      operatingDays,
      queueStructure,
      isFreeTrial,
      initialPaymentAmount,
      stationCounts,
      stations,
    } = body;

    // Validations
    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: 'Business name is required.' }, { status: 400 });
    }
    if (!username?.trim()) {
      return NextResponse.json({ success: false, error: 'Username is required.' }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ success: false, error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    // Ensure columns exist (safe migration)
    await client.query(`
      ALTER TABLE businesses
        ADD COLUMN IF NOT EXISTS username VARCHAR(100),
        ADD COLUMN IF NOT EXISTS password_hash TEXT,
        ADD COLUMN IF NOT EXISTS google_maps_url TEXT;
      ALTER TABLE queue_streams
        ADD COLUMN IF NOT EXISTS stations JSONB,
        ADD COLUMN IF NOT EXISTS operating_days JSONB,
        ADD COLUMN IF NOT EXISTS opening_time VARCHAR(10),
        ADD COLUMN IF NOT EXISTS closing_time VARCHAR(10),
        ADD COLUMN IF NOT EXISTS queue_structure VARCHAR(50),
        ADD COLUMN IF NOT EXISTS google_maps_url TEXT,
        ADD COLUMN IF NOT EXISTS last_reset_date DATE,
        ADD COLUMN IF NOT EXISTS last_token_number INTEGER DEFAULT 0;
    `);

    // Check username uniqueness
    const existingUser = await client.query(
      'SELECT id FROM businesses WHERE LOWER(username) = LOWER($1)',
      [username.trim()]
    );
    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'That username is already taken. Please choose another.' },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const passcodeVal = adminPasscode?.trim() || '123456';
    const opDays = Array.isArray(operatingDays) && operatingDays.length > 0
      ? operatingDays
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const openVal = openingTime?.trim() || '09:00';
    const closeVal = closingTime?.trim() || '20:00';
    const qStruct = queueStructure === 'DEDICATED_STREAMS' ? 'DEDICATED_STREAMS' : 'UNIFIED_PARALLEL';
    const mapsUrlVal = googleMapsUrl?.trim() || null;

    const rawCat = (category || '').toLowerCase().trim();
    let businessCategory = 'RETAIL';
    let defaultStreamName = 'Service Counter Queue';

    if (rawCat.includes('clinic') || rawCat.includes('opd') || rawCat.includes('medical') || rawCat.includes('health')) {
      businessCategory = 'MEDICAL_OPD';
      defaultStreamName = 'Main OPD Queue';
    } else if (rawCat.includes('restaurant') || rawCat.includes('hotel') || rawCat.includes('diner') || rawCat.includes('food')) {
      businessCategory = 'RESTAURANT';
      defaultStreamName = 'Dining Queue';
    } else if (rawCat.includes('salon') || rawCat.includes('spa') || rawCat.includes('barber')) {
      businessCategory = 'SALON';
      defaultStreamName = 'Service Stations Queue';
    }

    const computedStations = Array.isArray(stations) && stations.length > 0
      ? stations
      : generateDomainStations(businessCategory, stationCounts);

    const paceMins = Number(baseServiceTimeMins) > 0 ? Number(baseServiceTimeMins) : 15;
    const capacity = Number(maxDailyCapacity) > 0 ? Number(maxDailyCapacity) : 100;
    const phoneVal = phone?.trim() || 'N/A';
    const qrSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(1000 + Math.random() * 9000);

    const now = new Date();
    const isTrial = Boolean(isFreeTrial);
    let initialStatus = isTrial ? 'TRIAL' : 'ACTIVE';
    let nextBilling: Date;
    let anchorDay: number;

    if (isTrial) {
      nextBilling = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      anchorDay = nextBilling.getDate();
    } else {
      anchorDay = now.getDate();
      nextBilling = calculateNextBillingDate(anchorDay, now);
    }

    const initialFee = Number(initialPaymentAmount) > 0 ? Number(initialPaymentAmount) : 1499.00;

    await client.query('BEGIN');
    await ensureSubscriptionTables(client);

    const bRes = await client.query(
      `INSERT INTO businesses
       (name, category, phone, base_service_time_mins, max_daily_capacity, qr_code_slug, admin_passcode,
        google_maps_url, subscription_status, billing_anchor_day, subscription_start_date,
        next_billing_date, last_payment_date, monthly_fee, username, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, NOW(), 499.00, $12, $13)
       RETURNING *`,
      [
        name.trim(), businessCategory, phoneVal, paceMins, capacity, qrSlug, passcodeVal,
        mapsUrlVal, initialStatus, anchorDay, nextBilling, username.trim(), passwordHash,
      ]
    );

    const newBusiness = bRes.rows[0];

    if (!isTrial) {
      await client.query(
        `INSERT INTO subscription_payments
         (business_id, amount, payment_type, payment_status, payment_method, transaction_ref,
          paid_at, billing_period_start, billing_period_end, notes)
         VALUES ($1, $2, 'ONBOARDING_INITIAL', 'SUCCESS', 'ONLINE_CARD_UPI', $3, NOW(), NOW(), $4, $5)`,
        [
          newBusiness.id,
          initialFee,
          `TXN_INIT_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
          nextBilling,
          `Initial Onboarding & 1st Month Subscription for ${name.trim()}`,
        ]
      );
    }

    const sRes = await client.query(
      `INSERT INTO queue_streams
       (business_id, stream_name, is_active, status, pace_per_patient_mins, current_effective_time_mins,
        stations, operating_days, opening_time, closing_time, queue_structure, google_maps_url, last_reset_date)
       VALUES ($1, $2, true, 'ACTIVE', $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_DATE)
       RETURNING *`,
      [
        newBusiness.id, defaultStreamName, paceMins, paceMins,
        JSON.stringify(computedStations), JSON.stringify(opDays), openVal, closeVal,
        qStruct, mapsUrlVal,
      ]
    );

    const newStream = sRes.rows[0];
    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      business: newBusiness,
      stream: newStream,
      streamId: newStream.id,
      subscription: { status: initialStatus, isTrial, anchorDay, nextBillingDate: nextBilling },
      dashboardUrl: `/dashboard?streamId=${newStream.id}`,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Signup error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create account.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
