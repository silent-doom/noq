import { PoolClient } from 'pg';

export interface SubscriptionState {
  status: 'ACTIVE' | 'TRIAL' | 'GRACE_PERIOD' | 'LOCKED' | 'DEACTIVATED' | 'EXPIRED';
  billingAnchorDay: number;
  nextBillingDate: Date | null;
  daysRemaining: number;
  daysOverdue: number;
  monthlyFee: number;
  isLocked: boolean;
  isGracePeriod: boolean;
  isTrial: boolean;
  isDeactivated?: boolean;
  trialDay?: number;
  message: string;
}

/**
 * Initializes subscription and billing tables if not already present.
 */
export async function ensureSubscriptionTables(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE businesses 
    ADD COLUMN IF NOT EXISTS google_maps_url TEXT,
    ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(30) DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS billing_anchor_day INT,
    ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS plan_tier VARCHAR(50) DEFAULT 'STANDARD',
    ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC(10,2) DEFAULT 499.00,
    ADD COLUMN IF NOT EXISTS is_deactivated BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS registration_ip VARCHAR(50);

    CREATE TABLE IF NOT EXISTS subscription_payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
      amount NUMERIC(10,2) NOT NULL,
      currency VARCHAR(10) DEFAULT 'INR',
      payment_type VARCHAR(30) NOT NULL,
      payment_status VARCHAR(30) DEFAULT 'SUCCESS',
      payment_method VARCHAR(50) DEFAULT 'CARD_UPI',
      transaction_ref VARCHAR(100),
      paid_at TIMESTAMPTZ DEFAULT NOW(),
      billing_period_start TIMESTAMPTZ,
      billing_period_end TIMESTAMPTZ,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS trial_registrations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      phone VARCHAR(50),
      client_ip VARCHAR(50),
      business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
      business_name VARCHAR(200),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_sub_payments_biz ON subscription_payments(business_id);
    CREATE INDEX IF NOT EXISTS idx_businesses_sub_status ON businesses(subscription_status);
    CREATE INDEX IF NOT EXISTS idx_trial_reg_phone ON trial_registrations(phone);
    CREATE INDEX IF NOT EXISTS idx_trial_reg_ip ON trial_registrations(client_ip);
  `);
}

/**
 * Calculates next billing date for a given anchor day.
 */
export function calculateNextBillingDate(anchorDay: number, fromDate: Date = new Date()): Date {
  const next = new Date(fromDate);
  // Roll to next month
  next.setMonth(next.getMonth() + 1);
  
  // Set day to anchor day, clamped to last day of target month
  const targetYear = next.getFullYear();
  const targetMonth = next.getMonth();
  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const safeDay = Math.min(anchorDay, daysInTargetMonth);
  next.setDate(safeDay);
  next.setHours(23, 59, 59, 999);

  return next;
}

/**
 * Evaluates the subscription state for a business.
 */
export function computeSubscriptionState(business: {
  subscription_status?: string;
  billing_anchor_day?: number;
  next_billing_date?: string | Date;
  monthly_fee?: number | string;
  created_at?: string | Date;
  is_deactivated?: boolean;
}): SubscriptionState {
  const now = new Date();
  const createdDate = business.created_at ? new Date(business.created_at) : now;
  const anchorDay = business.billing_anchor_day || createdDate.getDate() || 1;
  const monthlyFee = Number(business.monthly_fee) || 499;

  let nextBillingDate: Date;
  if (business.next_billing_date) {
    nextBillingDate = new Date(business.next_billing_date);
  } else {
    nextBillingDate = calculateNextBillingDate(anchorDay, createdDate);
  }

  const diffMs = nextBillingDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const daysOverdue = diffDays < 0 ? Math.abs(diffDays) : 0;

  // 1. Explicitly deactivated (soft-deleted) or manual DEACTIVATED state
  if (business.is_deactivated || business.subscription_status === 'DEACTIVATED') {
    return {
      status: 'DEACTIVATED',
      billingAnchorDay: anchorDay,
      nextBillingDate,
      daysRemaining: 0,
      daysOverdue: Math.max(4, daysOverdue),
      monthlyFee,
      isLocked: true,
      isGracePeriod: false,
      isTrial: false,
      isDeactivated: true,
      message: 'Business terminal deactivated due to unpaid subscription. All queue data and configurations are safely preserved. Settle payment to instantly reactivate.',
    };
  }

  // 2. Free Trial Lifecycle
  if (business.subscription_status === 'TRIAL') {
    if (diffDays >= 0) {
      // Within 7-day trial
      const trialDay = Math.min(7, Math.max(1, 8 - diffDays));
      return {
        status: 'TRIAL',
        billingAnchorDay: anchorDay,
        nextBillingDate,
        daysRemaining: diffDays,
        daysOverdue: 0,
        monthlyFee,
        isLocked: false,
        isGracePeriod: false,
        isTrial: true,
        trialDay,
        message: `Free Trial Active: Day ${trialDay} of 7 (${diffDays} day${diffDays === 1 ? '' : 's'} remaining).`,
      };
    } else {
      // Past 3-day trial
      if (daysOverdue <= 3) {
        // 3-day post-trial grace period
        const graceDaysLeft = 3 - daysOverdue;
        return {
          status: 'GRACE_PERIOD',
          billingAnchorDay: anchorDay,
          nextBillingDate,
          daysRemaining: 0,
          daysOverdue,
          monthlyFee,
          isLocked: false,
          isGracePeriod: true,
          isTrial: false,
          message: `Trial ended. 3-day grace period active (${graceDaysLeft} day${graceDaysLeft === 1 ? '' : 's'} left before deactivation). Settle payment to keep your live queue uninterrupted.`,
        };
      } else {
        // Beyond 3 days post-trial: DEACTIVATE ACCESS
        return {
          status: 'DEACTIVATED',
          billingAnchorDay: anchorDay,
          nextBillingDate,
          daysRemaining: 0,
          daysOverdue,
          monthlyFee,
          isLocked: true,
          isGracePeriod: false,
          isTrial: false,
          isDeactivated: true,
          message: 'Account Deactivated: Trial ended over 3 days ago. Pay subscription fee to restore full terminal access with your existing queue links.',
        };
      }
    }
  }

  // 3. Manual override to LOCKED or EXPIRED
  if (business.subscription_status === 'LOCKED') {
    return {
      status: 'LOCKED',
      billingAnchorDay: anchorDay,
      nextBillingDate,
      daysRemaining: 0,
      daysOverdue: Math.max(4, daysOverdue),
      monthlyFee,
      isLocked: true,
      isGracePeriod: false,
      isTrial: false,
      message: 'Terminal locked due to overdue subscription payment.',
    };
  }

  if (business.subscription_status === 'EXPIRED') {
    return {
      status: 'DEACTIVATED',
      billingAnchorDay: anchorDay,
      nextBillingDate,
      daysRemaining: 0,
      daysOverdue: Math.max(11, daysOverdue),
      monthlyFee,
      isLocked: true,
      isGracePeriod: false,
      isTrial: false,
      isDeactivated: true,
      message: 'Subscription expired. Terminal deactivated. Data preserved for instant reactivation.',
    };
  }

  // 4. Standard Paid Subscription Lifecycle
  if (diffDays >= 0) {
    return {
      status: 'ACTIVE',
      billingAnchorDay: anchorDay,
      nextBillingDate,
      daysRemaining: diffDays,
      daysOverdue: 0,
      monthlyFee,
      isLocked: false,
      isGracePeriod: false,
      isTrial: false,
      message: `Active (Next renewal due in ${diffDays} day${diffDays === 1 ? '' : 's'})`,
    };
  }

  if (daysOverdue <= 3) {
    return {
      status: 'GRACE_PERIOD',
      billingAnchorDay: anchorDay,
      nextBillingDate,
      daysRemaining: 0,
      daysOverdue,
      monthlyFee,
      isLocked: false,
      isGracePeriod: true,
      isTrial: false,
      message: `Grace Period: Payment overdue by ${daysOverdue} day${daysOverdue === 1 ? '' : 's'}. Terminal will lock in ${3 - daysOverdue} day${3 - daysOverdue === 1 ? '' : 's'}.`,
    };
  }

  if (daysOverdue <= 7) {
    return {
      status: 'LOCKED',
      billingAnchorDay: anchorDay,
      nextBillingDate,
      daysRemaining: 0,
      daysOverdue,
      monthlyFee,
      isLocked: true,
      isGracePeriod: false,
      isTrial: false,
      message: `Terminal Locked: Payment is ${daysOverdue} days overdue. Please renew your monthly subscription to unlock.`,
    };
  }

  // Past 7 days overdue: Soft-Deactivated
  return {
    status: 'DEACTIVATED',
    billingAnchorDay: anchorDay,
    nextBillingDate,
    daysRemaining: 0,
    daysOverdue,
    monthlyFee,
    isLocked: true,
    isGracePeriod: false,
    isTrial: false,
    isDeactivated: true,
    message: `Account Deactivated: Payment is ${daysOverdue} days overdue. Historical queue data is safely preserved. Settle fee to reactivate instantly.`,
  };
}

/**
 * Checks if a phone number or client IP address is eligible for a 7-day free trial.
 * Prevents trial abuse where a business repeatedly creates new trial accounts.
 */
export async function checkTrialEligibility(
  client: PoolClient,
  phone?: string,
  clientIp?: string
): Promise<{ eligible: boolean; reason?: string }> {
  await ensureSubscriptionTables(client);

  const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
  const cleanIp = (clientIp || '').trim();

  // 1. Phone number check (last 10 digits)
  if (cleanPhone && cleanPhone.length >= 10) {
    const last10 = cleanPhone.slice(-10);

    // Check trial_registrations registry
    const regCheck = await client.query(
      `SELECT id, created_at FROM trial_registrations 
       WHERE phone LIKE '%' || $1 
       LIMIT 1`,
      [last10]
    );
    if (regCheck.rows.length > 0) {
      return {
        eligible: false,
        reason: 'This phone number has already utilized a 7-day free trial. Please choose standard activation to proceed.',
      };
    }

    // Check existing businesses table for prior trial
    const bizCheck = await client.query(
      `SELECT id FROM businesses 
       WHERE phone LIKE '%' || $1 AND subscription_status IN ('TRIAL', 'GRACE_PERIOD', 'DEACTIVATED', 'LOCKED')
       LIMIT 1`,
      [last10]
    );
    if (bizCheck.rows.length > 0) {
      return {
        eligible: false,
        reason: 'A business registered with this phone number has already redeemed a free trial. Please choose standard activation.',
      };
    }
  }

  // 2. Client IP address check (within 90 days)
  const isLocalIp = !cleanIp || cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp === 'localhost' || cleanIp.startsWith('192.168.');
  if (!isLocalIp) {
    const ipCheck = await client.query(
      `SELECT id FROM trial_registrations 
       WHERE client_ip = $1 AND created_at > NOW() - INTERVAL '90 days'
       LIMIT 1`,
      [cleanIp]
    );
    if (ipCheck.rows.length > 0) {
      return {
        eligible: false,
        reason: 'A 7-day free trial has already been initiated from this network or device. Please select standard activation to continue.',
      };
    }
  }

  return { eligible: true };
}

/**
 * Records a newly granted free trial in the trial_registrations registry.
 */
export async function recordTrialRegistration(
  client: PoolClient,
  businessId: string,
  businessName: string,
  phone?: string,
  clientIp?: string
): Promise<void> {
  await ensureSubscriptionTables(client);
  const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
  const cleanIp = (clientIp || '').trim();

  await client.query(
    `INSERT INTO trial_registrations (phone, client_ip, business_id, business_name)
     VALUES ($1, $2, $3, $4)`,
    [cleanPhone || null, cleanIp || null, businessId, businessName]
  );
}

/**
 * Records a successful payment and rolls forward the next billing cycle.
 * Automatically reactivates soft-deleted / deactivated businesses with identical queue links.
 */
export async function recordSubscriptionPayment(
  client: PoolClient,
  businessId: string,
  amount: number,
  paymentType: 'ONBOARDING_INITIAL' | 'MONTHLY_RENEWAL',
  paymentMethod: string = 'CARD_UPI',
  transactionRef?: string,
  notes?: string
): Promise<{ payment: any; nextBillingDate: Date }> {
  await ensureSubscriptionTables(client);

  const bRes = await client.query(`SELECT * FROM businesses WHERE id = $1`, [businessId]);
  if (bRes.rows.length === 0) {
    throw new Error('Business not found');
  }

  const biz = bRes.rows[0];
  const anchorDay = biz.billing_anchor_day || new Date().getDate();
  const currentNext = biz.next_billing_date ? new Date(biz.next_billing_date) : new Date();

  // If already overdue, calculate next billing from now; else from currentNext
  const baseDate = currentNext > new Date() ? currentNext : new Date();
  const newNextBillingDate = calculateNextBillingDate(anchorDay, baseDate);

  const pRes = await client.query(
    `INSERT INTO subscription_payments 
     (business_id, amount, payment_type, payment_status, payment_method, transaction_ref, paid_at, billing_period_start, billing_period_end, notes)
     VALUES ($1, $2, $3, 'SUCCESS', $4, $5, NOW(), NOW(), $6, $7)
     RETURNING *`,
    [
      businessId,
      amount,
      paymentType,
      paymentMethod,
      transactionRef || `TXN_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
      newNextBillingDate,
      notes || `${paymentType === 'ONBOARDING_INITIAL' ? 'Initial Setup & 1st Month' : 'Monthly Renewal'} for ${biz.name}`,
    ]
  );

  // Reactivate business: reset deactivation flag, set status ACTIVE, restore queue streams
  await client.query(
    `UPDATE businesses 
     SET subscription_status = 'ACTIVE',
         is_deactivated = false,
         deactivated_at = NULL,
         last_payment_date = NOW(),
         next_billing_date = $1
     WHERE id = $2`,
    [newNextBillingDate, businessId]
  );

  // Restore active status on queue stream so same link & QR works seamlessly
  await client.query(
    `UPDATE queue_streams 
     SET is_active = true, updated_at = NOW() 
     WHERE business_id = $1`,
    [businessId]
  );

  return { payment: pRes.rows[0], nextBillingDate: newNextBillingDate };
}

/**
 * Performs a SOFT DELETE on an expired/unpaid business.
 * NEVER deletes tokens or records; preserves 100% of historical data, queue logs, and QR links.
 */
export async function purgeExpiredBusinessData(
  client: PoolClient,
  businessId: string
): Promise<{ softDeleted: boolean; preservedData: boolean; purgedTokens: number }> {
  await ensureSubscriptionTables(client);

  // 1. Mark business as deactivated (soft delete)
  await client.query(
    `UPDATE businesses 
     SET subscription_status = 'DEACTIVATED',
         is_deactivated = true,
         deactivated_at = NOW() 
     WHERE id = $1`,
    [businessId]
  );

  // 2. Mark queue streams as inactive without deleting tokens
  await client.query(
    `UPDATE queue_streams 
     SET is_active = false, updated_at = NOW() 
     WHERE business_id = $1`,
    [businessId]
  );

  return { softDeleted: true, preservedData: true, purgedTokens: 0 };
}
