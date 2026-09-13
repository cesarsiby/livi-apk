import { Router } from 'express'; import { pool } from '../config/db.js'; import { ok,asyncHandler,HttpError } from '../utils/http.js';
const r=Router();

// V-AUDIT (section 39): /health used to run `SELECT 1` against the
// database — a liveness check that depended on something other than "is
// this process responding". A transient DB hiccup (Supabase connection
// blip, pool exhaustion) would fail this and could make an orchestrator
// conclude the *process* was dead and restart it, even though the Node
// process itself was fine and would have recovered the moment the DB did.
// /health now answers exactly one question — is the process responding —
// with no dependency on anything external.
r.get('/health',asyncHandler(async(req,res)=>{ ok(res,{status:'ok',service:'livi-api'}); }));

// New: /ready answers a different question — is this instance actually
// able to serve real requests right now. Checks, in order: DB reachable;
// migrations have run at all (not a freshly-created, empty database);
// the schema is at least as current as what *this* running code expects
// (checked via a column added by the most recent migration this codebase
// ships — 040_v55_commission_snapshot.sql's
// escrow_transactions.vendor_net_amount_snapshot — rather than a hardcoded
// migration count, which would need updating by hand every time a new
// migration is added and would silently drift out of date otherwise).
// A load balancer should stop routing traffic here on a non-200, but an
// orchestrator should NOT restart the process for this alone — that's
// what /health is for.
r.get('/ready',asyncHandler(async(req,res)=>{
  await pool.query('SELECT 1');

  const migrations = await pool.query(
    `SELECT to_regclass('public.schema_migrations') IS NOT NULL AS table_exists`
  );
  if (!migrations.rows[0]?.table_exists) {
    throw new HttpError(503,'Schéma non initialisé : schema_migrations absente','NOT_READY');
  }
  const count = await pool.query('SELECT count(*)::int AS n FROM schema_migrations');
  if (!count.rows[0]?.n) {
    throw new HttpError(503,'Aucune migration appliquée','NOT_READY');
  }

  const col = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='escrow_transactions' AND column_name='vendor_net_amount_snapshot'`
  );
  if (!col.rowCount) {
    throw new HttpError(503,'Schéma en retard : migration 040 non appliquée','SCHEMA_OUTDATED');
  }

  ok(res,{status:'ready',service:'livi-api',migrations_applied:count.rows[0].n});
}));

export default r;
