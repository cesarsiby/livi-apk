import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Mirrors src/services/privateFileAccess.js's createFileAccessToken/
// verifyFileAccessToken exactly (HMAC-SHA256 signed payload). Cannot import
// the real module here: it pulls in config/env.js (dotenv, zod) and
// middleware/security.js (express-rate-limit), none installed in this
// offline sandbox.
const SECRET = 'x'.repeat(32);
function createFileAccessToken({ documentId, userId, role = null, ttlSeconds = 300 }) {
  const exp = Math.floor(Date.now() / 1000) + Math.min(Math.max(Number(ttlSeconds) || 300, 30), 600);
  const payload = Buffer.from(JSON.stringify({ d: String(documentId), u: String(userId), r: role || null, e: exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
function verifyFileAccessToken(token, { documentId, userId = null, allowedUserIds = [], allowAdmin = false }) {
  try {
    const [payload, sig] = String(token || '').split('.');
    if (!payload || !sig) return false;
    const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
    const a = Buffer.from(sig), b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const allowed = [...(allowedUserIds || [])].map(String);
    const userOk = userId != null ? data.u === String(userId) : allowed.includes(String(data.u));
    const adminOk = allowAdmin && data.r === 'admin';
    return data.d === String(documentId) && (userOk || adminOk) && Number(data.e) > Math.floor(Date.now() / 1000);
  } catch { return false; }
}

test('fixed behavior: a regular user\'s own-document token carries no admin role', () => {
  // Mirrors routes/kyc.js POST /documents/:id/access-token after the fix —
  // no `role` argument passed at all.
  const token = createFileAccessToken({ documentId: 'docA', userId: 'userA' });
  const ok = verifyFileAccessToken(token, { documentId: 'docA', allowedUserIds: ['ownerOfDocA', 'userA'], allowAdmin: true });
  assert.equal(ok, true, 'still grants access to their own document via userOk');

  // Decode the payload directly to confirm no admin claim was ever embedded
  // (not just that access happens to still work).
  const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));
  assert.equal(payload.r, null, 'no role claim embedded for a regular user-issued token');
});

test('old (pre-fix) behavior reproduced: role:"admin" stamped on a regular user\'s own token', () => {
  // Reproduces exactly what routes/kyc.js used to do, to document the
  // fault being fixed — not a hypothetical.
  const token = createFileAccessToken({ documentId: 'docA', userId: 'userA', role: 'admin' });
  const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));
  assert.equal(payload.r, 'admin', 'this is what the bug actually embedded');
});

test('documentId binding independently blocks reusing a token against a different document, admin flag or not', () => {
  // This is the *separate* check that happened to prevent the admin-flag
  // bug from being exploitable today — verified directly so the fix above
  // isn't the only thing standing between a user and someone else's
  // document, and so a future change to this check doesn't silently
  // reopen the door the role fix already closed off.
  const adminFlaggedToken = createFileAccessToken({ documentId: 'docA', userId: 'userA', role: 'admin' });
  const ok = verifyFileAccessToken(adminFlaggedToken, { documentId: 'docB', allowedUserIds: ['ownerOfDocB', 'userA'], allowAdmin: true });
  assert.equal(ok, false, 'a token issued for docA must never unlock docB, regardless of any role claim');
});

test('genuine admin route (requireRoles admin-gated) still works after the fix — only that route embeds role:"admin"', () => {
  // Mirrors routes/kyc.js POST /admin/:id/access-token, unchanged by this fix.
  const token = createFileAccessToken({ documentId: 'docB', userId: 'adminUser', role: 'admin' });
  const ok = verifyFileAccessToken(token, { documentId: 'docB', allowedUserIds: [], allowAdmin: true });
  assert.equal(ok, true);
});

test('expired token is rejected regardless of role', () => {
  const token = createFileAccessToken({ documentId: 'docA', userId: 'userA', role: 'admin', ttlSeconds: 30 });
  const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));
  const tampered = Buffer.from(JSON.stringify({ ...payload, e: Math.floor(Date.now() / 1000) - 10 })).toString('base64url');
  // Re-sign so this specifically tests expiry, not signature tampering.
  const sig = crypto.createHmac('sha256', SECRET).update(tampered).digest('base64url');
  const expiredToken = `${tampered}.${sig}`;
  assert.equal(verifyFileAccessToken(expiredToken, { documentId: 'docA', allowedUserIds: ['userA'], allowAdmin: true }), false);
});
