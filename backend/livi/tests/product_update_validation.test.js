import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const compat = fs.readFileSync(path.join(root, 'src', 'routes', 'compatibility.js'), 'utf8');

// SESSION 26 — §18-19 du prompt maître (audit complet des produits). La
// création valide déjà tout via Zod ; la modification (PUT) prenait
// req.body brut sans validation applicative — un prix négatif ou un statut
// invalide n'était rattrapé qu'au niveau de la contrainte DB
// (price_xof>0, stock>=0, status IN(...) — migrations/001_initial.sql),
// ressortant en 500 générique plutôt qu'en 422 clair. Les contraintes DB
// elles-mêmes n'ont jamais laissé passer de donnée invalide — ce correctif
// est une question de qualité d'erreur (§14-15), pas d'intégrité des
// données, qui était déjà garantie.

function routeBody(name, len = 1200) {
  const idx = compat.indexOf(name);
  assert.notEqual(idx, -1, `route ${name} not found`);
  return compat.slice(idx, idx + len);
}

test('PUT /vendor/products/:id validates its input the same way POST does, not raw req.body', () => {
  const body = routeBody("r.put('/vendor/products/:id'");
  assert.match(body, /z\.object\(\{name:z\.string\(\)\.min\(2\)\.optional\(\)/, 'must reuse the same shape as the creation schema, with every field optional for a partial update');
  assert.match(body, /price_xof:z\.number\(\)\.int\(\)\.positive\(\)\.optional\(\)/);
  assert.match(body, /stock:z\.number\(\)\.int\(\)\.nonnegative\(\)\.optional\(\)/);
  assert.match(body, /status:z\.enum\(\['draft','active','paused','archived'\]\)\.optional\(\)/);
  assert.match(body, /\.parse\(req\.body\|\|\{\}\)/);
});

test('POST /vendor/products still converts a slug collision into 409 PRODUCT_SLUG_ALREADY_EXISTS, not 500 (unchanged by this session, re-verified)', () => {
  const body = routeBody("r.post('/vendor/products'", 1800);
  assert.match(body, /if\(e\.code==='23505'\) throw new HttpError\(409,'[^']+','PRODUCT_SLUG_ALREADY_EXISTS'\);/);
});

test('the DB-level guarantees this validation now mirrors actually exist (belt and suspenders, not a replacement for one another)', () => {
  const migration = fs.readFileSync(path.join(root, 'migrations', '001_initial.sql'), 'utf8');
  assert.match(migration, /price_xof bigint NOT NULL CHECK\(price_xof>0\)/);
  assert.match(migration, /stock integer NOT NULL DEFAULT 0 CHECK\(stock>=0\)/);
  assert.match(migration, /status varchar\(20\) NOT NULL DEFAULT 'active' CHECK\(status IN \('draft','active','paused','archived'\)\)/);
});
