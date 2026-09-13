-- LIVI V40: admin API audit — actor traceability guard for financial corrections.
--
-- AUDIT FINDING that motivated this migration: src/routes/admin.js used
-- `req.user.id` throughout every financial-correction endpoint
-- (open/approve/reject/execute-customer-compensation), but the JWT access
-- token only ever carries a `sub` claim (see src/services/auth.js) — there
-- is no `id` field. `req.user.id` was therefore always `undefined`. Because
-- `openCorrection()`/`approveCorrection()`/`rejectCorrection()`/
-- `executeCustomerCompensation()` (src/services/financialCorrections.js)
-- pass `createdBy`/`actorId` straight into a parameterized query with no
-- `||null` fallback, and node-postgres rejects `undefined` bound
-- parameters outright, every one of these endpoints crashed with a 500 on
-- every call. The entire admin financial-correction workflow described in
-- the mission (anomalie -> investigation -> dossier -> approbation ->
-- exécution -> écriture de compensation -> audit) was non-functional.
--
-- Fixed at the application layer (same change set): admin.js now uses
-- req.user.sub, consistent with every other route in the codebase.
--
-- This migration is the database-layer second line of defense: it makes
-- `created_by` / `actor_user_id` NOT NULL on the correction tables. This is
-- safe to apply retroactively — because the buggy code path always crashed
-- BEFORE the INSERT could commit, no row with a NULL actor could ever have
-- been persisted by it, so there is no existing data to backfill or
-- reconcile. The purpose is forward-looking: if a similar req.user.id-style
-- typo is ever reintroduced, PostgreSQL will reject the write outright
-- (loud, obvious failure) rather than either crashing deep in the pg driver
-- (current behavior, at least visible) or — worse, if some future refactor
-- adds an `||null` fallback without noticing why it's dangerous here —
-- silently persisting a financial correction with no recorded actor,
-- defeating the separation-of-duties check in
-- src/services/financialCorrections.js#approveCorrection (which compares
-- `row.created_by===actorId`; two NULLs would never match, which happens to
-- fail safe today, but should not be relied upon as the only guard).
--
-- Idempotent; does not delete any data. If a real production database
-- somehow already has a NULL row here (which per the analysis above should
-- be impossible from the applicable code paths), this migration will fail
-- loudly at deploy time rather than silently succeed — which is the
-- correct, cautious behavior for a financial-integrity guard.


ALTER TABLE financial_correction_cases
  ALTER COLUMN created_by SET NOT NULL;

ALTER TABLE financial_correction_actions
  ALTER COLUMN actor_user_id SET NOT NULL;

