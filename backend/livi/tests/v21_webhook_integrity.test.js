import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'routes', 'webhooks.js'), 'utf8');

// SESSION 26 — les 5 tests originaux de ce fichier ne vérifiaient aucun
// import réel de webhooks.js : `assert.equal('quarantined','quarantined')`
// et `assert.equal(key,key)` sont vrais indépendamment de tout code, donc
// passent même si la route entière est cassée ou supprimée. Réécrits pour
// vérifier le texte source réel de la route (signature, séquence de
// vérifications, idempotence) — même limite que les autres tests
// source-level de ce backend : aucun serveur HTTP ni base réelle dans ce
// sandbox pour un test d'intégration bout-en-bout.

function sign(raw, secret){ return crypto.createHmac('sha256',secret).update(raw).digest('hex'); }

test('webhook signature: HMAC-SHA256, deterministic, timing-safe comparison', () => {
  const raw=JSON.stringify({id:'evt-1',type:'payment.succeeded',amount:'102000'});
  assert.equal(sign(raw,'secret').length,64);
  assert.equal(sign(raw,'secret'),sign(raw,'secret'));
  assert.notEqual(sign(raw,'secret'),sign(raw,'wrong'));
  assert.match(src, /crypto\.timingSafeEqual\(a,b\)/, 'must use a constant-time comparison, not === (timing side-channel)');
  assert.match(src, /createHmac\('sha256',env\.PAYMENT_WEBHOOK_SECRET\)/);
});

test('signature is enforced in production; a missing secret never silently validates', () => {
  assert.match(src, /if\(!env\.PAYMENT_WEBHOOK_SECRET \|\| !signature\) return false;/, 'an unconfigured secret or absent header must fail closed, not be treated as valid');
  assert.match(src, /if\(!valid && env\.NODE_ENV==='production'\) throw new HttpError\(401,/);
});

test('amount mismatch is quarantined, not credited (real comparison against escrow amount+shipping_fee)', () => {
  assert.match(src, /const expected=BigInt\(e\.amount\)\+BigInt\(e\.shipping_fee\);/, 'must use BigInt, not float, for a monetary comparison');
  assert.match(src, /if\(amount!==expected\)\{[\s\S]{0,120}status='quarantined',processing_error=\$2/, 'a mismatched amount must be quarantined for manual reconciliation, never auto-credited');
});

test('a payment.succeeded received after local cancellation/refund is quarantined, never funds escrow', () => {
  assert.match(src, /\['cancelled','refunded'\]\.includes\(e\.order_status\)/);
  assert.match(src, /processing_error='late_success_after_state_change'/);
});

test('an already-funded escrow receiving a second payment.succeeded is marked duplicate, not re-credited', () => {
  assert.match(src, /if\(e\.status==='funded'\)\{[\s\S]{0,100}status='duplicate'/);
});

test('unsupported event types are quarantined rather than silently processed', () => {
  const supported=['payment.succeeded','payment.failed','payment.cancelled','payment.expired'];
  assert.equal(supported.includes('refund.succeeded'),false);
  assert.match(src, /\['payment\.succeeded','payment\.failed','payment\.cancelled','payment\.expired'\]\.includes\(type\)/);
});

test('sequential duplicate delivery of the same (provider,event_id) is idempotent via the existing-row check', () => {
  assert.match(src, /SELECT id,processed_at,status FROM partner_payment_events WHERE provider=\$1 AND event_id=\$2 FOR UPDATE/);
  assert.match(src, /if\(existing\) return \{duplicate:true,processed:!!existing\.processed_at,status:existing\.status\};/);
});

test('genuinely concurrent duplicate delivery of a brand-new (provider,event_id) is also idempotent, not a raw 500 (SESSION 26 fix)', () => {
  // SELECT...FOR UPDATE cannot lock a row that does not exist yet, so two
  // truly simultaneous deliveries of a new event_id can both read
  // existing=undefined before either has inserted. UNIQUE(provider,event_id)
  // (migrations/001_initial.sql) still prevents a double financial credit —
  // but without catching the resulting 23505, the losing request surfaced
  // as {code:"23505", message:"Erreur interne du serveur"} (server.js's
  // generic handler: err.status is undefined on a raw pg error, so it
  // falls through to 500 with err.code passed straight through) instead of
  // the same {duplicate:true} response the sequential case gets above —
  // a payment provider would see a failure for an event that was in fact
  // processed correctly, once, by the other request.
  assert.match(src, /catch\(insertErr\)\{\s*if\(insertErr\?\.code==='23505'\)/, 'the insert must catch a unique-violation race and re-read the row, not let it bubble up as a generic 500');
  assert.match(src, /const race=\(await c\.query\(`SELECT id,processed_at,status FROM partner_payment_events WHERE provider=\$1 AND event_id=\$2`,\[provider,id\]\)\)\.rows\[0\];/);
  assert.match(src, /if\(race\) return \{duplicate:true,processed:!!race\.processed_at,status:race\.status\};/);
});

test('the migration this fix depends on actually declares the unique constraint', () => {
  const migration = fs.readFileSync(path.resolve(__dirname, '..', 'migrations', '001_initial.sql'), 'utf8');
  assert.match(migration, /CREATE TABLE partner_payment_events\([^;]*UNIQUE\(provider,event_id\)/);
});
