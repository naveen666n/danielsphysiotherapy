import { openCheckout as razorpayOpenCheckout } from './razorpayAdapter.js';

const adapters = {
  razorpay: { openCheckout: razorpayOpenCheckout },
};

export function getPaymentAdapter(gateway = 'razorpay') {
  const adapter = adapters[gateway];
  if (!adapter) {
    throw new Error(`Unknown payment gateway: ${gateway}`);
  }
  return adapter;
}
