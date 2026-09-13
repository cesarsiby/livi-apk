export class PushProviderAdapter {
  constructor(config={}) { this.config=config; }
  async send() { throw Object.assign(new Error('Push provider not configured'),{code:'EXTERNAL_PROVIDER_REQUIRED'}); }
}
