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
// Le projet a divergé en deux branches parallèles après la Session 20 :
// une ligne d'audit backend numérotée (Sessions 21-25, "sessions9-25-final.zip")
// et une refonte UX/UI complète ("LIVI 2.0", RAPPORT_UXUI_SESSION21, zip
// séparé). Les deux ont trouvé et corrigé INDÉPENDAMMENT les deux mêmes
// bugs de contrat API vérifiés ici (remboursements, centre escrow) — mais
// la version LIVI 2.0 va plus loin (retire entièrement le champ fantôme
// "reason" au lieu de l'afficher à "—", utilise normalizeList() plutôt
// qu'un repli ad hoc). C'est la branche LIVI 2.0 qui a été retenue comme
// base fusionnée ; ce fichier remplace donc l'original du même nom (écrit
// contre RefundsScreen.tsx/EscrowCenterScreen.tsx de la branche d'audit,
// qui n'existent plus sous cette forme après fusion). Voir
// RAPPORT_AUDIT_SESSION26_RECONCILIATION_BRANCHES.md pour le détail complet.

test('GET /orders/refunds response fields are exactly what RefundsScreen now reads', () => {
  const route = readBackend('src', 'routes', 'compatibility.js');
  const idx = route.indexOf("r.get('/orders/refunds'");
  assert.notEqual(idx, -1);
  const body = route.slice(idx, idx + 300);
  assert.match(body, /e\.refunded_at/);
  assert.doesNotMatch(body, /\breason\b/, 'confirms "reason" genuinely is not in this response — RefundsScreen correctly has no UI trying to display it');

  const screen = readFrontend('screens', 'buyer', 'RefundsScreen.tsx');
  assert.match(screen, /normalizeList<any>\(r, \['refunds', 'data'\]\)/, 'C0: must unwrap the raw-array response, not just guess at wrapper keys');
  assert.match(screen, /item\.refunded_at/, 'must read the real field');
  assert.match(screen, /Commande #\{String\(item\.order_id/, 'must identify the order from a field that actually exists (order_id), not a generic label');
  assert.doesNotMatch(screen, /item\.reason/, 'the phantom "reason" field must not be read at all — no source column can ever fill it, so LIVI 2.0 removes the row entirely rather than showing a permanent em dash');
});

test('GET /escrow/balance buyer-role fields are exactly what EscrowCenterScreen now reads', () => {
  const escrowRoute = readBackend('src', 'routes', 'escrow.js');
  const buyerBranch = escrowRoute.slice(escrowRoute.indexOf('buyerEscrowPosition'));
  assert.match(buyerBranch, /available_amount:'0'/);
  assert.match(buyerBranch, /locked_amount:/);
  assert.match(buyerBranch, /active_order_count:/);

  const screen = readFrontend('screens', 'buyer', 'EscrowCenterScreen.tsx');
  assert.match(screen, /normalizeList<any>\(tx, \['transactions', 'data'\]\)/, 'C0: the transactions list must unwrap the raw-array response, a separate bug from the balance field names below');
  assert.match(screen, /balance\?\.locked_amount/, 'the hero figure — the whole point of this screen — must read the real field');
  assert.match(screen, /balance\?\.available_amount/);
  assert.doesNotMatch(screen, /[.?]\s*locked_balance\b|[.?]\s*escrow_balance\b|[.?]\s*pending_balance\b/, 'the old, always-undefined field names must be gone from actual usage');
});

test('WalletScreen reads active_order_count for buyers (the field EscrowCenterScreen intentionally does not duplicate)', () => {
  const screen = readFrontend('screens', 'wallet', 'WalletScreen.tsx');
  assert.match(screen, /wallet\?\.active_order_count/);
  assert.match(screen, /wallet\?\.available_amount/);
  assert.match(screen, /wallet\?\.locked_amount/);
  assert.doesNotMatch(screen, /[.?]\s*available_balance\b|[.?]\s*pending_balance\b/, 'the pre-C0-quater Wallet field names (available_balance/pending_balance) must not resurface in actual usage');
});
