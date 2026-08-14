import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateDomainStations } from '@/lib/domain';

export async function POST(req: NextRequest) {
  const client = await db.connect();
  try {
    const body = await req.json();
    const { name, category, phone, baseServiceTimeMins, maxDailyCapacity, adminPasscode, stations, stationCounts, operatingDays, openingTime, closingTime } = body;

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

    await client.query('BEGIN');
    await client.query(`
      ALTER TABLE queue_streams 
      ADD COLUMN IF NOT EXISTS stations JSONB,
      ADD COLUMN IF NOT EXISTS operating_days JSONB,
      ADD COLUMN IF NOT EXISTS opening_time VARCHAR(10),
      ADD COLUMN IF NOT EXISTS closing_time VARCHAR(10);
    `);

    // 1. Insert Business
    const bRes = await client.query(
      `INSERT INTO businesses (name, category, phone, base_service_time_mins, max_daily_capacity, qr_code_slug, admin_passcode)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name.trim(), businessCategory, phoneVal, paceMins, capacity, qrSlug, passcodeVal]
    );

    const newBusiness = bRes.rows[0];

    // 3. Create initial Queue Stream with stations & operating hours
    const sRes = await client.query(
      `INSERT INTO queue_streams (business_id, stream_name, is_active, status, pace_per_patient_mins, current_effective_time_mins, stations, operating_days, opening_time, closing_time)
       VALUES ($1, $2, true, 'ACTIVE', $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [newBusiness.id, defaultStreamName, paceMins, paceMins, JSON.stringify(computedStations), JSON.stringify(opDays), openVal, closeVal]
    );

    const newStream = sRes.rows[0];

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      business: newBusiness,
      stream: newStream,
      streamId: newStream.id,
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
