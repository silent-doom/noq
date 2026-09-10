import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureSubscriptionTables, computeSubscriptionState, recordSubscriptionPayment, purgeExpiredBusinessData, calculateNextBillingDate } from '@/lib/subscription';
import { checkRateLimit, recordRateLimitHit, clearRateLimit } from '@/lib/rateLimit';
import { logApiError } from '@/lib/incidentLogger';

import { PoolClient } from 'pg';

async function ensurePlatformConfig(client: PoolClient): Promise<string> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS platform_config (
      config_key VARCHAR(100) PRIMARY KEY,
      config_value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const existing = await client.query(
    `SELECT config_value FROM platform_config WHERE config_key = 'superadmin_secret'`
  );

  const envKey = process.env.SUPERADMIN_SECRET?.trim();
  const targetKey = envKey && envKey !== 'noq-admin-2026' ? envKey : 'noq-vault-9842-x7k9p-mstr';

  if (existing.rows.length === 0) {
    await client.query(
      `INSERT INTO platform_config (config_key, config_value) VALUES ('superadmin_secret', $1)`,
      [targetKey]
    );
    return targetKey;
  } else if (existing.rows[0].config_value === 'noq-admin-2026') {
    // Automatically migrate away from legacy insecure default
    await client.query(
      `UPDATE platform_config SET config_value = $1, updated_at = NOW() WHERE config_key = 'superadmin_secret'`,
      [targetKey]
    );
    return targetKey;
  }

  return existing.rows[0].config_value;
}

async function verifySuperAdminAuth(client: PoolClient, req: NextRequest): Promise<boolean> {
  const incomingKey = (req.headers.get('x-superadmin-key') || req.headers.get('authorization')?.replace('Bearer ', '') || '').trim();
  if (!incomingKey) return false;

  // Reject deprecated default
  if (incomingKey === 'noq-admin-2026') return false;

  const validDbKey = await ensurePlatformConfig(client);
  const validEnvKey = (process.env.SUPERADMIN_SECRET || '').trim();

  return incomingKey === validDbKey || (Boolean(validEnvKey) && validEnvKey !== 'noq-admin-2026' && incomingKey === validEnvKey);
}

export async function GET(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for');
  const clientIp = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
  const rateKey = `superadmin:auth:${clientIp}`;

  const rateCheck = await checkRateLimit(rateKey, 5, 15 * 60);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many unauthorized superadmin attempts. Access blocked for 15 minutes.' },
      { status: 429 }
    );
  }

  const client = await db.connect();
  try {
    const isAuthorized = await verifySuperAdminAuth(client, req);
    if (!isAuthorized) {
      await recordRateLimitHit(rateKey, 15 * 60);
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Invalid Super Admin master key' },
        { status: 401 }
      );
    }

    await clearRateLimit(rateKey);

    await client.query(`
      CREATE TABLE IF NOT EXISTS feedbacks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        token_id UUID,
        stream_id UUID,
        rating INT NOT NULL,
        comment TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 1. Fetch all businesses with subscription metrics and storage calculation
    const bRes = await client.query(`
      SELECT 
        b.id,
        b.name,
        b.category,
        b.phone,
        b.created_at,
        b.subscription_status,
        b.billing_anchor_day,
        b.next_billing_date,
        b.monthly_fee,
        b.slot_booking_enabled,
        b.slot_addon_next_billing,
        (SELECT COUNT(*) FROM queue_streams WHERE business_id = b.id) AS stream_count,
        (SELECT COUNT(*) FROM tokens t JOIN queue_streams qs ON t.stream_id = qs.id WHERE qs.business_id = b.id) AS total_tokens,
        (SELECT COUNT(*) FROM tokens t JOIN queue_streams qs ON t.stream_id = qs.id WHERE qs.business_id = b.id AND t.status = 'COMPLETED') AS completed_tokens,
        (SELECT COUNT(*) FROM tokens t JOIN queue_streams qs ON t.stream_id = qs.id WHERE qs.business_id = b.id AND t.status = 'WAITING') AS waiting_tokens,
        (SELECT COUNT(*) FROM feedbacks f JOIN queue_streams qs ON f.stream_id = qs.id WHERE qs.business_id = b.id) AS feedback_count,
        (SELECT COALESCE(SUM(amount), 0) FROM subscription_payments WHERE business_id = b.id AND (payment_status IN ('SUCCESS', 'PAID') OR payment_status IS NULL)) AS total_paid_revenue,
        (SELECT COUNT(*) FROM subscription_payments WHERE business_id = b.id AND (payment_status IN ('SUCCESS', 'PAID') OR payment_status IS NULL)) AS payment_count
      FROM businesses b
      ORDER BY b.created_at DESC
    `);

    // 2. Fetch revenue summary from subscription_payments ledger
    const revRes = await client.query(`
      SELECT 
        COALESCE(SUM(amount), 0) AS total_revenue,
        COUNT(*) AS total_transactions
      FROM subscription_payments
      WHERE payment_status IN ('SUCCESS', 'PAID') OR payment_status IS NULL
    `);

    const businesses = bRes.rows.map((b) => {
      const subState = computeSubscriptionState(b);
      const totalTokens = Number(b.total_tokens || 0);
      const streamCount = Number(b.stream_count || 0);
      const feedbackCount = Number(b.feedback_count || 0);
      const totalPaidRevenue = Number(b.total_paid_revenue || 0);
      const paymentCount = Number(b.payment_count || 0);

      // Approximate PostgreSQL row storage footprint (B: 1.2KB base, Token: 450B, Feedback: 300B)
      const estimatedBytes = (1200 * streamCount) + (totalTokens * 450) + (feedbackCount * 300) + 2048;
      const estimatedKB = (estimatedBytes / 1024).toFixed(1);

      return {
        id: b.id,
        name: b.name,
        category: b.category,
        phone: b.phone,
        createdAt: b.created_at,
        anchorDay: b.billing_anchor_day || new Date(b.created_at).getDate(),
        nextBillingDate: subState.nextBillingDate,
        daysRemaining: subState.daysRemaining,
        daysOverdue: subState.daysOverdue,
        monthlyFee: Math.min(Number(b.monthly_fee) || 499, 499),
        subscriptionStatus: subState.status,
        totalPaidRevenue,
        paymentCount,
        streamCount,
        totalTokens,
        completedTokens: Number(b.completed_tokens || 0),
        waitingTokens: Number(b.waiting_tokens || 0),
        feedbackCount,
        slotBookingEnabled: Boolean(b.slot_booking_enabled),
        slotAddonNextBilling: b.slot_addon_next_billing,
        storageFootprint: {
          bytes: estimatedBytes,
          kb: Number(estimatedKB),
          formatted: estimatedBytes > 1048576 ? `${(estimatedBytes / 1048576).toFixed(2)} MB` : `${estimatedKB} KB`,
        },
      };
    });

    const totalRevenue = Number(revRes.rows[0]?.total_revenue || 0);
    const totalTransactions = Number(revRes.rows[0]?.total_transactions || 0);
    const payingBusinessesCount = businesses.filter((b) => b.totalPaidRevenue > 0).length;

    const activeClients = businesses.filter((b) => b.subscriptionStatus === 'ACTIVE').length;
    const graceClients = businesses.filter((b) => b.subscriptionStatus === 'GRACE_PERIOD').length;
    const lockedClients = businesses.filter((b) => b.subscriptionStatus === 'LOCKED').length;
    const expiredClients = businesses.filter((b) => b.subscriptionStatus === 'EXPIRED' || b.subscriptionStatus === 'DEACTIVATED').length;
    
    const totalTokensIssued = businesses.reduce((acc, b) => acc + b.totalTokens, 0);
    const totalStorageBytes = businesses.reduce((acc, b) => acc + b.storageFootprint.bytes, 0);

    let recentIncidents: any[] = [];
    let supportTickets: any[] = [];
    try {
      const incidentsRes = await client.query(
        `SELECT * FROM production_issue_logs ORDER BY created_at DESC LIMIT 50`
      );
      recentIncidents = incidentsRes.rows;
    } catch {
      // ignore if table not initialized yet
    }

    try {
      const ticketsRes = await client.query(
        `SELECT * FROM support_tickets ORDER BY created_at DESC LIMIT 50`
      );
      supportTickets = ticketsRes.rows;
    } catch {
      // ignore if table not initialized yet
    }

    return NextResponse.json({
      success: true,
      platformMetrics: {
        totalRevenue,
        totalTransactions,
        payingBusinessesCount,
        mrr: activeClients * 499,
        totalBusinesses: businesses.length,
        activeClients,
        graceClients,
        lockedClients,
        expiredClients,
        totalTokensIssued,
        totalStorageBytes,
        totalStorageFormatted: totalStorageBytes > 1048576 ? `${(totalStorageBytes / 1048576).toFixed(2)} MB` : `${(totalStorageBytes / 1024).toFixed(1)} KB`,
      },
      businesses,
      recentIncidents,
      supportTickets,
    });
  } catch (error: any) {
    await logApiError(req, 'SUPERADMIN', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch platform metrics' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for');
  const clientIp = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
  const rateKey = `superadmin:auth:${clientIp}`;

  const rateCheck = await checkRateLimit(rateKey, 5, 15 * 60);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many unauthorized superadmin attempts. Access blocked for 15 minutes.' },
      { status: 429 }
    );
  }

  const client = await db.connect();
  try {
    const isAuthorized = await verifySuperAdminAuth(client, req);
    if (!isAuthorized) {
      await recordRateLimitHit(rateKey, 15 * 60);
      return NextResponse.json(
        { success: false, error: 'Invalid Super Admin Master Key authorization' },
        { status: 401 }
      );
    }

    await clearRateLimit(rateKey);

    await ensureSubscriptionTables(client);
    const body = await req.json();
    const { action, businessId, ticketId, ticketStatus, amount, extensionDays = 7, notes } = body;

    if (action === 'UPDATE_TICKET' && ticketId) {
      const updated = await client.query(
        `UPDATE support_tickets SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [ticketStatus || 'RESOLVED', ticketId]
      );
      return NextResponse.json({ success: true, ticket: updated.rows[0] });
    }

    if (action === 'ENABLE_SLOT_ADDON' && businessId) {
      await client.query(
        `UPDATE businesses SET slot_booking_enabled = TRUE, slot_addon_next_billing = NOW() + INTERVAL '30 days' WHERE id = $1`,
        [businessId]
      );
      return NextResponse.json({ success: true, message: 'Slot Booking Add-On enabled for business' });
    }

    if (action === 'DISABLE_SLOT_ADDON' && businessId) {
      await client.query(
        `UPDATE businesses SET slot_booking_enabled = FALSE WHERE id = $1`,
        [businessId]
      );
      return NextResponse.json({ success: true, message: 'Slot Booking Add-On disabled for business' });
    }

    if (!businessId) {
      return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });
    }

    if (action === 'MANUAL_RENEW') {
      const payAmount = Number(amount) > 0 ? Number(amount) : 499.00;
      await client.query('BEGIN');
      const { payment, nextBillingDate } = await recordSubscriptionPayment(
        client,
        businessId,
        payAmount,
        'MONTHLY_RENEWAL',
        'SUPERADMIN_MANUAL',
        `ADMIN_OVERRIDE_${Date.now()}`,
        notes || 'Super Admin manual subscription renewal'
      );
      await client.query('COMMIT');
      return NextResponse.json({ success: true, message: 'Business subscription renewed manually', payment, nextBillingDate });
    }

    if (action === 'GRANT_EXTENSION') {
      const days = Number(extensionDays) || 7;
      const bRes = await client.query(`SELECT * FROM businesses WHERE id = $1`, [businessId]);
      if (bRes.rows.length === 0) return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
      
      const currentNext = bRes.rows[0].next_billing_date ? new Date(bRes.rows[0].next_billing_date) : new Date();
      const newNext = new Date(Math.max(Date.now(), currentNext.getTime()) + days * 24 * 60 * 60 * 1000);

      await client.query(
        `UPDATE businesses 
         SET subscription_status = 'ACTIVE', 
             next_billing_date = $1 
         WHERE id = $2`,
        [newNext, businessId]
      );

      return NextResponse.json({ success: true, message: `Granted ${days}-day grace extension until ${newNext.toLocaleDateString()}` });
    }

    if (action === 'LOCK_TERMINAL') {
      await client.query(`UPDATE businesses SET subscription_status = 'LOCKED' WHERE id = $1`, [businessId]);
      return NextResponse.json({ success: true, message: 'Terminal locked successfully' });
    }

    if (action === 'UNLOCK_TERMINAL') {
      await client.query(`UPDATE businesses SET subscription_status = 'ACTIVE' WHERE id = $1`, [businessId]);
      return NextResponse.json({ success: true, message: 'Terminal unlocked successfully' });
    }

    if (action === 'PURGE_DATA') {
      const { purgedTokens } = await purgeExpiredBusinessData(client, businessId);
      return NextResponse.json({ success: true, message: `Purged ${purgedTokens} historical token records to reclaim database storage` });
    }

    return NextResponse.json({ success: false, error: 'Invalid action specified' }, { status: 400 });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Super Admin Action Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Action failed' }, { status: 500 });
  } finally {
    client.release();
  }
}
