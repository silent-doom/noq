import { PoolClient } from 'pg';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkingHoursRow {
  id: number;
  business_id: string;
  stream_id: string;
  day_of_week: number; // 0 = Sunday, 1 = Monday ... 6 = Saturday
  open_time: string;   // "HH:MM"
  close_time: string;  // "HH:MM"
  slot_duration_mins: number;
  max_per_slot: number;
  is_active: boolean;
}

export interface SlotInfo {
  time: string;         // "HH:MM" 24-hour
  timeLabel: string;    // "10:00 AM"
  available: boolean;
  bookedCount: number;
  maxPerSlot: number;
}

export interface AppointmentRow {
  id: string;
  stream_id: string;
  business_id: string;
  customer_name: string;
  customer_phone: string;
  slot_date: string;    // ISO date string
  slot_time: string;    // "HH:MM"
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'NO_SHOW';
  appointment_ref: string;
  created_at: string;
}

// ─── Schema ──────────────────────────────────────────────────────────────────

export async function ensureSlotTables(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS business_working_hours (
      id SERIAL PRIMARY KEY,
      business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      stream_id UUID NOT NULL REFERENCES queue_streams(id) ON DELETE CASCADE,
      day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
      open_time TIME NOT NULL,
      close_time TIME NOT NULL,
      slot_duration_mins SMALLINT NOT NULL DEFAULT 30,
      max_per_slot SMALLINT NOT NULL DEFAULT 1,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      UNIQUE (stream_id, day_of_week)
    );

    CREATE TABLE IF NOT EXISTS slot_appointments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      stream_id UUID NOT NULL REFERENCES queue_streams(id) ON DELETE CASCADE,
      business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      customer_name VARCHAR(200) NOT NULL,
      customer_phone VARCHAR(50) NOT NULL,
      slot_date DATE NOT NULL,
      slot_time TIME NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'NO_SHOW')),
      appointment_ref VARCHAR(30) UNIQUE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_slot_appt_stream_date
      ON slot_appointments (stream_id, slot_date);
    CREATE INDEX IF NOT EXISTS idx_slot_appt_stream_time
      ON slot_appointments (stream_id, slot_date, slot_time);
    CREATE INDEX IF NOT EXISTS idx_working_hours_stream
      ON business_working_hours (stream_id);

    ALTER TABLE businesses
      ADD COLUMN IF NOT EXISTS slot_booking_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS slot_addon_next_billing TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS slot_addon_trial_started_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS slot_addon_trial_ends_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS slot_addon_status VARCHAR(20) DEFAULT 'NONE';
  `);
}

// ─── Slot Addon State & Trial Logic ──────────────────────────────────────────

export interface SlotAddonState {
  isEnabled: boolean;
  status: 'NONE' | 'TRIAL' | 'ACTIVE' | 'EXPIRED';
  isTrial: boolean;
  trialDaysRemaining: number;
  trialEndsAt: Date | null;
  nextBillingDate: Date | null;
  message: string;
}

export function computeSlotAddonState(business: {
  slot_booking_enabled?: boolean | null;
  slot_addon_status?: string | null;
  slot_addon_trial_started_at?: Date | string | null;
  slot_addon_trial_ends_at?: Date | string | null;
  slot_addon_next_billing?: Date | string | null;
}): SlotAddonState {
  const now = new Date();
  const rawStatus = (business.slot_addon_status || '').toUpperCase();
  const trialEndsAt = business.slot_addon_trial_ends_at ? new Date(business.slot_addon_trial_ends_at) : null;
  const nextBillingDate = business.slot_addon_next_billing ? new Date(business.slot_addon_next_billing) : null;

  // 1. If explicitly in TRIAL status
  if (rawStatus === 'TRIAL') {
    if (trialEndsAt && trialEndsAt.getTime() > now.getTime()) {
      const diffMs = trialEndsAt.getTime() - now.getTime();
      const daysRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      return {
        isEnabled: true,
        status: 'TRIAL',
        isTrial: true,
        trialDaysRemaining: daysRemaining,
        trialEndsAt,
        nextBillingDate,
        message: `Free Trial Active (${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} remaining)`,
      };
    } else {
      return {
        isEnabled: false,
        status: 'EXPIRED',
        isTrial: false,
        trialDaysRemaining: 0,
        trialEndsAt,
        nextBillingDate,
        message: 'Your 7-day slot booking trial has ended. Subscribe for ₹299/mo to reactivate.',
      };
    }
  }

  // 2. Active status (paid)
  if (rawStatus === 'ACTIVE' || (business.slot_booking_enabled && !rawStatus)) {
    if (nextBillingDate && nextBillingDate.getTime() < now.getTime()) {
      return {
        isEnabled: false,
        status: 'EXPIRED',
        isTrial: false,
        trialDaysRemaining: 0,
        trialEndsAt: null,
        nextBillingDate,
        message: 'Slot booking subscription has expired. Renew for ₹299/mo to continue.',
      };
    }
    return {
      isEnabled: true,
      status: 'ACTIVE',
      isTrial: false,
      trialDaysRemaining: 0,
      trialEndsAt: null,
      nextBillingDate,
      message: 'Active Slot Booking Add-On (₹299/mo)',
    };
  }

  // 3. Expired status
  if (rawStatus === 'EXPIRED') {
    return {
      isEnabled: false,
      status: 'EXPIRED',
      isTrial: false,
      trialDaysRemaining: 0,
      trialEndsAt,
      nextBillingDate,
      message: 'Slot booking add-on is inactive.',
    };
  }

  // 4. Default: NONE
  return {
    isEnabled: false,
    status: 'NONE',
    isTrial: false,
    trialDaysRemaining: 7,
    trialEndsAt: null,
    nextBillingDate: null,
    message: 'Start your 7-Day Free Trial of Future Slot Bookings.',
  };
}

export async function startSlotTrial(
  client: PoolClient,
  businessId: string,
  trialDays: number = 7
): Promise<SlotAddonState> {
  await ensureSlotTables(client);
  const res = await client.query(
    `UPDATE businesses
     SET slot_booking_enabled = TRUE,
         slot_addon_status = 'TRIAL',
         slot_addon_trial_started_at = NOW(),
         slot_addon_trial_ends_at = NOW() + ($2 || ' days')::INTERVAL,
         slot_addon_next_billing = NOW() + ($2 || ' days')::INTERVAL
     WHERE id = $1
     RETURNING *`,
    [businessId, trialDays]
  );
  if (res.rows.length === 0) throw new Error('Business not found');
  return computeSlotAddonState(res.rows[0]);
}

// ─── Working Hours ────────────────────────────────────────────────────────────

export async function getWorkingHoursForStream(
  client: PoolClient,
  streamId: string
): Promise<WorkingHoursRow[]> {
  await ensureSlotTables(client);
  const res = await client.query(
    `SELECT * FROM business_working_hours WHERE stream_id = $1 AND is_active = TRUE ORDER BY day_of_week ASC`,
    [streamId]
  );
  return res.rows;
}

export async function upsertWorkingHours(
  client: PoolClient,
  streamId: string,
  businessId: string,
  dayOfWeek: number,
  openTime: string,
  closeTime: string,
  slotDurationMins: number = 30,
  maxPerSlot: number = 1
): Promise<WorkingHoursRow> {
  await ensureSlotTables(client);
  const res = await client.query(
    `INSERT INTO business_working_hours
       (stream_id, business_id, day_of_week, open_time, close_time, slot_duration_mins, max_per_slot, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
     ON CONFLICT (stream_id, day_of_week)
     DO UPDATE SET
       open_time = EXCLUDED.open_time,
       close_time = EXCLUDED.close_time,
       slot_duration_mins = EXCLUDED.slot_duration_mins,
       max_per_slot = EXCLUDED.max_per_slot,
       is_active = TRUE
     RETURNING *`,
    [streamId, businessId, dayOfWeek, openTime, closeTime, slotDurationMins, maxPerSlot]
  );
  return res.rows[0];
}

export async function deleteWorkingHoursForDay(
  client: PoolClient,
  streamId: string,
  dayOfWeek: number
): Promise<void> {
  await client.query(
    `UPDATE business_working_hours SET is_active = FALSE WHERE stream_id = $1 AND day_of_week = $2`,
    [streamId, dayOfWeek]
  );
}

// ─── Slot Generation ──────────────────────────────────────────────────────────

/**
 * Generates time slot strings ("HH:MM") between open and close time
 * with the given duration interval.
 */
export function generateTimeSlots(
  openTime: string,
  closeTime: string,
  durationMins: number
): string[] {
  const slots: string[] = [];
  const [openH, openM] = openTime.split(':').map(Number);
  const [closeH, closeM] = closeTime.split(':').map(Number);
  const openTotal = openH * 60 + openM;
  const closeTotal = closeH * 60 + closeM;

  for (let mins = openTotal; mins < closeTotal; mins += durationMins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  return slots;
}

/**
 * Converts "HH:MM" 24-hour to "H:MM AM/PM" display label.
 */
export function formatTimeLabel(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Returns available slot info for a given stream + date.
 * Returns [] if slot_booking_enabled = false OR no working hours configured for that day.
 */
export async function getAvailableSlots(
  client: PoolClient,
  streamId: string,
  date: string // YYYY-MM-DD
): Promise<SlotInfo[]> {
  await ensureSlotTables(client);

  // Check slot_booking_enabled on the parent business
  const enabledRes = await client.query(
    `SELECT b.slot_booking_enabled
     FROM queue_streams qs
     JOIN businesses b ON qs.business_id = b.id
     WHERE qs.id = $1`,
    [streamId]
  );
  if (enabledRes.rows.length === 0 || !enabledRes.rows[0].slot_booking_enabled) {
    return [];
  }

  // day_of_week: JS Date uses 0=Sunday
  const dateObj = new Date(date + 'T00:00:00');
  const dayOfWeek = dateObj.getDay();

  const hoursRes = await client.query(
    `SELECT * FROM business_working_hours
     WHERE stream_id = $1 AND day_of_week = $2 AND is_active = TRUE`,
    [streamId, dayOfWeek]
  );
  if (hoursRes.rows.length === 0) return []; // Closed that day

  const hours = hoursRes.rows[0] as WorkingHoursRow;
  const timeSlots = generateTimeSlots(hours.open_time, hours.close_time, hours.slot_duration_mins);

  // Count existing bookings per slot for this date
  const bookingsRes = await client.query(
    `SELECT slot_time::text, COUNT(*) AS cnt
     FROM slot_appointments
     WHERE stream_id = $1 AND slot_date = $2 AND status NOT IN ('CANCELLED')
     GROUP BY slot_time`,
    [streamId, date]
  );
  const bookingMap: Record<string, number> = {};
  for (const row of bookingsRes.rows) {
    // Normalize "HH:MM:SS" → "HH:MM"
    const t = (row.slot_time as string).substring(0, 5);
    bookingMap[t] = Number(row.cnt);
  }

  return timeSlots.map((t) => {
    const booked = bookingMap[t] || 0;
    return {
      time: t,
      timeLabel: formatTimeLabel(t),
      available: booked < hours.max_per_slot,
      bookedCount: booked,
      maxPerSlot: hours.max_per_slot,
    };
  });
}

// ─── Appointments ─────────────────────────────────────────────────────────────

function generateAppointmentRef(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `APT-${ts}-${rand}`;
}

export async function createAppointment(
  client: PoolClient,
  params: {
    streamId: string;
    customerName: string;
    customerPhone: string;
    slotDate: string; // YYYY-MM-DD
    slotTime: string; // HH:MM
  }
): Promise<AppointmentRow> {
  await ensureSlotTables(client);

  // Resolve business_id from stream
  const streamRes = await client.query(
    `SELECT qs.business_id, b.slot_booking_enabled
     FROM queue_streams qs
     JOIN businesses b ON qs.business_id = b.id
     WHERE qs.id = $1`,
    [params.streamId]
  );
  if (streamRes.rows.length === 0) throw new Error('Stream not found');
  if (!streamRes.rows[0].slot_booking_enabled) {
    throw new Error('Slot booking is not enabled for this business');
  }
  const businessId = streamRes.rows[0].business_id;

  // Verify slot is still available
  const slots = await getAvailableSlots(client, params.streamId, params.slotDate);
  const targetSlot = slots.find((s) => s.time === params.slotTime);
  if (!targetSlot) throw new Error('The selected time slot does not exist for this date');
  if (!targetSlot.available) throw new Error('This time slot is fully booked. Please choose another.');

  const ref = generateAppointmentRef();
  const res = await client.query(
    `INSERT INTO slot_appointments
       (stream_id, business_id, customer_name, customer_phone, slot_date, slot_time, appointment_ref)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [params.streamId, businessId, params.customerName.trim(), params.customerPhone.trim(), params.slotDate, params.slotTime, ref]
  );
  return res.rows[0];
}

export async function getAppointmentById(
  client: PoolClient,
  appointmentId: string
): Promise<AppointmentRow | null> {
  await ensureSlotTables(client);
  const res = await client.query(
    `SELECT sa.*, qs.stream_name, b.name AS business_name, b.category
     FROM slot_appointments sa
     JOIN queue_streams qs ON sa.stream_id = qs.id
     JOIN businesses b ON sa.business_id = b.id
     WHERE sa.id = $1`,
    [appointmentId]
  );
  return res.rows[0] || null;
}

export async function getAppointmentsForStream(
  client: PoolClient,
  streamId: string,
  date?: string // YYYY-MM-DD, defaults to today
): Promise<AppointmentRow[]> {
  await ensureSlotTables(client);
  const targetDate = date || new Date().toISOString().substring(0, 10);
  const res = await client.query(
    `SELECT * FROM slot_appointments
     WHERE stream_id = $1 AND slot_date = $2
     ORDER BY slot_time ASC`,
    [streamId, targetDate]
  );
  return res.rows;
}

export async function updateAppointmentStatus(
  client: PoolClient,
  appointmentId: string,
  status: 'CONFIRMED' | 'CANCELLED' | 'NO_SHOW'
): Promise<AppointmentRow> {
  await ensureSlotTables(client);
  const res = await client.query(
    `UPDATE slot_appointments SET status = $1 WHERE id = $2 RETURNING *`,
    [status, appointmentId]
  );
  if (res.rows.length === 0) throw new Error('Appointment not found');
  return res.rows[0];
}
