import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const frontendSrc = path.resolve(__dirname, '..', '..', '..', 'frontend', 'livi', 'src');
const readBackend = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const readFrontend = (...p) => fs.readFileSync(path.join(frontendSrc, ...p), 'utf8');

// V-AUDIT (section 49 — API response contract). GET /vendor/orders/:id does
// `SELECT o.*` from `orders`, whose real column is total_amount — there is
// no "total" column anywhere in the schema (confirmed against
// migrations/001_initial.sql). SellerOrderDetailsScreen read `order.total`
// directly with a `?? 0` fallback, so it silently showed "0 FCFA" for
// every order, every time — the same bug class as the item.price/price_xof
// mismatch already fixed in an earlier session (V54 catalogue pricing).
// The same endpoint also never included order line items at all, unlike
// the buyer-side GET /orders/:id — a vendor accepting/preparing an order
// had no way to see what to actually prepare.

test('orders table has no "total" column — total_amount is the real field (regression guard on the bug itself, not just the fix)', () => {
  const schema = readBackend('migrations', '001_initial.sql');
  const ordersTable = schema.match(/CREATE TABLE orders\(([^;]+)\);/)?.[1] ?? '';
  assert.match(ordersTable, /total_amount/);
  assert.doesNotMatch(ordersTable, /[^_]total\s/, 'a bare "total" column must not exist — if this ever fails, order.total would start working by coincidence and mask the underlying contract issue');
});

test('SellerOrderDetailsScreen reads total_amount first, not just total', () => {
  // SESSION 26 — RÉCONCILIATION DE BRANCHES : ce test datait de la branche
  // d'audit numérotée, où l'écran formatait le montant lui-même avec un
  // repli explicite `?? 0`. Fusionné sur la base LIVI 2.0
  // (RAPPORT_UXUI_SESSION21), l'écran délègue désormais le formatage au
  // composant central <Money> (constat C9 — un seul formateur monétaire
  // pour toute l'app, voir Money.tsx). Money.formatMoney() applique déjà
  // `Number(amount ?? 0)` en interne, donc `?? 0` après `order.total` ici
  // serait une redondance, pas une garde manquante — vérifié directement
  // dans design/components/Money.tsx avant de changer ce test.
  const screen = readFrontend('screens', 'seller', 'SellerOrderDetailsScreen.tsx');
  assert.match(screen, /order\.total_amount\s*\?\?\s*order\.total/, 'must still read total_amount first, falling back to total');
  const money = readFrontend('design', 'components', 'Money.tsx');
  assert.match(money, /Number\(amount\s*\?\?\s*0\)/, 'confirms <Money> is the one actually guaranteeing the ?? 0 floor, not a redundant duplicate in every screen (that duplication is exactly what C9 removed)');
});

test('GET /vendor/orders/:id now includes items with product names, mirroring GET /orders/:id', () => {
  const compat = readBackend('src', 'routes', 'compatibility.js');
  const idx = compat.indexOf("r.get('/vendor/orders/:id'");
  assert.notEqual(idx, -1);
  const body = compat.slice(idx, idx + 700);
  assert.match(body, /json_build_object\('id',oi\.id,'product_id',oi\.product_id,'product_name',p\.name,'quantity',oi\.quantity,'unit_price',oi\.unit_price,'total_price',oi\.total_price\)/);
  assert.match(body, /JOIN products p ON p\.id=oi\.product_id/);
});

test('SellerOrderDetailsScreen renders the items list', () => {
  const screen = readFrontend('screens', 'seller', 'SellerOrderDetailsScreen.tsx');
  assert.match(screen, /order\.items\?\.length/);
  assert.match(screen, /it\.product_name/);
  assert.match(screen, /it\.quantity/);
});

test('SellerOrder type declares total_amount and a properly-typed items array (was `any[]`)', () => {
  const api = readFrontend('features', 'seller', 'sellerApi.ts');
  assert.match(api, /total_amount\?:number/);
  assert.match(api, /items\?:SellerOrderItem\[\]/);
});
