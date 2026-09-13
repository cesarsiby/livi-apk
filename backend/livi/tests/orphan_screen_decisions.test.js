import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendSrc = path.resolve(__dirname, '..', '..', '..', 'frontend', 'livi', 'src');
const read = (...p) => fs.readFileSync(path.join(frontendSrc, ...p), 'utf8');
const exists = (...p) => fs.existsSync(path.join(frontendSrc, ...p));

// V-AUDIT: four decisions made on screens flagged (not fixed) in Session 17's
// navigation audit — "tranche" (the person asked for a call to be made
// rather than leaving them open). Each decision is tested here so a future
// change can't silently re-break or re-orphan any of the four.

test('decision 1 — TwoFactorAuthScreen/VerifyEmailScreen removed (dead, unreachable, no backend, contradicts the audit\'s simple-auth mandate)', () => {
  assert.equal(exists('screens', 'auth', 'TwoFactorAuthScreen.tsx'), false);
  assert.equal(exists('screens', 'auth', 'VerifyEmailScreen.tsx'), false);
  const root = read('navigation', 'RootNavigator.tsx');
  assert.doesNotMatch(root, /TwoFactorAuth/);
  assert.doesNotMatch(root, /VerifyEmail/);
});

test('decision 2 — redundant Escrow-prefixed route aliases removed from BuyerNavigator (EscrowCenter/EscrowTransactions/EscrowDisputes), canonical names kept', () => {
  const nav = read('navigation', 'BuyerNavigator.tsx');
  assert.doesNotMatch(nav, /name="EscrowCenter"/);
  assert.doesNotMatch(nav, /name="EscrowTransactions"/);
  assert.doesNotMatch(nav, /name="EscrowDisputes"/);
  // the canonical registrations these were redundant with must still exist
  assert.match(nav, /name="Escrow"/);
  assert.match(nav, /name="Transactions"/);
  assert.match(nav, /name="Disputes"/);
});

test('decision 3 — Deposit linked from WalletScreen (kept: it\'s an honest placeholder that already refuses to fake success, not dead code)', () => {
  const wallet = read('screens', 'wallet', 'WalletScreen.tsx');
  assert.match(wallet, /navigation\.navigate\('Deposit'\)/);
  // the screen itself must still be the honest, non-faking placeholder —
  // this decision made it reachable, it did not change what happens once reached
  const deposit = read('screens', 'escrow', 'DepositScreen.tsx');
  assert.match(deposit, /Aucun dépôt fictif/);
});

test('decision 4 — LiveShops linked from FeedScreen (kept and fixed: fully working feature, real GET /live/active backend, just had no entry point)', () => {
  const feed = read('screens', 'social', 'FeedScreen.tsx');
  assert.match(feed, /navigation\.navigate\('LiveShops'\)/);
});

test('EscrowCenterScreen now accepts navigation and links to Disputes (fills the gap left by removing the redundant EscrowDisputes alias)', () => {
  const escrow = read('screens', 'buyer', 'EscrowCenterScreen.tsx');
  assert.match(escrow, /EscrowCenterScreen\(\{\s*navigation\s*\}/);
  assert.match(escrow, /navigation\.navigate\('Disputes'\)/);
});

test('every screen name referenced by these 4 fixes is registered in the navigator it navigates within', () => {
  const checks = [
    { navigator: 'BuyerNavigator.tsx', names: ['Deposit', 'LiveShops', 'Disputes', 'Escrow', 'Transactions'] },
  ];
  for (const { navigator, names } of checks) {
    const content = read('navigation', navigator);
    for (const name of names) {
      assert.match(content, new RegExp(`<Stack\\.Screen name="${name}"`), `${navigator} must register "${name}"`);
    }
  }
});
