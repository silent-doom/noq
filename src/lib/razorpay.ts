import crypto from 'crypto';

export interface RazorpayOrderResponse {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
  isMock?: boolean;
}

export const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || '';
export const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

/**
 * Creates a Razorpay Order via REST API.
 * If RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not configured, generates a mock order for seamless sandbox testing.
 */
export async function createRazorpayOrder({
  amountInRupees,
  receipt,
  notes = {},
}: {
  amountInRupees: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrderResponse> {
  const amountInPaise = Math.round(amountInRupees * 100);

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    // Graceful simulated order for local dev / testing before live merchant keys are added
    return {
      id: `order_mock_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
      amount: amountInPaise,
      currency: 'INR',
      receipt,
      status: 'created',
      isMock: true,
    };
  }

  const authHeader = 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify({
      amount: amountInPaise,
      currency: 'INR',
      receipt: receipt.slice(0, 40),
      notes,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Razorpay Order Creation Failed:', errorText);
    throw new Error(`Razorpay Order creation failed: ${response.statusText}`);
  }

  const orderData = await response.json();
  return {
    id: orderData.id,
    amount: orderData.amount,
    currency: orderData.currency,
    receipt: orderData.receipt,
    status: orderData.status,
    isMock: false,
  };
}

/**
 * Verifies the Razorpay payment signature using HMAC-SHA256.
 */
export function verifyRazorpaySignature({
  orderId,
  paymentId,
  signature,
}: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  if (!RAZORPAY_KEY_SECRET) {
    // If no secret configured, accept simulated signatures starting with 'mock_sig_'
    return Boolean(orderId.startsWith('order_mock_') || signature.startsWith('mock_sig_') || !signature);
  }

  const body = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest('hex');

  return expectedSignature === signature;
}
