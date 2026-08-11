import env from '../../config/env.js';
import razorpayGateway from './razorpayGateway.js';

const gateways = {
  razorpay: razorpayGateway,
};

export function getGateway() {
  const gateway = gateways[env.PAYMENT_GATEWAY];
  if (!gateway) {
    throw new Error(`Unknown payment gateway: ${env.PAYMENT_GATEWAY}`);
  }
  return gateway;
}
