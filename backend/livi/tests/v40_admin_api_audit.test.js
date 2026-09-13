import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Static/unit verification for V40 (admin API audit). Real proof that the
// fixed workflow succeeds end-to-end (and that the old bug truly crashed)
// requires scripts/v40_admin_correction_workflow.js against a live
// PostgreSQL instance — this suite verifies the source-level fix is
// present, consistent, and hasn't regressed.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

test('admin.js no longer references req.user.id anywhere (the bug: JWTs only carry req.user.sub)', () => {
  const src = read('src', 'routes', 'admin.js');
  assert.doesNotMatch(src, /req\.user\.id\b/);
});

test('admin.js uses req.user.sub for every actor-attribution call site (open/partner-payments/approve/reject/execute)', () => {
  const src = read('src', 'routes', 'admin.js');
  const subUsages = (src.match(/req\.user\.sub/g) || []).length;
  assert.strictEqual(subUsages, 5, `expected 5 usages of req.user.sub (partner-payments, open, approve, reject, execute), found ${subUsages}`);
});

test('JWT access tokens only ever carry a sub claim, not id — regression guard on the root cause assumption', () => {
  const src = read('src', 'services', 'auth.js');
  const accessTokenLine = src.split('\n').find(l => l.includes('function access('));
  assert.ok(accessTokenLine, 'access() function not found');
  assert.doesNotMatch(accessTokenLine, /\bid:/, 'access token claims must not gain an `id` field as a workaround — routes must use `sub`');
  assert.match(accessTokenLine, /sub:user\.id/);
});

test('POST /admin/reconciliation/partner-payments now validates its body with Zod instead of trusting req.body blindly', () => {
  const src = read('src', 'routes', 'admin.js');
  assert.match(src, /const partnerPaymentsSchema = z\.object/);
  assert.match(src, /partnerPaymentsSchema\.parse\(req\.body\)/);
});

test('POST /admin/reconciliation/corrections now validates its body with Zod, with case_type matching the real DB CHECK constraint', () => {
  const src = read('src', 'routes', 'admin.js');
  assert.match(src, /const openCorrectionSchema = z\.object/);
  assert.match(src, /openCorrectionSchema\.parse\(req\.body\)/);
  assert.match(src, /'manual_adjustment'/);
  assert.doesNotMatch(src, /'manual'\]/, 'case_type enum must match the DB CHECK constraint exactly (manual_adjustment, not manual)');
  const migrationSql = read('migrations', '020_v23_reconciliation_corrections.sql');
  assert.match(migrationSql, /'manual_adjustment'/);
});

test('GET /admin/reconciliation/runs/:id uses HttpError instead of a hand-rolled res.status().json() (consistent error format)', () => {
  const src = read('src', 'routes', 'admin.js');
  assert.doesNotMatch(src, /res\.status\(404\)\.json\(/);
  assert.match(src, /throw new HttpError\(404,'Réconciliation introuvable','RECON_RUN_NOT_FOUND'\)/);
});

test('V40 migration adds a NOT NULL guard on the actor columns used for separation-of-duties', () => {
  const sql = read('migrations', '031_v40_admin_actor_traceability_guard.sql');
  assert.match(sql, /ALTER TABLE financial_correction_cases\s*\n\s*ALTER COLUMN created_by SET NOT NULL/);
  assert.match(sql, /ALTER TABLE financial_correction_actions\s*\n\s*ALTER COLUMN actor_user_id SET NOT NULL/);
});

test('separation-of-duties check in financialCorrections.js is unchanged (no V40 regression)', () => {
  const src = read('src', 'services', 'financialCorrections.js');
  assert.match(src, /if\(row\.created_by===actorId\) throw new HttpError\(403,'Le créateur ne peut pas approuver sa propre correction','CORRECTION_SEPARATION_OF_DUTIES'\);/);
});

console.log(JSON.stringify({
  test: 'V40_ADMIN_API_AUDIT_STATIC',
  note: 'Static/unit audit only. Real proof that the fixed workflow succeeds end-to-end (and that the old bug truly crashed) requires scripts/v40_admin_correction_workflow.js against a live PostgreSQL instance.',
  result: 'SEE_NODE_TEST_OUTPUT'
}, null, 2));
