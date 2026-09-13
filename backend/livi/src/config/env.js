import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  UPLOAD_DIR: z.string().default('./storage'),
  DEV_OTP: z.string().length(6).default('123456'),
  PAYMENT_WEBHOOK_SECRET: z.string().default(''),
  LIVI_PROOF_ENCRYPTION_KEY: z.string().default(''),
  FILE_ACCESS_SECRET: z.string().default(''),
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(12),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  // V45 — staging environment preparation finding: NODE_ENV is a binary
  // switch (production vs everything else). `production` enables real
  // strict behavior (random OTP requiring a real SMS provider, the dev
  // payment-confirm shortcut disabled requiring a real partner webhook,
  // strict secret validation, HSTS). Anything else gets DEV_OTP printed to
  // logs and the dev payment-confirm route enabled. A staging deployment
  // needs BOTH: production-grade secret strictness and HTTPS enforcement
  // (staging should not be weaker than production on security), AND the
  // ability to actually log in and simulate a paid order end-to-end
  // without a live SMS/payment-provider integration, which — per the
  // project's own stated scope — is not wired up yet.
  //
  // Rather than adding a third NODE_ENV value (a change with wide blast
  // radius across every `NODE_ENV==='production'` check in the codebase,
  // several of which are load-bearing security checks that must not be
  // weakened by accident), this adds a single, narrowly-scoped, explicit
  // opt-in flag — the same pattern already used for
  // ALLOW_LIVI_CONCURRENCY_TEST in the V35-V43 scripts. It defaults to
  // false and must never be set in real production; see
  // docs/V45_STAGING_ENVIRONMENT.md.
  ALLOW_STAGING_TEST_HELPERS: z.enum(['true','false']).default('false')
});

if (process.env.NODE_ENV === 'production') {
  if (!process.env.PAYMENT_WEBHOOK_SECRET || process.env.PAYMENT_WEBHOOK_SECRET.length < 32) throw new Error('PAYMENT_WEBHOOK_SECRET must be configured in production');
  if (!process.env.LIVI_PROOF_ENCRYPTION_KEY) throw new Error('LIVI_PROOF_ENCRYPTION_KEY must be configured in production');
  if (!process.env.FILE_ACCESS_SECRET || process.env.FILE_ACCESS_SECRET.length < 32) throw new Error('FILE_ACCESS_SECRET must be configured in production');
  if (!process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS.split(',').some(v => !/^https:\/\//i.test(v.trim()))) throw new Error('ALLOWED_ORIGINS must contain HTTPS origins in production');
}
export const env = schema.parse(process.env);
export const allowStagingTestHelpers = env.NODE_ENV !== 'production' || env.ALLOW_STAGING_TEST_HELPERS === 'true';
if (env.NODE_ENV === 'production' && env.ALLOW_STAGING_TEST_HELPERS === 'true') {
  // Loud, impossible-to-miss warning rather than a silent flag — this
  // disables the real-OTP and real-payment-confirm-only guarantees that
  // NODE_ENV=production otherwise provides.
  console.warn(JSON.stringify({
    level: 'warn',
    type: 'staging_test_helpers_enabled',
    message: 'ALLOW_STAGING_TEST_HELPERS=true with NODE_ENV=production — DEV_OTP and the dev payment-confirm route are ACTIVE. This must never be set on a real production deployment.'
  }));
}

// V-AUDIT (section 33 — KYC storage durability). UPLOAD_DIR is a local
// filesystem path (multer `dest`, see routes/compatibility.js and
// services/privateFileAccess.js). Confirmed: no object-storage dependency
// exists anywhere in package.json, no S3/Supabase-Storage/R2 client is
// wired up anywhere in this codebase. On Render (and most PaaS platforms)
// without an explicitly-provisioned persistent disk, the local filesystem
// does not survive a redeploy, restart, or scale event — every KYC
// document uploaded would be lost from disk on the next deploy while its
// row in kyc_documents (and any admin approval already recorded against
// it) stays in the database, pointing at a file that no longer exists.
// No fake 's3'/'r2' toggle is offered here: none of those are actually
// implemented, and a selectable-but-nonfunctional option would be worse
// than an honest, loud warning — see docs/KYC_STORAGE_DURABILITY.md for
// the concrete migration path (Supabase Storage is the natural first
// choice: same provider as the database, no new vendor relationship).
if (env.NODE_ENV === 'production') {
  console.warn(JSON.stringify({
    level: 'warn',
    type: 'kyc_storage_not_durable',
    message: `File storage (UPLOAD_DIR=${env.UPLOAD_DIR}) is local filesystem, not durable object storage. KYC documents will be LOST on the next redeploy/restart unless this instance has a persistent disk explicitly provisioned. See docs/KYC_STORAGE_DURABILITY.md before going live with real KYC submissions.`
  }));
}
