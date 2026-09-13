-- LIVI V37: payout/commission consistency guards + fixes recap.
--
-- This migration is the database-layer half of V37 (audit payout vendeur +
-- transporteur + commission). The application-layer fixes for this version
-- (see docs/V37_PAYOUT_COMMISSION_AUDIT.md) were:
--   1. releaseEscrow() now looks up the real transporter from `shipments`
--      instead of a non-existent `escrow_transactions.transporter_id`
--      field, which had made every shipping-fee ledger credit permanently
--      unattributed (owner_user_id=NULL) — transporters could never
--      withdraw shipping fees through this path.
--   2. disputes.js /:id/resolve now passes the real, locked escrow row
--      into releaseEscrow()/refundEscrow() instead of the dispute row —
--      the previous code made every "refund" dispute resolution throw 404
--      and made every "release" dispute resolution credit the vendor with
--      an unattributed (owner_user_id=NULL) ledger entry.
--   3. The four call sites that duplicated "fetch active commission rule +
--      release + persist commission fields" were consolidated into
--      releaseEscrowWithActiveCommission() in src/services/finance.js.
--
-- This migration adds the PostgreSQL-level second line of defense the
-- project requires (mission section 20) for the numeric invariants those
-- code paths rely on, so a future bug in application code cannot silently
-- write an inconsistent gross/fee/net or amount/commission/net split.
--
-- Idempotent; does not modify or delete any existing row.


-- A. payout_requests: gross amount must always equal fee + net.
-- Existing rows are already consistent (migration 005_withdrawal_fees.sql
-- backfilled net_amount=amount for pre-V5 rows, which have fee_amount=0,
-- so amount = 0 + net_amount holds), so this can be added directly rather
-- than needing a conditional trigger.
ALTER TABLE payout_requests
  DROP CONSTRAINT IF EXISTS payout_requests_amount_split_chk;
ALTER TABLE payout_requests
  ADD CONSTRAINT payout_requests_amount_split_chk
  CHECK (amount = fee_amount + net_amount);

-- B. escrow_transactions: once released, commission + vendor net must equal
-- the escrow's principal amount. Pre-release rows have
-- commission_amount=0 and vendor_net_amount=0 by column default while
-- amount>0, so the check only applies once status='released' (a plain,
-- unconditional CHECK would reject every un-released row).
ALTER TABLE escrow_transactions
  DROP CONSTRAINT IF EXISTS escrow_release_split_chk;
ALTER TABLE escrow_transactions
  ADD CONSTRAINT escrow_release_split_chk
  CHECK (status <> 'released' OR commission_amount + vendor_net_amount = amount);

