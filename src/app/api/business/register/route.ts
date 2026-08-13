import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const client = await db.connect();
  try {
    const body = await req.json();
    const { name, category, phone, baseServiceTimeMins, maxDailyCapacity, adminPasscode } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Business name is required' },
        { status: 400 }
      );
    }

    const passcodeVal = adminPasscode?.trim() || '123456';

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

    const paceMins = Number(baseServiceTimeMins) > 0 ? Number(baseServiceTimeMins) : 15;
    const capacity = Number(maxDailyCapacity) > 0 ? Number(maxDailyCapacity) : 100;
    const phoneVal = phone?.trim() || 'N/A';
    const qrSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(1000 + Math.random() * 9000);

    await client.query('BEGIN');

    // 1. Insert Business
    const bRes = await client.query(
      `INSERT INTO businesses (name, category, phone, base_service_time_mins, max_daily_capacity, qr_code_slug, admin_passcode)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name.trim(), businessCategory, phoneVal, paceMins, capacity, qrSlug, passcodeVal]
    );

    const newBusiness = bRes.rows[0];

    // 3. Create initial Queue Stream
    const sRes = await client.query(
      `INSERT INTO queue_streams (business_id, stream_name, is_active, status, pace_per_patient_mins, current_effective_time_mins)
       VALUES ($1, $2, true, 'ACTIVE', $3, $4)
       RETURNING *`,
      [newBusiness.id, defaultStreamName, paceMins, paceMins]
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
