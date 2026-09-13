export class SmsProviderAdapter {
  constructor(config={}) { this.config=config; }
  async send() { throw Object.assign(new Error('SMS provider not configured'),{code:'EXTERNAL_PROVIDER_REQUIRED'}); }
}
