'use client';

export interface CheckoutOptions {
  amount: number;
  paymentType: 'ONBOARDING_INITIAL' | 'MONTHLY_RENEWAL';
  streamId?: string;
  businessId?: string;
  businessName?: string;
  customerPhone?: string;
  onSuccess: (data: any) => void;
  onError?: (err: any) => void;
}

/**
 * Loads the Razorpay checkout script on demand.
 */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.warn('Failed to load external Razorpay checkout.js script');
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

/**
 * Launches the official Razorpay checkout modal.
 */
export async function openRazorpayCheckout(options: CheckoutOptions): Promise<void> {
  try {
    // 1. Create order on backend
    const orderRes = await fetch('/api/subscription/razorpay/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        streamId: options.streamId,
        businessId: options.businessId,
        amount: options.amount,
        paymentType: options.paymentType,
      }),
    });

    const orderData = await orderRes.json();
    if (!orderRes.ok || !orderData.success) {
      throw new Error(orderData.error || 'Failed to generate payment order');
    }

    // If sandbox / simulated mode (no live Razorpay API keys configured in environment yet)
    if (orderData.isMock || !orderData.keyId || orderData.keyId === 'rzp_test_placeholder') {
      // Direct verification simulation
      const verifyRes = await fetch('/api/subscription/razorpay/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpayOrderId: orderData.order.id,
          razorpayPaymentId: `pay_mock_${Date.now()}`,
          razorpaySignature: 'mock_sig_valid',
          streamId: options.streamId,
          businessId: options.businessId,
          amount: options.amount,
          paymentType: options.paymentType,
        }),
      });

      const verifyData = await verifyRes.json();
      if (verifyRes.ok && verifyData.success) {
        options.onSuccess(verifyData);
      } else {
        throw new Error(verifyData.error || 'Simulated payment verification failed');
      }
      return;
    }

    // 2. Load script and open real Razorpay modal
    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded || !(window as any).Razorpay) {
      throw new Error('Could not load Razorpay payment gateway interface');
    }

    const rzpOptions = {
      key: orderData.keyId,
      amount: orderData.order.amount,
      currency: orderData.order.currency,
      name: 'noQ Virtual Queue Engine',
      description: options.paymentType === 'ONBOARDING_INITIAL' ? 'Setup + 1st Month Plan' : 'Monthly Terminal Renewal',
      order_id: orderData.order.id,
      prefill: {
        contact: options.customerPhone || '',
      },
      theme: {
        color: '#10b981', // Emerald theme
      },
      handler: async function (response: any) {
        try {
          const verifyRes = await fetch('/api/subscription/razorpay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              streamId: options.streamId,
              businessId: options.businessId,
              amount: options.amount,
              paymentType: options.paymentType,
            }),
          });

          const verifyData = await verifyRes.json();
          if (verifyRes.ok && verifyData.success) {
            options.onSuccess(verifyData);
          } else {
            throw new Error(verifyData.error || 'Payment signature verification failed');
          }
        } catch (err: any) {
          if (options.onError) options.onError(err);
          else alert(err.message || 'Payment verification failed');
        }
      },
      modal: {
        ondismiss: function () {
          console.log('Payment modal dismissed by user');
        },
      },
    };

    const rzp = new (window as any).Razorpay(rzpOptions);
    rzp.open();
  } catch (err: any) {
    console.error('Checkout error:', err);
    if (options.onError) {
      options.onError(err);
    } else {
      alert(err.message || 'Payment initiation failed');
    }
  }
}
