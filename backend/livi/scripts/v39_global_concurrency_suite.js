import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// V39 — global concurrency suite.
//
// AUDIT FINDING that motivated this file: scripts/run-postgres-suite.js
// (the single entry point `npm run test:postgres` runs) never actually
// invoked scripts/v31-postgres-crash-test.js or
// scripts/v31_1_real_withdrawal_concurrency.js. Both scripts existed, were
// individually runnable via their own npm scripts (`test:v31`,
// `test:concurrency:real`), and were presumably validated in isolation at
// some point — but "the" postgres suite silently never exercised them
// together with everything else. A reader running `npm run test:postgres`
// and seeing it pass would reasonably believe the withdrawal-concurrency
// and cross-table invariant checks had run. They had not.
//
// This script is the single place that runs every real (non-simulated)
// PostgreSQL concurrency/invariant script against the SAME database
// connection settings, in a defined order, and reports one consolidated
// result. It is additive, not a replacement: each script remains
// individually runnable via its own npm script for focused debugging.
//
// Order matters only in that later scripts should not depend on state left
// by earlier ones — each of these scripts already wraps its own work in a
// transaction it rolls back (or cleans up explicitly), so they are safe to
// run back-to-back against a shared database without interfering.
//
// Requires a real, disposable PostgreSQL instance (same requirement as
// each individual script). Has NOT been executed in the sandbox used to
// build this change — see docs/V39_GLOBAL_CONCURRENCY_SUITE.md.

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const STEPS = [
  {
    name: 'V31 cross-table invariants + advisory-lock serialization',
    script: 'scripts/v31-postgres-crash-test.js',
    env: {}
  },
  {
    name: 'V31.1 real withdrawal double-spend concurrency (transporter)',
    script: 'scripts/v31_1_real_withdrawal_concurrency.js',
    env: { ALLOW_LIVI_CONCURRENCY_TEST: 'true' }
  },
  {
    name: 'V35 idempotent stock restitution concurrency (calls real cancelOrder())',
    script: 'scripts/v35_stock_restitution_concurrency.js',
    env: { ALLOW_LIVI_CONCURRENCY_TEST: 'true' }
  }
];

const results = [];
let anyFailed = false;

for (const step of STEPS) {
  const startedAt = Date.now();
  try {
    const output = execFileSync(process.execPath, [step.script], {
      cwd: root,
      env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'test', ...step.env },
      encoding: 'utf8'
    });
    results.push({ name: step.name, script: step.script, status: 'PASS', duration_ms: Date.now() - startedAt, output: output.trim() });
    process.stdout.write(output);
  } catch (e) {
    anyFailed = true;
    const output = (e.stdout || '') + (e.stderr || '');
    results.push({ name: step.name, script: step.script, status: 'FAIL', duration_ms: Date.now() - startedAt, output: output.trim() || e.message });
    process.stderr.write(output || String(e.message));
  }
}

console.log(JSON.stringify({
  suite: 'V39-global-concurrency-suite',
  status: anyFailed ? 'FAIL' : 'PASS',
  steps: results.map(r => ({ name: r.name, script: r.script, status: r.status, duration_ms: r.duration_ms }))
}, null, 2));

if (anyFailed) process.exitCode = 1;
