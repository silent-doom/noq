import { PoolClient } from 'pg';

export interface SubscriptionState {
  status: 'ACTIVE' | 'GRACE_PERIOD' | 'LOCKED' | 'EXPIRED';
  billingAnchorDay: number;
  nextBillingDate: Date | null;
  daysRemaining: number;
  daysOverdue: number;
  monthlyFee: number;
  isLocked: boolean;
  isGracePeriod: boolean;
  message: string;
}

/**
 * Initializes subscription and billing tables if not already present.
 */
export async function ensureSubscriptionTables(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE businesses 
    ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(30) DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS billing_anchor_day INT,
    ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS plan_tier VARCHAR(50) DEFAULT 'STANDARD',
    ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC(10,2) DEFAULT 999.00;

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

    CREATE INDEX IF NOT EXISTS idx_sub_payments_biz ON subscription_payments(business_id);
    CREATE INDEX IF NOT EXISTS idx_businesses_sub_status ON businesses(subscription_status);
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
 * Policy:
 * - If NOW <= nextBillingDate: ACTIVE
 * - If nextBillingDate < NOW <= nextBillingDate + 3 days: GRACE_PERIOD
 * - If nextBillingDate + 3 days < NOW <= nextBillingDate + 10 days: LOCKED
 * - If NOW > nextBillingDate + 10 days: EXPIRED (Eligible for storage clean-up)
 */
export function computeSubscriptionState(business: {
  subscription_status?: string;
  billing_anchor_day?: number;
  next_billing_date?: string | Date;
  monthly_fee?: number | string;
  created_at?: string | Date;
}): SubscriptionState {
  const now = new Date();
  const createdDate = business.created_at ? new Date(business.created_at) : now;
  const anchorDay = business.billing_anchor_day || createdDate.getDate() || 1;
  const monthlyFee = Number(business.monthly_fee) || 999;

  let nextBillingDate: Date;
  if (business.next_billing_date) {
    nextBillingDate = new Date(business.next_billing_date);
  } else {
    nextBillingDate = calculateNextBillingDate(anchorDay, createdDate);
  }

  const diffMs = nextBillingDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  // If manual override to LOCKED or EXPIRED was set
  if (business.subscription_status === 'LOCKED') {
    return {
      status: 'LOCKED',
      billingAnchorDay: anchorDay,
      nextBillingDate,
      daysRemaining: 0,
      daysOverdue: Math.max(4, Math.abs(diffDays)),
      monthlyFee,
      isLocked: true,
      isGracePeriod: false,
      message: 'Terminal locked due to overdue subscription payment.',
    };
  }

  if (business.subscription_status === 'EXPIRED') {
    return {
      status: 'EXPIRED',
      billingAnchorDay: anchorDay,
      nextBillingDate,
      daysRemaining: 0,
      daysOverdue: Math.max(11, Math.abs(diffDays)),
      monthlyFee,
      isLocked: true,
      isGracePeriod: false,
      message: 'Subscription expired and data scheduled for purge.',
    };
  }

  // Normal calculation
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
      message: `Active (Next renewal due in ${diffDays} day${diffDays === 1 ? '' : 's'})`,
    };
  }

  const daysOverdue = Math.abs(diffDays);

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
      message: `Grace Period: Payment overdue by ${daysOverdue} day${daysOverdue === 1 ? '' : 's'}. Terminal will lock in ${3 - daysOverdue} day${3 - daysOverdue === 1 ? '' : 's'}.`,
    };
  }

  if (daysOverdue <= 10) {
    return {
      status: 'LOCKED',
      billingAnchorDay: anchorDay,
      nextBillingDate,
      daysRemaining: 0,
      daysOverdue,
      monthlyFee,
      isLocked: true,
      isGracePeriod: false,
      message: `Terminal Locked: Payment is ${daysOverdue} days overdue. Please renew your monthly subscription to unlock.`,
    };
  }

  return {
    status: 'EXPIRED',
    billingAnchorDay: anchorDay,
    nextBillingDate,
    daysRemaining: 0,
    daysOverdue,
    monthlyFee,
    isLocked: true,
    isGracePeriod: false,
    message: `Subscription Expired: Overdue by ${daysOverdue} days. Historical queue data is queued for storage purge.`,
  };
}

/**
 * Records a successful payment and rolls forward the next billing cycle.
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

  await client.query(
    `UPDATE businesses 
     SET subscription_status = 'ACTIVE',
         last_payment_date = NOW(),
         next_billing_date = $1
     WHERE id = $2`,
    [newNextBillingDate, businessId]
  );

  return { payment: pRes.rows[0], nextBillingDate: newNextBillingDate };
}

/**
 * Purges inactive waiting/completed tokens of an expired business to free database storage.
 */
export async function purgeExpiredBusinessData(client: PoolClient, businessId: string): Promise<{ purgedTokens: number }> {
  // Find streams belonging to business
  const sRes = await client.query(`SELECT id FROM queue_streams WHERE business_id = $1`, [businessId]);
  const streamIds = sRes.rows.map((r: any) => r.id);

  if (streamIds.length === 0) return { purgedTokens: 0 };

  const delRes = await client.query(
    `DELETE FROM tokens 
     WHERE stream_id = ANY($1::uuid[]) 
       AND status IN ('COMPLETED', 'CANCELLED', 'SKIPPED')`,
    [streamIds]
  );

  await client.query(
    `UPDATE businesses 
     SET subscription_status = 'EXPIRED' 
     WHERE id = $1`,
    [businessId]
  );

  return { purgedTokens: delRes.rowCount || 0 };
}
