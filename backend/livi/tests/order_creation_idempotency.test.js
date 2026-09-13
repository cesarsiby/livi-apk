import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const orders = fs.readFileSync(path.join(root, 'src', 'routes', 'orders.js'), 'utf8');
const httpUtils = fs.readFileSync(path.join(root, 'src', 'utils', 'http.js'), 'utf8');

// SESSION 26 — §25 du prompt maître (idempotence). idempotency_keys existe
// déjà et /:id/cancel l'utilise déjà ; la création de commande — la route
// la plus exposée à un double-tap ou un retry réseau, chaque tentative
// décrémentant le stock et créant sa propre ligne escrow indépendamment —
// ne l'utilisait pas. Le mécanisme est opt-in côté client (en-tête
// Idempotency-Key) ; ce test vérifie que l'intégration est présente et que
// la réponse rejouée serait identique à une réponse fraîche.

test('POST /orders now supports Idempotency-Key the same way /:id/cancel already does', () => {
  const createIdx = orders.indexOf("r.post('/',asyncHandler");
  const cancelIdx = orders.indexOf("r.post('/:id/cancel'");
  assert.ok(createIdx !== -1 && cancelIdx !== -1);
  const createBody = orders.slice(createIdx, cancelIdx); // everything up to the next route
  assert.match(createBody, /if \(await replayIdempotency\(req,res\)\) return;/);
  assert.match(createBody, /await saveIdempotency\(req,201,\{success:true,data:result,request_id:res\.locals\.requestId\}\);/);
});

test('the saved replay body is byte-identical in shape to what ok() produces, so a replayed response is indistinguishable from a fresh one', () => {
  assert.match(httpUtils, /res\.status\(status\)\.json\(\{success:true,data,request_id:res\.locals\.requestId\}\)/, 'ok() shape must still be {success,data,request_id} for this to hold — if it changes, the saved literal above must change with it');
});

test('a client that never sends Idempotency-Key sees no behavior change (replayIdempotency short-circuits on a falsy req.idempotencyKey)', () => {
  const middleware = fs.readFileSync(path.join(root, 'src', 'middleware', 'idempotency.js'), 'utf8');
  assert.match(middleware, /if\(!req\.idempotencyKey\) return null;/, 'must be a no-op, not throw or block, when the header is absent — this is what keeps the order-creation change purely additive');
});
