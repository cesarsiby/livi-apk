-- LIVI V36: escrow <-> ledger <-> wallet audit — legacy wallet-balance guard.
--
-- AUDIT FINDING: `wallets.available_amount` and `wallets.locked_amount`
-- (migration 001_initial.sql) are set to 0 at wallet creation and are never
-- updated by any code path in the backend (verified by a full-repository
-- grep before writing this migration). `GET /escrow/balance` used to read
-- directly from these columns and therefore always returned 0, regardless
-- of a user's real, correct balance in the double-entry ledger
-- (`ledger_entries`). This was a silent, user-facing financial display bug.
--
-- FIX (application layer, same change set): `GET /escrow/balance` now
-- computes the real position from `ledger_entries` via
-- src/services/wallet.js, the same formula src/routes/payouts.js already
-- used correctly for withdrawal eligibility.
--
-- FIX (this migration, database layer): rather than deleting the legacy
-- columns outright (a schema change with broader blast radius than this
-- version's scope, and one that would break `wallets` row identity used
-- elsewhere, e.g. `wallets.status`), this migration pins them at zero by
-- trigger. This makes it structurally impossible for a future bug or a
-- new admin tool to write a non-ledger-derived number into these columns
-- and have the application silently trust it again. Any code that needs a
-- balance MUST compute it from `ledger_entries`.
--
-- This migration is idempotent and does not delete any data or drop the
-- `wallets` table (still used as the anchor for wallet existence/status,
-- e.g. suspending a wallet via `wallets.status`).


CREATE OR REPLACE FUNCTION livi_v36_pin_legacy_wallet_balance()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- available_amount / locked_amount are legacy, unused columns. The real
  -- balance always comes from ledger_entries (see src/services/wallet.js).
  -- Force them to 0 regardless of what a caller attempts to write, so a
  -- reintroduced bug can never make this table look authoritative again.
  NEW.available_amount := 0;
  NEW.locked_amount := 0;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wallets_v36_pin_legacy_balance ON wallets;
CREATE TRIGGER wallets_v36_pin_legacy_balance
BEFORE INSERT OR UPDATE ON wallets
FOR EACH ROW EXECUTE FUNCTION livi_v36_pin_legacy_wallet_balance();

COMMENT ON COLUMN wallets.available_amount IS
  'LEGACY / UNUSED as of V36 — always 0, pinned by trigger wallets_v36_pin_legacy_balance. Real balance = ledger_entries via src/services/wallet.js.';
COMMENT ON COLUMN wallets.locked_amount IS
  'LEGACY / UNUSED as of V36 — always 0, pinned by trigger wallets_v36_pin_legacy_balance. Real "locked" position = active escrow_transactions / reserved payout_requests via src/services/wallet.js.';

