import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureSubscriptionTables, computeSubscriptionState, recordSubscriptionPayment, purgeExpiredBusinessData, calculateNextBillingDate } from '@/lib/subscription';

const MASTER_SUPERADMIN_KEY = process.env.SUPERADMIN_SECRET || 'noq-admin-2026';

function verifySuperAdminAuth(req: NextRequest): boolean {
  const key = req.headers.get('x-superadmin-key') || req.headers.get('authorization')?.replace('Bearer ', '');
  return Boolean(key && key.trim() === MASTER_SUPERADMIN_KEY.trim());
}

export async function GET(req: NextRequest) {
  if (!verifySuperAdminAuth(req)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Invalid Super Admin master key' },
      { status: 401 }
    );
  }

  const client = await db.connect();
  try {
    await ensureSubscriptionTables(client);

    // 1. Fetch businesses with stream and token counts
    const bizRes = await client.query(`
      SELECT 
        b.id,
        b.name,
        b.category,
        b.phone,
        b.created_at,
        b.subscription_status,
        b.billing_anchor_day,
        b.subscription_start_date,
        b.next_billing_date,
        b.last_payment_date,
        b.monthly_fee,
        COUNT(DISTINCT s.id) AS stream_count,
        COUNT(DISTINCT t.id) AS total_tokens,
        COUNT(DISTINCT CASE WHEN t.status = 'COMPLETED' THEN t.id END) AS completed_tokens,
        COUNT(DISTINCT CASE WHEN t.status = 'WAITING' THEN t.id END) AS waiting_tokens,
        COUNT(DISTINCT f.id) AS feedback_count
      FROM businesses b
      LEFT JOIN queue_streams s ON s.business_id = b.id
      LEFT JOIN tokens t ON t.stream_id = s.id
      LEFT JOIN feedbacks f ON f.stream_id = s.id
      GROUP BY b.id
      ORDER BY b.created_at DESC
    `);

    // 2. Fetch total platform revenue
    const revRes = await client.query(`
      SELECT 
        COALESCE(SUM(amount), 0) AS total_revenue,
        COUNT(*) AS total_transactions
      FROM subscription_payments
      WHERE payment_status = 'SUCCESS'
    `);

    // 3. Process clientele details and calculate storage estimates
    const businesses = bizRes.rows.map((b: any) => {
      const subState = computeSubscriptionState(b);
      const totalTokens = Number(b.total_tokens || 0);
      const streamCount = Number(b.stream_count || 0);
      const feedbackCount = Number(b.feedback_count || 0);

      // Estimated storage footprint: ~1.2 KB per token record + ~0.8 KB per feedback + ~2 KB per stream + ~1 KB base biz
      const estimatedBytes = Math.round(1024 + (streamCount * 2048) + (totalTokens * 1228) + (feedbackCount * 819));
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
        monthlyFee: Number(b.monthly_fee) || 599,
        subscriptionStatus: subState.status,
        streamCount,
        totalTokens,
        completedTokens: Number(b.completed_tokens || 0),
        waitingTokens: Number(b.waiting_tokens || 0),
        feedbackCount,
        storageFootprint: {
          bytes: estimatedBytes,
          kb: Number(estimatedKB),
          formatted: estimatedBytes > 1048576 ? `${(estimatedBytes / 1048576).toFixed(2)} MB` : `${estimatedKB} KB`,
        },
      };
    });

    const totalRevenue = Number(revRes.rows[0]?.total_revenue || 0);
    const totalTransactions = Number(revRes.rows[0]?.total_transactions || 0);

    const activeClients = businesses.filter((b) => b.subscriptionStatus === 'ACTIVE').length;
    const graceClients = businesses.filter((b) => b.subscriptionStatus === 'GRACE_PERIOD').length;
    const lockedClients = businesses.filter((b) => b.subscriptionStatus === 'LOCKED').length;
    const expiredClients = businesses.filter((b) => b.subscriptionStatus === 'EXPIRED').length;
    
    const totalTokensIssued = businesses.reduce((acc, b) => acc + b.totalTokens, 0);
    const totalStorageBytes = businesses.reduce((acc, b) => acc + b.storageFootprint.bytes, 0);

    return NextResponse.json({
      success: true,
      platformMetrics: {
        totalRevenue,
        totalTransactions,
        mrr: activeClients * 599,
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
    });
  } catch (error: any) {
    console.error('Super Admin GET Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch platform metrics' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  if (!verifySuperAdminAuth(req)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Invalid Super Admin master key' },
      { status: 401 }
    );
  }

  const client = await db.connect();
  try {
    await ensureSubscriptionTables(client);
    const body = await req.json();
    const { action, businessId, amount, extensionDays = 7, notes } = body;

    if (!businessId) {
      return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });
    }

    if (action === 'MANUAL_RENEW') {
      const payAmount = Number(amount) > 0 ? Number(amount) : 999.00;
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
