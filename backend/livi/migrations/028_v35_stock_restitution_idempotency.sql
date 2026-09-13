-- LIVI V35: idempotent stock restitution + defense-in-depth financial guards.
--
-- Context: as of V34, stock restitution on order cancellation is already
-- guarded at the application layer (src/services/orderCancellation.js):
--   1. `SELECT * FROM orders WHERE id=$1 FOR UPDATE` serializes concurrent
--      cancellation attempts on the same order.
--   2. `restoreStockOnce()` checks `orders.stock_restored_at` under that same
--      row lock and is a no-op if already set.
-- This is correct, but it is the ONLY line of defense: nothing in PostgreSQL
-- itself prevents a future code path (a bug, a new admin tool, a migration
-- script) from restoring stock twice, or from restoring stock after the
-- parcel has already shipped. Per LIVI's rule that PostgreSQL must be a
-- second line of defense (not just the application), this migration adds
-- database-level guards that are independent of application code.
--
-- This migration is idempotent (safe to re-run) and does not modify or
-- delete any historical data.


-- ---------------------------------------------------------------------
-- A. Stock restitution guard trigger
--
-- Rule 1 (idempotency/immutability): once `orders.stock_restored_at` is
--   set, it can never be changed to a different value. This makes a double
--   restitution structurally impossible at the database level, even if an
--   application bug attempted it outside the existing row-lock path.
--
-- Rule 2 (no restitution after shipment): stock may only be restored while
--   the order is still in a pre-shipment state at the moment the flag is
--   set (pending_payment, paid, preparing). This directly encodes item I
--   of the V35 requirements: "no automatic stock restitution after
--   shipping".
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION livi_v35_guard_stock_restoration()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Rule 1: stock_restored_at is write-once.
  IF OLD.stock_restored_at IS NOT NULL
     AND NEW.stock_restored_at IS DISTINCT FROM OLD.stock_restored_at THEN
    RAISE EXCEPTION
      'Stock restitution for order % has already been recorded at %; it cannot be changed or repeated',
      OLD.id, OLD.stock_restored_at
      USING ERRCODE = '23505';
  END IF;

  -- Rule 2: stock restitution is only allowed from a pre-shipment state.
  IF OLD.stock_restored_at IS NULL AND NEW.stock_restored_at IS NOT NULL THEN
    IF OLD.status NOT IN ('pending_payment','paid','preparing') THEN
      RAISE EXCEPTION
        'Stock restitution for order % is not allowed after shipment (order status was %)',
        OLD.id, OLD.status
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_v35_stock_restoration_guard ON orders;
CREATE TRIGGER order_v35_stock_restoration_guard
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION livi_v35_guard_stock_restoration();

-- ---------------------------------------------------------------------
-- B. Defense-in-depth: at most one escrow refund / one escrow release
--    per order, enforced by PostgreSQL itself (not only by the
--    application-level duplicate check in src/services/finance.js).
--
-- ledger_transactions.metadata is a jsonb blob; we index the order_id it
-- carries for 'escrow_refund' and 'escrow_release' transaction types and
-- make that combination unique. A concurrent second refund/release
-- attempt for the same order will now fail on a database constraint even
-- if application-level locking were ever bypassed.
-- ---------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS ledger_txn_unique_escrow_refund_per_order
  ON ledger_transactions ((metadata->>'order_id'))
  WHERE type = 'escrow_refund';

CREATE UNIQUE INDEX IF NOT EXISTS ledger_txn_unique_escrow_release_per_order
  ON ledger_transactions ((metadata->>'order_id'))
  WHERE type = 'escrow_release';

