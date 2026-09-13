import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { HttpError } from '../utils/http.js'; import { safeCompareHex } from '../middleware/security.js';

const TTL_MINUTES = 24 * 60;
// token_hint (shipment_proofs) is intentionally left NULL below: it used to be
// populated with the first 2 digits of the PIN, which — despite its name —
// had nothing to do with the token, and would have leaked part of the PIN's
// entropy to anything that ever read the column. Nothing reads it today; if a
// genuine hint is needed later, populate it deliberately rather than reusing
// this field for PIN data.
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const hashPin = pin => bcrypt.hashSync(String(pin), 12);
const verifyPin = async (pin, storedHash) => {
  if (!storedHash) return false;
  const value = String(storedHash).trim();
  if (value.startsWith('$2a$') || value.startsWith('$2b$') || value.startsWith('$2y$')) return bcrypt.compare(String(pin), value);
  return safeCompareHex(hash(pin), value);
};
const proofKey = () => {
  const raw = process.env.LIVI_PROOF_ENCRYPTION_KEY;
  if (!raw) throw new Error('LIVI_PROOF_ENCRYPTION_KEY is required');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('LIVI_PROOF_ENCRYPTION_KEY must decode to 32 bytes');
  return key;
};
const encryptSecret = secret => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', proofKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return { ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
};
const decryptSecret = row => {
  const decipher = crypto.createDecipheriv('aes-256-gcm', proofKey(), Buffer.from(row.secret_iv, 'base64'));
  decipher.setAuthTag(Buffer.from(row.secret_tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(row.secret_ciphertext, 'base64')), decipher.final()]).toString('utf8');
};
const randomToken = () => crypto.randomBytes(32).toString('base64url');
const pinFromToken = token => String(parseInt(crypto.createHash('sha256').update(token).digest('hex').slice(0, 12), 16) % 1000000).padStart(6, '0');

export function makeProofSecret() {
  const token = randomToken();
  return { token, pin: pinFromToken(token), tokenHash: hash(token) };
}

export function qrPayload({ proofId, token }) {
  return JSON.stringify({ v: 1, app: 'LIVI', proof_id: proofId, token });
}

export async function createProofs(c, shipmentId, { expiresMinutes = TTL_MINUTES } = {}) {
  const expiresAt = new Date(Date.now() + expiresMinutes * 60_000);
  const results = {};
  for (const type of ['seller_pickup', 'buyer_delivery']) {
    const existing = (await c.query(
      `SELECT id,expires_at,used_at,revoked_at,secret_ciphertext,secret_iv,secret_tag
       FROM shipment_proofs WHERE shipment_id=$1 AND proof_type=$2 FOR UPDATE`,
      [shipmentId, type]
    )).rows[0];

    if (existing && !existing.used_at && !existing.revoked_at && new Date(existing.expires_at).getTime() > Date.now()) {
      const token = decryptSecret(existing);
      const pin = pinFromToken(token);
      results[type] = { proofId: existing.id, pin, token, qrPayload: qrPayload({ proofId: existing.id, token }), expiresAt: existing.expires_at };
      continue;
    }

    const secret = makeProofSecret();
    const encrypted = encryptSecret(secret.token);
    const row = existing
      ? (await c.query(
          `UPDATE shipment_proofs SET token_hash=$3,token_hint=$4,pin_hash=$5,secret_ciphertext=$6,secret_iv=$7,secret_tag=$8,expires_at=$9,used_at=NULL,used_by=NULL,revoked_at=NULL,attempts=0
           WHERE id=$1 AND shipment_id=$2 RETURNING id,proof_type,expires_at`,
          [existing.id, shipmentId, secret.tokenHash, null, hashPin(secret.pin), encrypted.ciphertext, encrypted.iv, encrypted.tag, expiresAt]
        )).rows[0]
      : (await c.query(
          `INSERT INTO shipment_proofs(shipment_id,proof_type,token_hash,token_hint,pin_hash,secret_ciphertext,secret_iv,secret_tag,expires_at)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,proof_type,expires_at`,
          [shipmentId, type, secret.tokenHash, null, hashPin(secret.pin), encrypted.ciphertext, encrypted.iv, encrypted.tag, expiresAt]
        )).rows[0];
    results[type] = { proofId: row.id, pin: secret.pin, token: secret.token, qrPayload: qrPayload({ proofId: row.id, token: secret.token }), expiresAt: row.expires_at };
  }
  return results;
}

export async function consumeProof(c, { shipmentId, proofType, credential, actorId, requestId, ip, userAgent }) {
  let proofId = null;
  let token = credential;
  try {
    const parsed = JSON.parse(credential);
    if (parsed?.app === 'LIVI' && parsed.proof_id && parsed.token) { proofId = parsed.proof_id; token = parsed.token; }
  } catch { /* plain PIN/token */ }

  const q = proofId
    ? 'SELECT * FROM shipment_proofs WHERE id=$1 AND shipment_id=$2 AND proof_type=$3 FOR UPDATE'
    : 'SELECT * FROM shipment_proofs WHERE shipment_id=$1 AND proof_type=$2 FOR UPDATE';
  const params = proofId ? [proofId, shipmentId, proofType] : [shipmentId, proofType];
  const proof = (await c.query(q, params)).rows[0];
  if (!proof) throw new HttpError(422, 'Preuve de validation introuvable', 'PROOF_NOT_FOUND');

  const event = async result => c.query(
    `INSERT INTO shipment_proof_events(proof_id,shipment_id,actor_user_id,result,request_id,ip_address,user_agent) VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [proof.id, shipmentId, actorId, result, requestId || null, ip || null, userAgent || null]
  );

  if (proof.revoked_at) { await event('revoked'); throw new HttpError(409, 'Code révoqué', 'PROOF_REVOKED'); }
  if (proof.used_at) { await event('replayed'); throw new HttpError(409, 'Code déjà utilisé', 'PROOF_ALREADY_USED'); }
  if (new Date(proof.expires_at).getTime() <= Date.now()) { await event('expired'); throw new HttpError(409, 'Code expiré', 'PROOF_EXPIRED'); }
  if (proof.attempts >= proof.max_attempts) { await event('attempt_limit'); throw new HttpError(429, 'Nombre maximal de tentatives atteint', 'PROOF_ATTEMPTS_EXCEEDED'); }

  const supplied = String(credential).trim();
  const valid = proofId ? safeCompareHex(hash(token), proof.token_hash) : (await verifyPin(supplied, proof.pin_hash)) || safeCompareHex(hash(supplied), proof.token_hash);
  if (!valid) {
    await c.query('UPDATE shipment_proofs SET attempts=attempts+1 WHERE id=$1', [proof.id]);
    await event('invalid');
    throw new HttpError(422, 'Code/QR invalide', 'PROOF_INVALID');
  }

  await c.query('UPDATE shipment_proofs SET used_at=now(),used_by=$2 WHERE id=$1', [proof.id, actorId]);
  await event('success');
  return proof;
}

export async function getActiveProof(c, { shipmentId, proofType }) {
  const row = (await c.query(
    `SELECT id,expires_at,used_at,revoked_at,secret_ciphertext,secret_iv,secret_tag
     FROM shipment_proofs WHERE shipment_id=$1 AND proof_type=$2 FOR UPDATE`,
    [shipmentId, proofType]
  )).rows[0];
  if (!row || row.used_at || row.revoked_at || new Date(row.expires_at).getTime() <= Date.now()) {
    throw new HttpError(409, 'Preuve indisponible ou expirée', 'PROOF_UNAVAILABLE');
  }
  const token = decryptSecret(row);
  const pin = pinFromToken(token);
  return { proofId: row.id, pin, token, qrPayload: qrPayload({ proofId: row.id, token }), expiresAt: row.expires_at };
}

export async function rotateProof(c, { shipmentId, proofType, expiresMinutes = TTL_MINUTES }) {
  const secret = makeProofSecret();
  const encrypted = encryptSecret(secret.token);
  const expiresAt = new Date(Date.now() + expiresMinutes * 60_000);
  const row = (await c.query(
    `UPDATE shipment_proofs SET token_hash=$3,pin_hash=$4,token_hint=$5,secret_ciphertext=$6,secret_iv=$7,secret_tag=$8,expires_at=$9,used_at=NULL,used_by=NULL,revoked_at=NULL,attempts=0
     WHERE shipment_id=$1 AND proof_type=$2 RETURNING id,expires_at`,
    [shipmentId, proofType, secret.tokenHash, hashPin(secret.pin), null, encrypted.ciphertext, encrypted.iv, encrypted.tag, expiresAt]
  )).rows[0];
  if (!row) throw new HttpError(404, 'Preuve non disponible');
  return { proofId: row.id, pin: secret.pin, qrPayload: qrPayload({ proofId: row.id, token: secret.token }), expiresAt: row.expires_at };
}
