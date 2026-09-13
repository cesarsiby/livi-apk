export class StorageProviderAdapter {
  constructor(config={}) { this.config=config; }
  async put() { throw Object.assign(new Error('Object storage provider not configured'),{code:'EXTERNAL_PROVIDER_REQUIRED'}); }
  async delete() { throw Object.assign(new Error('Object storage provider not configured'),{code:'EXTERNAL_PROVIDER_REQUIRED'}); }
  async signedUrl() { throw Object.assign(new Error('Object storage provider not configured'),{code:'EXTERNAL_PROVIDER_REQUIRED'}); }
}
