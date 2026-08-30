import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyRazorpaySignature } from '@/lib/razorpay';
import { recordSubscriptionPayment, computeSubscriptionState } from '@/lib/subscription';

export async function POST(req: NextRequest) {
  const client = await db.connect();
  try {
    const body = await req.json();
    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      streamId,
      businessId,
      amount,
      paymentType = 'MONTHLY_RENEWAL',
    } = body;

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

    // Verify HMAC-SHA256 signature
    const isValid = verifyRazorpaySignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId || `pay_mock_${Date.now()}`,
      signature: razorpaySignature || '',
    });

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid payment signature. Verification failed.' },
        { status: 400 }
      );
    }

    const bRes = await client.query(`SELECT * FROM businesses WHERE id = $1`, [targetBizId]);
    if (bRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
    }

    const biz = bRes.rows[0];
    const payAmount = Number(amount) > 0 ? Number(amount) : paymentType === 'ONBOARDING_INITIAL' ? 1499 : 599;

    await client.query('BEGIN');
    const { payment, nextBillingDate } = await recordSubscriptionPayment(
      client,
      targetBizId,
      payAmount,
      paymentType as any,
      'RAZORPAY_GATEWAY',
      razorpayPaymentId || `RZP_${razorpayOrderId || Date.now()}`,
      `Razorpay ${paymentType === 'ONBOARDING_INITIAL' ? 'Initial Setup' : 'Renewal'} for ${biz.name} (Order: ${razorpayOrderId})`
    );
    await client.query('COMMIT');

    const updatedState = computeSubscriptionState({
      ...biz,
      subscription_status: 'ACTIVE',
      next_billing_date: nextBillingDate,
    });

    return NextResponse.json({
      success: true,
      message: 'Payment verified successfully! Your subscription is now active.',
      payment,
      subscription: updatedState,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Razorpay Verify API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Payment verification failed' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
