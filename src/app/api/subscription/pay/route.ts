import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { recordSubscriptionPayment, computeSubscriptionState } from '@/lib/subscription';

export async function POST(req: NextRequest) {
  const client = await db.connect();
  try {
    const body = await req.json();
    const { streamId, businessId, paymentMethod = 'ONLINE_CARD_UPI', transactionRef, amount } = body;

    let targetBizId = businessId;

    if (!targetBizId && streamId) {
      const sRes = await client.query(`SELECT business_id FROM queue_streams WHERE id = $1`, [streamId]);
      if (sRes.rows.length > 0) {
        targetBizId = sRes.rows[0].business_id;
      }
    }

    if (!targetBizId) {
      return NextResponse.json(
        { success: false, error: 'Business ID or Stream ID is required' },
        { status: 400 }
      );
    }

    const bRes = await client.query(`SELECT * FROM businesses WHERE id = $1`, [targetBizId]);
    if (bRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Business not found' },
        { status: 404 }
      );
    }

    const biz = bRes.rows[0];
    const payAmount = Number(amount) > 0 ? Number(amount) : Number(biz.monthly_fee) || 499.00;

    await client.query('BEGIN');
    const { payment, nextBillingDate } = await recordSubscriptionPayment(
      client,
      targetBizId,
      payAmount,
      'MONTHLY_RENEWAL',
      paymentMethod,
      transactionRef || `RENEW_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
      `Monthly Subscription Renewal for ${biz.name}`
    );
    await client.query('COMMIT');

    const updatedState = computeSubscriptionState({
      ...biz,
      subscription_status: 'ACTIVE',
      next_billing_date: nextBillingDate,
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription successfully renewed! Your terminal is active.',
      payment,
      subscription: updatedState,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Subscription Payment Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Payment processing failed' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
