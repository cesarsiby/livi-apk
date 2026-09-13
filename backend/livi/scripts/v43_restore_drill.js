import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// V43 — post-restore verification drill.
//
// AUDIT FINDING that motivated this script: before V43, there was no
// documented or automated way to answer "did the restore actually work?"
// beyond eyeballing that the server started. This script is the automated
// half of the restore procedure documented in
// docs/V43_BACKUP_RESTORE_DR.md — run it immediately after restoring a
// backup (or after a fresh `npm run migrate` against an empty database, to
// rehearse the drill without needing a real backup) and it fails loudly if
// the result is incomplete or inconsistent, rather than silently declaring
// success.
//
// Checks performed:
//   1. schema_migrations contains exactly one row per .sql file in
//      migrations/ — proves every migration in the source tree was
//      actually applied to the restored database, not just "some".
//   2. No unexpected extra rows in schema_migrations (a version marked
//      applied that doesn't correspond to any file in the current source
//      tree) — would indicate the restored database is from a different,
//      unreconciled version of the codebase.
//   3. Every table referenced by the application layer exists and is
//      queryable (a lightweight schema-completeness smoke test).
//   4. The global ledger double-entry invariant holds (same check as
//      scripts/v36_escrow_ledger_reconciliation.js) — a restore that lost
//      or duplicated ledger rows would show up here immediately.
//   5. The pgcrypto and citext extensions (required by migrations/001) are
//      actually installed — on some managed Postgres providers these must
//      be explicitly enabled before restore and are easy to forget.
//
// Requires a real, disposable-or-freshly-restored PostgreSQL instance and
// an installed `pg` package. Has NOT been executed in the sandbox used to
// build this change — see docs/V43_BACKUP_RESTORE_DR.md.

const { Client } = pg;
const cfg = {
  connectionString: process.env.DATABASE_URL || `postgres://${process.env.PGUSER || 'livi'}:${process.env.PGPASSWORD || 'livi_test_only'}@${process.env.PGHOST || '127.0.0.1'}:${process.env.PGPORT || 5433}/${process.env.PGDATABASE || 'livi_test'}`
};

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, '..', 'migrations');

const CORE_TABLES = [
  'users','wallets','products','orders','order_items','escrow_transactions',
  'shipments','shipment_proofs','disputes','ledger_accounts','ledger_transactions',
  'ledger_entries','payout_requests','withdrawal_fee_rules','platform_fee_rules',
  'partner_reconciliation_runs','partner_reconciliation_items',
  'financial_correction_cases','financial_correction_actions',
  'idempotency_keys','schema_migrations'
];

const client = new Client(cfg);
const failures = [];

try {
  await client.connect();

  // 1 & 2. Migration completeness.
  const filesOnDisk = new Set(fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')));
  const applied = (await client.query('SELECT version FROM schema_migrations')).rows.map(r => r.version);
  const appliedSet = new Set(applied);

  for (const f of filesOnDisk) {
    if (!appliedSet.has(f)) failures.push(`MIGRATION_NOT_APPLIED: ${f} exists in migrations/ but is not recorded in schema_migrations`);
  }
  for (const v of applied) {
    if (!filesOnDisk.has(v)) failures.push(`UNKNOWN_APPLIED_MIGRATION: schema_migrations records ${v}, which does not exist in this source tree`);
  }

  // 3. Table existence smoke test.
  for (const table of CORE_TABLES) {
    try {
      await client.query(`SELECT 1 FROM ${table} LIMIT 1`);
    } catch (e) {
      failures.push(`TABLE_NOT_QUERYABLE: ${table} (${e.message})`);
    }
  }

  // 4. Global ledger invariant (same check as V36's reconciliation script).
  try {
    const sum = (await client.query('SELECT coalesce(sum(amount),0)::bigint total FROM ledger_entries')).rows[0].total;
    if (String(sum) !== '0') failures.push(`GLOBAL_LEDGER_UNBALANCED_AFTER_RESTORE: sum(ledger_entries.amount) = ${sum}`);
  } catch (e) {
    failures.push(`LEDGER_CHECK_FAILED: ${e.message}`);
  }

  // 5. Required extensions.
  const extRows = (await client.query(`SELECT extname FROM pg_extension WHERE extname IN ('pgcrypto','citext')`)).rows.map(r => r.extname);
  for (const ext of ['pgcrypto', 'citext']) {
    if (!extRows.includes(ext)) failures.push(`MISSING_EXTENSION: ${ext} is required by migrations/001_initial.sql and is not installed`);
  }

  if (failures.length) {
    console.error(JSON.stringify({ suite: 'V43-restore-drill', status: 'FAIL', failures }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({
      suite: 'V43-restore-drill',
      status: 'PASS',
      migrations_verified: filesOnDisk.size,
      tables_verified: CORE_TABLES.length,
      extensions_verified: ['pgcrypto', 'citext']
    }, null, 2));
  }
} catch (e) {
  console.error(e.stack || e);
  process.exitCode = 1;
} finally {
  try { await client.end(); } catch {}
}
