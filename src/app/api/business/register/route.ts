import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateDomainStations } from '@/lib/domain';
import { ensureSubscriptionTables, calculateNextBillingDate, checkTrialEligibility, recordTrialRegistration } from '@/lib/subscription';

export async function POST(req: NextRequest) {
  const client = await db.connect();
  try {
    const body = await req.json();
    const { name, category, phone, baseServiceTimeMins, maxDailyCapacity, adminPasscode, stations, stationCounts, operatingDays, openingTime, closingTime, queueStructure, googleMapsUrl, initialPaymentAmount, isFreeTrial } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Business name is required' },
        { status: 400 }
      );
    }

    const passcodeVal = adminPasscode?.trim() || '123456';
    const opDays = Array.isArray(operatingDays) && operatingDays.length > 0 ? operatingDays : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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
      // 7-Day Free Trial
      nextBilling = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      anchorDay = nextBilling.getDate();
    } else {
      anchorDay = now.getDate();
      nextBilling = calculateNextBillingDate(anchorDay, now);
    }

    const initialFee = Number(initialPaymentAmount) > 0 ? Number(initialPaymentAmount) : 1499.00;
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip')?.trim() || '';

    await client.query('BEGIN');
    await ensureSubscriptionTables(client);

    // Free Trial Abuse Prevention Check
    if (isTrial) {
      const eligibility = await checkTrialEligibility(client, phoneVal, clientIp);
      if (!eligibility.eligible) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { success: false, error: eligibility.reason },
          { status: 403 }
        );
      }
    }

    await client.query(`
      ALTER TABLE businesses 
      ADD COLUMN IF NOT EXISTS google_maps_url TEXT;

      ALTER TABLE queue_streams 
      ADD COLUMN IF NOT EXISTS stations JSONB,
      ADD COLUMN IF NOT EXISTS operating_days JSONB,
      ADD COLUMN IF NOT EXISTS opening_time VARCHAR(10),
      ADD COLUMN IF NOT EXISTS closing_time VARCHAR(10),
      ADD COLUMN IF NOT EXISTS queue_structure VARCHAR(50),
      ADD COLUMN IF NOT EXISTS google_maps_url TEXT,
      ADD COLUMN IF NOT EXISTS last_token_number INTEGER DEFAULT 0;
    `);

    // 1. Insert Business with Subscription info
    const bRes = await client.query(
      `INSERT INTO businesses 
       (name, category, phone, base_service_time_mins, max_daily_capacity, qr_code_slug, admin_passcode, google_maps_url,
        subscription_status, billing_anchor_day, subscription_start_date, next_billing_date, last_payment_date, monthly_fee, registration_ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, NOW(), 499.00, $12)
       RETURNING *`,
      [name.trim(), businessCategory, phoneVal, paceMins, capacity, qrSlug, passcodeVal, mapsUrlVal, initialStatus, anchorDay, nextBilling, clientIp]
    );

    const newBusiness = bRes.rows[0];

    // Record free trial in registry
    if (isTrial) {
      await recordTrialRegistration(client, newBusiness.id, newBusiness.name, phoneVal, clientIp);
    }

    // 2. If Paid, Record initial onboarding subscription payment
    if (!isTrial) {
      await client.query(
        `INSERT INTO subscription_payments 
         (business_id, amount, payment_type, payment_status, payment_method, transaction_ref, paid_at, billing_period_start, billing_period_end, notes)
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

    // 3. Create initial Queue Stream with stations, operating hours, queue_structure & google_maps_url
    const sRes = await client.query(
      `INSERT INTO queue_streams (business_id, stream_name, is_active, status, pace_per_patient_mins, current_effective_time_mins, stations, operating_days, opening_time, closing_time, queue_structure, google_maps_url)
       VALUES ($1, $2, true, 'ACTIVE', $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [newBusiness.id, defaultStreamName, paceMins, paceMins, JSON.stringify(computedStations), JSON.stringify(opDays), openVal, closeVal, qStruct, mapsUrlVal]
    );

    const newStream = sRes.rows[0];

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      business: newBusiness,
      stream: newStream,
      streamId: newStream.id,
      subscription: {
        status: initialStatus,
        isTrial,
        anchorDay,
        nextBillingDate: nextBilling,
      },
      dashboardUrl: `/dashboard?streamId=${newStream.id}`,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error registering business:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to register business' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
