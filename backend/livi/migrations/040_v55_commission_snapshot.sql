-- V55: commission snapshot at order creation (fixes a confirmed
-- financial bug, not a preventive/theoretical one — see the detailed
-- writeup in src/services/orderPricing.js and src/services/finance.js).
--
-- Bug 1 (passthrough vendors shortchanged): when a vendor passes the
-- commission on to the buyer, the buyer pays base+commission, but
-- releaseEscrow() re-applied the commission rate to that already-marked-up
-- total instead of the vendor's own base price. Concretely: base=10000,
-- commission=3% (300) -> buyer pays 10300, vendor received
-- 10300-commissionAmount(10300,300) = 10300-309 = 9991, not the 10000
-- they were supposed to keep in full.
--
-- Bug 2 (commission rate can drift in-flight): any order's vendor payout
-- (passthrough or not) used whatever commission rate was ACTIVE AT
-- RELEASE TIME, not the rate active when the order was placed — a rate
-- change while an order sits in escrow silently changes what the vendor
-- was promised.
--
-- Fix: snapshot the vendor's guaranteed net payout once, at order
-- creation (calculateVendorNet() in orderPricing.js), and have
-- releaseEscrow() read it directly instead of re-deriving it later.
--
-- Idempotent; does not modify or delete any existing row's already-settled
-- outcome (see the two backfills below, each scoped to be a no-op change
-- in effect, not a retroactive recalculation).

-- Vendor's own subtotal before any passthrough markup. Informational/
-- transparency column (what the vendor's price actually was, distinct
-- from subtotal_amount which may include the markup the buyer paid) —
-- backfilled equal to subtotal_amount for all pre-existing rows, which is
-- exact (not an approximation): commission_passthrough did not exist
-- before migration 038, so no pre-038 order could have had a markup.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS base_subtotal_amount bigint;
UPDATE orders SET base_subtotal_amount = subtotal_amount WHERE base_subtotal_amount IS NULL;
ALTER TABLE orders ALTER COLUMN base_subtotal_amount SET NOT NULL;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_base_subtotal_chk;
ALTER TABLE orders
  ADD CONSTRAINT orders_base_subtotal_chk
  CHECK (base_subtotal_amount >= 0 AND base_subtotal_amount <= subtotal_amount);

-- The exact XOF amount the vendor is guaranteed to receive, computed once
-- at order creation and read directly by releaseEscrow() instead of being
-- re-derived at release time. NULLable by design:
--  - Already-released rows are backfilled from vendor_net_amount, the
--    real recorded historical payout (not a guess) — migration 030's own
--    CHECK constraint (commission_amount + vendor_net_amount = amount)
--    already guarantees vendor_net_amount <= amount for every such row,
--    so the CHECK added below can never reject a backfilled value.
--  - Not-yet-released rows are left NULL on purpose: releaseEscrow() falls
--    back to its pre-this-migration behavior for exactly those rows. This
--    migration does not retroactively change the payout for an order
--    already placed before it deployed — only how NEW orders are priced
--    going forward (src/routes/orders.js).
ALTER TABLE escrow_transactions ADD COLUMN IF NOT EXISTS vendor_net_amount_snapshot bigint;
UPDATE escrow_transactions
  SET vendor_net_amount_snapshot = vendor_net_amount
  WHERE vendor_net_amount_snapshot IS NULL AND status = 'released';
ALTER TABLE escrow_transactions DROP CONSTRAINT IF EXISTS escrow_vendor_net_snapshot_chk;
ALTER TABLE escrow_transactions
  ADD CONSTRAINT escrow_vendor_net_snapshot_chk
  CHECK (vendor_net_amount_snapshot IS NULL OR (vendor_net_amount_snapshot >= 0 AND vendor_net_amount_snapshot <= amount));
