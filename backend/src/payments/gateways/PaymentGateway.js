export class PaymentGateway {
  async createOrder(_params) {
    throw new Error('createOrder() not implemented');
  }

  async verifyPayment(_params) {
    throw new Error('verifyPayment() not implemented');
  }

  getPublicConfig() {
    throw new Error('getPublicConfig() not implemented');
  }
}
