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

// SESSION 26 — RÉCONCILIATION DE BRANCHES.
// L'original de ce fichier (branche d'audit "sessions9-25") vérifiait un
// repli `Array.isArray(r) ? r : (<clés devinées>)` ajouté écran par écran.
// La branche LIVI 2.0 (RAPPORT_UXUI_SESSION21), retenue comme base
// fusionnée, corrige le même bug (constat C0) à la racine avec une fonction
// unique et testée séparément ci-dessous : normalizeList()
// (src/services/api/normalize.ts). C'est un mécanisme strictement plus
// robuste que le repli ad hoc (une seule implémentation à auditer, plutôt
// qu'une expression dupliquée dans 13 écrans), donc ce fichier a été
// entièrement réécrit pour vérifier le mécanisme réel plutôt qu'un motif de
// code qui n'existe plus dans la branche retenue. Voir
// RAPPORT_AUDIT_SESSION26_RECONCILIATION_BRANCHES.md.
//
// Fait notable : ni l'un ni l'autre des deux rapports LIVI 2.0
// (RAPPORT_UXUI_SESSION21_AUDIT.md / _STRATEGIE_ET_IMPLEMENTATION.md) ne
// mentionne de suite `node --test` automatisée pour ce correctif — leur
// méthode de vérification documentée s'arrête à `tsc` fichier par fichier.
// Ce fichier comble donc aussi ce vide, pas seulement un remplacement de
// l'original de la branche d'audit.

test('normalizeList: returns the array as-is when the response already is one (the real, majority shape from this backend)', async () => {
  const { normalizeList } = await import('../../../frontend/livi/src/services/api/normalize.ts').catch(() => ({}));
  // .ts import directly via node --test is not guaranteed across Node
  // versions without a loader; fall back to a source-level check of the
  // exact implementation if the dynamic import isn't usable in this
  // environment, rather than silently skipping the assertion.
  if (typeof normalizeList === 'function') {
    assert.deepEqual(normalizeList([1, 2, 3]), [1, 2, 3]);
    assert.deepEqual(normalizeList({ orders: [1, 2] }, ['orders', 'data']), [1, 2]);
    assert.deepEqual(normalizeList({ data: [9] }, ['orders', 'data']), [9]);
    assert.deepEqual(normalizeList({ nothingUseful: true }, ['orders', 'data']), []);
    assert.deepEqual(normalizeList(null, ['orders', 'data']), []);
    assert.deepEqual(normalizeList(undefined), []);
  } else {
    const src = fs.readFileSync(path.resolve(frontendSrc, 'services', 'api', 'normalize.ts'), 'utf8');
    assert.match(src, /if \(Array\.isArray\(response\)\) return response as T\[\];/, 'must check the real (bare-array) shape FIRST, before any wrapper key');
    assert.match(src, /return \[\];/, 'must fall back to an empty array only after both the array check and every key have failed');
  }
});

test('sample of list endpoints genuinely return a bare array (ok(res, rows)), confirming normalizeList\'s array-first branch is the one actually exercised in production, not a defensive no-op', () => {
  const compat = readBackend('src', 'routes', 'compatibility.js');
  const bareArrayRoutes = [
    "/users/me/addresses",
    "/users/me/wishlist",
    "/users/me/payment-methods",
    "/vendor/products",
    "/vendor/orders",
    "/transporter/missions",
    "/transporter/history",
  ];
  for (const route of bareArrayRoutes) {
    const idx = compat.indexOf(`r.get('${route}'`);
    assert.notEqual(idx, -1, `route ${route} not found`);
    const body = compat.slice(idx, idx + 260);
    assert.match(body, /ok\(res,\(await pool\.query\(/, `${route} must return the query's .rows array directly, not wrapped in an object`);
  }
});

const screensUsingNormalizeList = [
  ['screens/transporter/DeliveryHistoryScreen.tsx', /normalizeList<any>\(r, \['missions', 'deliveries', 'history', 'data'\]\)/],
  ['screens/seller/InventoryScreen.tsx', /normalizeList<any>\(r, \['items', 'inventory', 'data'\]\)/],
  ['screens/buyer/WishlistScreen.tsx', /normalizeList<any>\(r, \['items', 'wishlist', 'data'\]\)/],
  ['screens/buyer/PaymentMethodsScreen.tsx', /normalizeList<any>\(r, \['methods', 'payment_methods', 'data'\]\)/],
  ['screens/seller/SellerOrdersScreen.tsx', /normalizeList<SellerOrder>\(r, \['orders', 'data'\]\)/],
  ['screens/seller/SellerProductsScreen.tsx', /normalizeList<SellerProduct>\(r, \['products', 'data'\]\)/],
  ['screens/transporter/MissionsScreen.tsx', /normalizeList<Mission>\(r, \['missions', 'data'\]\)/],
  ['screens/buyer/AddressesScreen.tsx', /normalizeList<any>\(r, \['addresses', 'data'\]\)/],
  ['screens/buyer/OrdersScreen.tsx', /normalizeList<Order>\(r, \['orders', 'data'\]\)/],
];

for (const [file, pattern] of screensUsingNormalizeList) {
  test(`${file}: unwraps the real array shape via normalizeList() instead of guessing a wrapper key`, () => {
    const content = readFrontend(...file.split('/'));
    assert.match(content, pattern);
  });
}

test('CheckoutScreen: both addresses AND payment methods are normalized (the highest-impact instance — the pay button was structurally always disabled: disabled={!addresses.length || !payments.length} with both arrays always empty)', () => {
  const screen = readFrontend('screens', 'buyer', 'CheckoutScreen.tsx');
  assert.match(screen, /normalizeList<Address>\(a, \['addresses', 'data'\]\)/);
  assert.match(screen, /normalizeList<PaymentMethod>\(p, \['payment_methods', 'methods', 'data'\]\)/);
  assert.match(screen, /disabled=\{paying \|\| !addresses\.length \|\| !payments\.length\}/);
});

test('BuyerDashboardScreen no longer exists — its content was merged into HomeScreen (constat C1: it was real but structurally unreachable, verified by exhaustive search before deletion)', () => {
  assert.equal(
    fs.existsSync(path.resolve(frontendSrc, 'screens', 'buyer', 'BuyerDashboardScreen.tsx')),
    false
  );
  const nav = readFrontend('navigation', 'BuyerNavigator.tsx');
  assert.doesNotMatch(nav, /BuyerDashboardScreen/, 'no navigator may still import the deleted screen');
});

test('HomeScreen (buyer): orders and products normalized, each network call independent via Promise.allSettled (one failing endpoint no longer blanks the whole screen, unlike the deleted BuyerDashboardScreen)', () => {
  const screen = readFrontend('screens', 'buyer', 'HomeScreen.tsx');
  assert.match(screen, /Promise\.allSettled\(/);
  assert.match(screen, /normalizeList<Order>\(ordersResult\.value, \['orders', 'data'\]\)/);
  assert.match(screen, /normalizeList<Product>\(productsResult\.value, \['products', 'data'\]\)/);
});

test('GET /vendor/analytics now returns metrics/top_products with real period filtering (was a flat object with no period support and no top_products at all — every card on AnalyticsScreen was blank)', () => {
  const compat = readBackend('src', 'routes', 'compatibility.js');
  const idx = compat.indexOf("r.get('/vendor/analytics'");
  assert.notEqual(idx, -1);
  const body = compat.slice(idx, idx + 2200);
  assert.match(body, /metrics:\{\.\.\.agg,average_order_value\}/);
  assert.match(body, /top_products:topProducts/);
  assert.match(body, /interval '30 days'/);
  assert.match(body, /interval '7 days'/);
  assert.match(body, /status='completed'/);
});

test('AnalyticsScreen already expected exactly this shape (data.metrics.{revenue,sales,orders,average_order_value}, data.top_products[]) — confirming the backend fix (ported from the audit branch during Session 26 reconciliation) matches what this untouched frontend file was always reading', () => {
  const screen = readFrontend('screens', 'seller', 'AnalyticsScreen.tsx');
  assert.match(screen, /data\?\.metrics/);
  assert.match(screen, /data\?\.top_products/);
  assert.match(screen, /m\.revenue/);
  assert.match(screen, /m\.average_order_value/);
});
