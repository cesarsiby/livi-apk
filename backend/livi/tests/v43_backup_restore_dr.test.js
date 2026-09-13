import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Static/unit verification for V43 (backup/restore/disaster recovery).
// Real proof that a restore drill passes against a real restored database
// requires scripts/v43_restore_drill.js against a live PostgreSQL
// instance — this suite verifies the migration-locking fix, the absence
// of destructive statements, and that the documented procedure and its
// verification script actually exist and are wired correctly.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const exists = (...p) => fs.existsSync(path.join(root, ...p));

test('migrate.js now serializes the whole migration run with a Postgres advisory lock', () => {
  const src = read('src', 'utils', 'migrate.js');
  assert.match(src, /pg_advisory_lock\(\$1\)/);
  assert.match(src, /pg_advisory_unlock\(\$1\)/);
  assert.match(src, /MIGRATION_LOCK_ID/);
});

test('migrate.js still applies migrations in filename sort order inside a per-file transaction (no regression)', () => {
  const src = read('src', 'utils', 'migrate.js');
  assert.match(src, /\.filter\(f => f\.endsWith\('\.sql'\)\)\.sort\(\)/);
  assert.match(src, /await c\.query\('BEGIN'\)/);
  assert.match(src, /await c\.query\('COMMIT'\)/);
  assert.match(src, /await c\.query\('ROLLBACK'\)/);
});

test('no migration contains DROP TABLE or TRUNCATE (regression guard — the ledger/history-immutability principle)', () => {
  const migrationsDir = path.join(root, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
  assert.ok(files.length > 0, 'expected migration files to exist');
  for (const f of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
    assert.doesNotMatch(sql, /DROP TABLE/i, `${f} must not contain DROP TABLE`);
    assert.doesNotMatch(sql, /\bTRUNCATE\b/i, `${f} must not contain TRUNCATE`);
  }
});

test('the pgcrypto and citext extensions required by migrations/001_initial.sql are declared with IF NOT EXISTS', () => {
  const sql = read('migrations', '001_initial.sql');
  assert.match(sql, /CREATE EXTENSION IF NOT EXISTS pgcrypto;/);
  assert.match(sql, /CREATE EXTENSION IF NOT EXISTS citext;/);
});

test('scripts/v43_restore_drill.js exists and checks migration completeness, table existence, ledger balance, and extensions', () => {
  const src = read('scripts', 'v43_restore_drill.js');
  assert.match(src, /MIGRATION_NOT_APPLIED/);
  assert.match(src, /UNKNOWN_APPLIED_MIGRATION/);
  assert.match(src, /TABLE_NOT_QUERYABLE/);
  assert.match(src, /GLOBAL_LEDGER_UNBALANCED_AFTER_RESTORE/);
  assert.match(src, /MISSING_EXTENSION/);
});

test('the restore-drill script checks against the real migrations/ directory, not a hardcoded count', () => {
  const src = read('scripts', 'v43_restore_drill.js');
  assert.match(src, /fs\.readdirSync\(migrationsDir\)\.filter\(f => f\.endsWith\('\.sql'\)\)/);
});

test('backup/restore procedure is documented with concrete pg_dump/pg_restore commands', () => {
  const doc = read('docs', 'V43_BACKUP_RESTORE_DR.md');
  assert.match(doc, /pg_dump --format=custom/);
  assert.match(doc, /pg_restore --dbname=/);
  assert.match(doc, /v43_restore_drill\.js/);
});

test('npm scripts expose the migration lock behavior is unaffected — migrate script unchanged in package.json', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.strictEqual(pkg.scripts['migrate'], 'node src/utils/migrate.js');
});

console.log(JSON.stringify({
  test: 'V43_BACKUP_RESTORE_DR_STATIC',
  note: 'Static/unit audit only. Real proof of a working restore requires scripts/v43_restore_drill.js against a live, restored PostgreSQL instance.',
  result: 'SEE_NODE_TEST_OUTPUT'
}, null, 2));
