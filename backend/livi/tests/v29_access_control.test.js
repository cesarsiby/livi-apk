import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
// V46 fix: this test has always pointed at `backend/src`, a directory
// that has never existed in this project — the real application code has
// always lived under `src/` (only tests and docs live under `backend/`).
// This has been a known, documented, deferred pre-existing failure since
// V35 ("out of scope, unrelated to stock restitution"). V46 is the final
// production-readiness audit — leaving a known-broken test in the
// delivered test suite undermines confidence in the suite as a whole, and
// the fix is a trivial, safe, one-line path correction (verified: every
// individual assertion below still matches real, current content in the
// real src/ files — this was checked directly before changing the path,
// not assumed).
const root=path.resolve('src');

test('finance summary is admin-only',()=>{const s=fs.readFileSync(path.join(root,'routes/finance.js'),'utf8');assert.match(s,/r\.get\('\/summary',requireRoles\('admin'\)/)});
test('access token carries auth version',()=>{const s=fs.readFileSync(path.join(root,'services/auth.js'),'utf8');assert.match(s,/auth_version/);assert.match(s,/av:Number/)});
test('middleware rejects stale access token version',()=>{const s=fs.readFileSync(path.join(root,'middleware/auth.js'),'utf8');assert.match(s,/AUTH_SESSION_REVOKED/)});
test('vendor can list own orders',()=>{const s=fs.readFileSync(path.join(root,'routes/orders.js'),'utf8');assert.match(s,/req\.user\.role==='vendor'/);assert.match(s,/vendor_id=\$1/)});
test('admin KYC access token is explicitly role-bound',()=>{const s=fs.readFileSync(path.join(root,'routes/kyc.js'),'utf8');assert.match(s,/role:'admin'/)});
test('proof hashes use timing-safe comparison',()=>{const s=fs.readFileSync(path.join(root,'routes/delivery.js'),'utf8');assert.match(s,/timingSafeEqual/)});
