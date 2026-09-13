export class PaymentProviderAdapter {
  constructor(config={}) { this.config=config; }
  async createHold() { throw Object.assign(new Error('Payment provider not configured'),{code:'PARTNER_PAYMENT_REQUIRED'}); }
  async release() { throw Object.assign(new Error('Payment provider not configured'),{code:'PARTNER_PAYMENT_REQUIRED'}); }
  async refund() { throw Object.assign(new Error('Payment provider not configured'),{code:'PARTNER_PAYMENT_REQUIRED'}); }
  verifyWebhook() { throw Object.assign(new Error('Payment provider not configured'),{code:'PARTNER_PAYMENT_REQUIRED'}); }
}
