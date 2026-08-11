import Razorpay from 'razorpay';
import crypto from 'node:crypto';
import env from '../../config/env.js';
import { PaymentGateway } from './PaymentGateway.js';

class RazorpayGateway extends PaymentGateway {
  get client() {
    if (!this._client) {
      this._client = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
    }
    return this._client;
  }

  async createOrder({ amount, currency = 'INR', receipt, notes }) {
    const order = await this.client.orders.create({
      amount: Math.round(amount * 100),
      currency,
      receipt,
      notes,
    });
    return { gatewayOrderId: order.id, amount, currency: order.currency, raw: order };
  }

  async verifyPayment({ gatewayOrderId, gatewayPaymentId, signature }) {
    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${gatewayOrderId}|${gatewayPaymentId}`)
      .digest('hex');
    return expectedSignature === signature;
  }

  getPublicConfig() {
    return { keyId: env.RAZORPAY_KEY_ID };
  }
}

export default new RazorpayGateway();
