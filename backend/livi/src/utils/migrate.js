import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../config/db.js';

// V43 — disaster recovery audit finding: this file previously had no
// locking around the migration run at all. In a disaster-recovery
// scenario — restoring from backup and bringing the service back up — it
// is common for multiple app instances/pods to start simultaneously, each
// independently running `npm run migrate` on boot. Two such processes
// could both see a given migration as not-yet-applied (a plain SELECT on
// schema_migrations, no lock) and both attempt to run it. Most statements
// here use IF NOT EXISTS / DROP...IF EXISTS guards and would tolerate
// that, but not all (e.g. migration 030's ADD CONSTRAINT after DROP
// CONSTRAINT IF EXISTS has a window where a second concurrent transaction
// could attempt to add a constraint that already exists, or contend for
// the same DDL lock and error out) — and even where individual statements
// are idempotent, the final `INSERT INTO schema_migrations` would race on
// its primary key, causing spurious failures right when a clean, reliable
// restart matters most.
//
// Fixed with a single session-level Postgres advisory lock held for the
// duration of the entire migration run. A second concurrent process blocks
// on `pg_advisory_lock` until the first finishes and commits its
// schema_migrations rows, then proceeds and finds nothing left to do. The
// lock key is an arbitrary, fixed 64-bit constant scoped to this
// application (not shared with any other advisory lock use elsewhere in
// the codebase, e.g. livi_payout_user_lock, which is a *different*,
// per-user, function-scoped advisory lock and does not conflict with this
// one — different lock ids, different mechanisms).
const MIGRATION_LOCK_ID = '7241991000000001';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../migrations');

const lockClient = await pool.connect();
try {
  await lockClient.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);

  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations(version text primary key, applied_at timestamptz not null default now())');
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    const exists = await pool.query('SELECT 1 FROM schema_migrations WHERE version=$1', [file]);
    if (exists.rowCount) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(sql);
      await c.query('INSERT INTO schema_migrations(version) VALUES($1)', [file]);
      await c.query('COMMIT');
      console.log('Applied', file);
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }
} finally {
  await lockClient.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);
  lockClient.release();
  await pool.end();
}
