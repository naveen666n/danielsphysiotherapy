let scriptPromise = null;

function loadCheckoutScript() {
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load the payment checkout. Check your connection and try again.'));
    document.body.appendChild(script);
  });

  return scriptPromise;
}

export async function openCheckout({ keyId, gatewayOrderId, amount, currency, name, description, prefill }) {
  await loadCheckoutScript();

  return new Promise((resolve, reject) => {
    const razorpay = new window.Razorpay({
      key: keyId,
      order_id: gatewayOrderId,
      amount: Math.round(amount * 100),
      currency,
      name,
      description,
      prefill,
      handler: (response) => {
        resolve({
          gatewayOrderId: response.razorpay_order_id,
          gatewayPaymentId: response.razorpay_payment_id,
          signature: response.razorpay_signature,
        });
      },
      modal: {
        ondismiss: () => reject(new Error('Payment was cancelled.')),
      },
    });

    razorpay.on('payment.failed', (response) => {
      reject(new Error(response.error?.description || 'Payment failed. Please try again.'));
    });

    razorpay.open();
  });
}
