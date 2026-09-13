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

// V-AUDIT (section 47/49). EarningsScreen.tsx's heavy chain of guessed
// field names (data?.total ?? data?.total_earnings ?? data?.amount,
// data?.items ?? data?.transactions ?? data?.earnings) matched NONE of
// them against the real response ({gross_payable_xof, payout_count}, no
// itemized list at all) — the most severe case in this audit series: not
// a wrong number, a permanently blank screen (dash for the total, empty
// detail list, always, regardless of real activity).

test('GET /transporter/earnings now returns an itemized payouts array alongside the aggregate', () => {
  const compat = readBackend('src', 'routes', 'compatibility.js');
  const idx = compat.indexOf("r.get('/transporter/earnings'");
  assert.notEqual(idx, -1);
  const body = compat.slice(idx, idx + 1400);
  assert.match(body, /gross_payable_xof/);
  assert.match(body, /payout_count/);
  assert.match(body, /SELECT id,reference,amount,currency,status,paid_at,created_at FROM payout_requests/);
  assert.match(body, /ok\(res,\{\.\.\.agg,payouts\}\)/);
});

test('EarningsScreen reads the real field names, not the old guessed ones', () => {
  const screen = readFrontend('screens', 'transporter', 'EarningsScreen.tsx');
  assert.match(screen, /data\?\.gross_payable_xof/);
  assert.match(screen, /data\?\.payout_count/);
  assert.match(screen, /data\?\.payouts/);
  assert.doesNotMatch(screen, /data\?\.total_earnings|data\?\.transactions|data\?\.earnings\b/, 'the old guessed field names must be gone, not just supplemented');
});

test('EarningsScreen shows an explicit empty state instead of a silently blank list', () => {
  const screen = readFrontend('screens', 'transporter', 'EarningsScreen.tsx');
  assert.match(screen, /Aucun versement/);
});
