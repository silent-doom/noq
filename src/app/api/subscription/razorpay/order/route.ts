import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createRazorpayOrder, RAZORPAY_KEY_ID } from '@/lib/razorpay';

export async function POST(req: NextRequest) {
  const client = await db.connect();
  try {
    const body = await req.json();
    const { streamId, businessId, amount, paymentType = 'MONTHLY_RENEWAL' } = body;

    let targetBizId = businessId;
    let bizName = 'noQ Client';

    if (!targetBizId && streamId) {
      const sRes = await client.query(
        `SELECT s.business_id, b.name FROM queue_streams s JOIN businesses b ON s.business_id = b.id WHERE s.id = $1`,
        [streamId]
      );
      if (sRes.rows.length > 0) {
        targetBizId = sRes.rows[0].business_id;
        bizName = sRes.rows[0].name;
      }
    } else if (targetBizId) {
      const bRes = await client.query(`SELECT name FROM businesses WHERE id = $1`, [targetBizId]);
      if (bRes.rows.length > 0) {
        bizName = bRes.rows[0].name;
      }
    }

    const payAmount = Number(amount) > 0 ? Number(amount) : paymentType === 'ONBOARDING_INITIAL' ? 2499 : 999;
    const receipt = `rcpt_${paymentType === 'ONBOARDING_INITIAL' ? 'init' : 'ren'}_${Date.now().toString().slice(-8)}`;

    const order = await createRazorpayOrder({
      amountInRupees: payAmount,
      receipt,
      notes: {
        businessId: targetBizId || 'PENDING_REGISTRATION',
        businessName: bizName,
        paymentType,
      },
    });

    return NextResponse.json({
      success: true,
      keyId: RAZORPAY_KEY_ID || 'rzp_test_placeholder',
      isMock: order.isMock,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      businessName: bizName,
    });
  } catch (error: any) {
    console.error('Razorpay Order API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to initialize payment order' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
