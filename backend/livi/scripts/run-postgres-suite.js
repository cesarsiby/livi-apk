import { execFileSync } from 'node:child_process';
import pg from 'pg';

const { Client } = pg;
const cfg = {
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5433),
  database: process.env.PGDATABASE || 'livi_test',
  user: process.env.PGUSER || 'livi',
  password: process.env.PGPASSWORD || 'livi_test_only'
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitForPostgres() {
  for (let i = 0; i < 30; i++) {
    const c = new Client(cfg);
    try { await c.connect(); await c.end(); return; }
    catch { try { await c.end(); } catch {} await sleep(1000); }
  }
  throw new Error('PostgreSQL test instance did not become ready within 30 seconds');
}

await waitForPostgres();
const env = { ...process.env, NODE_ENV: 'test', ...cfg };
execFileSync(process.execPath, ['src/utils/migrate.js'], { cwd: new URL('..', import.meta.url).pathname.replace(/\\/g,'/'), env, stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/db-smoke.js'], { cwd: new URL('..', import.meta.url).pathname.replace(/\\/g,'/'), env, stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/v38_end_to_end_financial_scenario.js'], { cwd: new URL('..', import.meta.url).pathname.replace(/\\/g,'/'), env, stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/v39_global_concurrency_suite.js'], { cwd: new URL('..', import.meta.url).pathname.replace(/\\/g,'/'), env, stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/v36_escrow_ledger_reconciliation.js'], { cwd: new URL('..', import.meta.url).pathname.replace(/\\/g,'/'), env, stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/v37_payout_commission_reconciliation.js'], { cwd: new URL('..', import.meta.url).pathname.replace(/\\/g,'/'), env, stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/v40_admin_correction_workflow.js'], { cwd: new URL('..', import.meta.url).pathname.replace(/\\/g,'/'), env, stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/v43_restore_drill.js'], { cwd: new URL('..', import.meta.url).pathname.replace(/\\/g,'/'), env, stdio: 'inherit' });
console.log('PostgreSQL V43 suite: PASS');
