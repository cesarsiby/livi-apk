import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

// SESSION 26 — audit croisé backend+frontend simultané (§28-30, §52 du
// prompt maître). routes/delivery.js expose /:id/pickup-proof/verify et
// /:id/delivery-proof/verify, protégés par proofLimiter (20
// tentatives/10min) — mais le frontend n'appelle jamais ces routes-là
// (confirmé par recherche exhaustive de tout le code source frontend,
// pas seulement les appels apiRequest() directs). Le vrai chemin
// atteignable est /transporter/missions/:id/pickup et /deliver dans
// compatibility.js, qui appellent exactement les mêmes fonctions de
// service (verifyPickupProof/verifyDeliveryProof) mais n'avaient PAS
// proofLimiter, alors que le module l'importait déjà et l'utilisait sur
// deux autres routes du même fichier. Sans limite, rien n'empêchait de
// deviner un PIN acheteur par force brute sur le seul chemin réellement
// exposé.

test('the live (frontend-reachable) pickup/deliver proof routes carry proofLimiter, matching the unused delivery.js equivalent', () => {
  const compat = read('src', 'routes', 'compatibility.js');
  for (const action of ['pickup', 'deliver']) {
    const idx = compat.indexOf(`r.post('/transporter/missions/:id/${action}'`);
    assert.notEqual(idx, -1, `route for ${action} not found`);
    const body = compat.slice(idx, idx + 200);
    assert.match(body, /proofLimiter/, `/transporter/missions/:id/${action} must be rate-limited — it is the real, reachable PIN/QR verification endpoint`);
  }
});

test('delivery.js still has proofLimiter on its own (unused but not incorrect) equivalents, confirming this is the standard this fix now matches, not a new invention', () => {
  const delivery = read('src', 'routes', 'delivery.js');
  assert.match(delivery, /r\.post\('\/:id\/pickup-proof\/verify',proofLimiter/);
  assert.match(delivery, /r\.post\('\/:id\/delivery-proof\/verify',proofLimiter/);
});

test('both live and unused paths call the exact same underlying service functions (confirms this is genuinely a duplicate, not two different features)', () => {
  const compat = read('src', 'routes', 'compatibility.js');
  const delivery = read('src', 'routes', 'delivery.js');
  for (const fn of ['verifyPickupProof', 'verifyDeliveryProof']) {
    assert.match(compat, new RegExp(`await ${fn}\\(`));
    assert.match(delivery, new RegExp(`await ${fn}\\(`));
  }
});
