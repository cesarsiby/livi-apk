import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// This test file lives in backend/livi/tests/ but audits frontend/livi/src —
// deliberately kept alongside the rest of this audit's test suite rather
// than requiring a separate frontend test runner that doesn't exist in
// this project (no jest/vitest config found for frontend/livi).
const frontendSrc = path.resolve(__dirname, '..', '..', '..', 'frontend', 'livi', 'src');
const read = (...p) => fs.readFileSync(path.join(frontendSrc, ...p), 'utf8');

// V-AUDIT (page interconnection audit, prompted by the same bug class as
// LIVI_Correctifs_Categorie_Photos_Video.zip — Session 14): the admin role's
// entire panel (AdminDashboard + the 18 screens it links to, all verified
// working end-to-end in Sessions 15-16) was completely unreachable. Two
// compounding causes, both fixed:
//   1. AdminNavigator listed "Profile" first (React Navigation's default
//      initial route is the first child) instead of "AdminDashboard" —
//      unlike SellerNavigator/TransporterNavigator, which both lead with
//      their own dashboard.
//   2. ProfileScreen's ROLE_LINKS.admin was an empty array, so even if an
//      admin ended up on Profile by any other path, there was still no
//      link back to the admin panel.
// A third, separate bug found in the same file: DisputesScreen.tsx (shared
// by Buyer/Seller/Admin) hardcodes navigation.navigate('DisputeDetails', ...);
// Buyer/Seller both register that exact name, but AdminNavigator alone
// registered it as "AdminDisputeDetails" — tapping a dispute row while
// viewing AdminDisputes had no matching route.

test('AdminNavigator leads with AdminDashboard (React Navigation\'s default initial route is the first <Stack.Screen>)', () => {
  const nav = read('navigation', 'AdminNavigator.tsx');
  const screens = [...nav.matchAll(/<Stack\.Screen name="([A-Za-z0-9_]+)"/g)].map(m => m[1]);
  assert.ok(screens.length > 0, 'must find at least one registered screen');
  assert.equal(screens[0], 'AdminDashboard', `first screen must be AdminDashboard, found "${screens[0]}"`);
});

test('AdminNavigator registers "DisputeDetails" (not "AdminDisputeDetails"), matching Buyer/SellerNavigator and the shared DisputesScreen\'s hardcoded navigate target', () => {
  const nav = read('navigation', 'AdminNavigator.tsx');
  assert.match(nav, /<Stack\.Screen name="DisputeDetails"/);
  assert.doesNotMatch(nav, /<Stack\.Screen name="AdminDisputeDetails"/, 'the old, unreachable name must not still exist alongside the new one');

  const disputesScreen = read('screens', 'disputes', 'DisputesScreen.tsx');
  const target = disputesScreen.match(/navigation\.navigate\('([A-Za-z0-9_]+)'/)?.[1];
  assert.equal(target, 'DisputeDetails', 'the fix must match what the shared screen actually navigates to');

  for (const navigatorFile of ['BuyerNavigator.tsx', 'SellerNavigator.tsx', 'AdminNavigator.tsx']) {
    const content = read('navigation', navigatorFile);
    assert.match(content, new RegExp(`<Stack\\.Screen name="${target}"`), `${navigatorFile} must register "${target}" for DisputesScreen's navigation call to work`);
  }
});

test('ROLE_LINKS.admin is non-empty (an admin landing on Profile by any path must have a way back into the admin panel)', () => {
  const profile = read('screens', 'profile', 'ProfileScreen.tsx');
  const match = profile.match(/admin:\s*\[(.*?)\],\s*\n/);
  assert.ok(match, 'ROLE_LINKS.admin must still exist');
  assert.notEqual(match[1].trim(), '', 'must not be an empty array');
  assert.match(match[1], /'AdminDashboard'/, 'must at least link back to AdminDashboard');
});

test('TransporterDashboardScreen links to Availability (registered in TransporterNavigator but previously linked from nowhere)', () => {
  // SESSION 26 — RÉCONCILIATION DE BRANCHES : ce test datait d'avant la
  // refonte LIVI 2.0 des dashboards (constat C5 — regroupement par
  // intention plutôt que liste plate, voir RAPPORT_UXUI_SESSION21_AUDIT.md
  // et _STRATEGIE_ET_IMPLEMENTATION.md, Étape D). Le tuple littéral
  // ['Disponibilité', 'Availability'] a été remplacé par un objet
  // structuré { icon, title, subtitle, route } — même destination, forme
  // différente. Le comportement vérifié (le lien existe réellement) est
  // inchangé ; seule l'expression régulière est mise à jour.
  const dash = read('screens', 'transporter', 'TransporterDashboardScreen.tsx');
  assert.match(dash, /title:\s*'Disponibilité',\s*subtitle:[^}]*route:\s*'Availability'/);
});

test('every screen name TransporterDashboardScreen links to is actually registered in TransporterNavigator', () => {
  const dash = read('screens', 'transporter', 'TransporterDashboardScreen.tsx');
  const targets = [...dash.matchAll(/route:\s*'([A-Za-z0-9_]+)'/g)].map(m => m[1]);
  assert.ok(targets.length >= 5, `expected several navigable quick actions on this dashboard, found ${targets.length} — regex may no longer match the real structure`);
  const nav = read('navigation', 'TransporterNavigator.tsx');
  const registered = new Set([...nav.matchAll(/<Stack\.Screen name="([A-Za-z0-9_]+)"/g)].map(m => m[1]));
  for (const t of targets) {
    assert.ok(registered.has(t), `TransporterDashboardScreen links to "${t}", which TransporterNavigator does not register`);
  }
});
