import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureSubscriptionTables, computeSubscriptionState, purgeExpiredBusinessData } from '@/lib/subscription';

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}

async function handleCron(req: NextRequest) {
  const client = await db.connect();
  try {
    await ensureSubscriptionTables(client);

    const bRes = await client.query(`SELECT * FROM businesses`);
    const businesses = bRes.rows;

    let activeCount = 0;
    let graceCount = 0;
    let lockedCount = 0;
    let purgedCount = 0;
    let totalPurgedTokens = 0;

    for (const biz of businesses) {
      const state = computeSubscriptionState(biz);

      if (state.status === 'LOCKED' && biz.subscription_status !== 'LOCKED') {
        await client.query(`UPDATE businesses SET subscription_status = 'LOCKED' WHERE id = $1`, [biz.id]);
        lockedCount++;
      } else if (state.status === 'GRACE_PERIOD' && biz.subscription_status !== 'GRACE_PERIOD') {
        await client.query(`UPDATE businesses SET subscription_status = 'GRACE_PERIOD' WHERE id = $1`, [biz.id]);
        graceCount++;
      } else if (state.status === 'EXPIRED') {
        const { purgedTokens } = await purgeExpiredBusinessData(client, biz.id);
        purgedCount++;
        totalPurgedTokens += purgedTokens;
      } else if (state.status === 'ACTIVE') {
        activeCount++;
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalBusinesses: businesses.length,
        active: activeCount,
        gracePeriod: graceCount,
        locked: lockedCount,
        purgedBusinesses: purgedCount,
        totalPurgedTokens,
      },
    });
  } catch (error: any) {
    console.error('Subscription Cron Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Subscription cron failed' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
