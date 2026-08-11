import AppError from '../utils/AppError.js';
import env from '../config/env.js';
import * as paymentRepository from './paymentRepository.js';
import { getGateway } from './gateways/index.js';

export async function createOrder({ payableType, payableId, amount, currency = 'INR', receipt, notes }) {
  const paymentId = await paymentRepository.create({
    payable_type: payableType,
    payable_id: payableId,
    gateway: env.PAYMENT_GATEWAY,
    amount,
    currency,
    status: 'created',
    receipt,
  });

  const gateway = getGateway();
  const order = await gateway.createOrder({ amount, currency, receipt, notes });
  await paymentRepository.update(paymentId, { gateway_order_id: order.gatewayOrderId });

  const { keyId } = gateway.getPublicConfig();
  return { paymentId, gatewayOrderId: order.gatewayOrderId, amount, currency: order.currency, keyId };
}

export async function verifyAndCapture({ gatewayOrderId, gatewayPaymentId, signature }) {
  const payment = await paymentRepository.findByGatewayOrderId(gatewayOrderId);
  if (!payment) {
    throw new AppError('Payment order not found.', 404);
  }

  const gateway = getGateway();
  const isValid = await gateway.verifyPayment({ gatewayOrderId, gatewayPaymentId, signature });

  await paymentRepository.update(payment.id, {
    gateway_payment_id: gatewayPaymentId,
    status: isValid ? 'paid' : 'failed',
  });

  if (!isValid) {
    throw new AppError('Payment verification failed.', 400);
  }

  return paymentRepository.findById(payment.id);
}
