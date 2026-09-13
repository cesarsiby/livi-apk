-- LIVI V19: refund and cancellation integrity guards

-- A refund is one financial event per escrow/order. This prevents duplicate
-- refunds even if an endpoint is called twice or two workers race.
CREATE UNIQUE INDEX IF NOT EXISTS one_refund_ledger_per_order
ON ledger_transactions ((metadata->>'order_id'))
WHERE type = 'escrow_refund';

-- A refunded escrow must have exactly one refund transaction.
CREATE OR REPLACE FUNCTION livi_refund_integrity_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  refund_count integer;
  oid uuid;
  ostatus text;
BEGIN
  IF NEW.status = 'refunded' THEN
    oid := NEW.order_id;
    SELECT status INTO ostatus FROM orders WHERE id = oid;
    IF ostatus IS DISTINCT FROM 'refunded' THEN
      RAISE EXCEPTION 'Refunded escrow % requires refunded order status', NEW.id;
    END IF;

    SELECT count(*) INTO refund_count
    FROM ledger_transactions
    WHERE type = 'escrow_refund'
      AND metadata->>'order_id' = oid::text;

    IF refund_count <> 1 THEN
      RAISE EXCEPTION 'Escrow % must have exactly one refund ledger transaction, found %', NEW.id, refund_count;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS escrow_refund_integrity_guard ON escrow_transactions;
CREATE CONSTRAINT TRIGGER escrow_refund_integrity_guard
AFTER INSERT OR UPDATE ON escrow_transactions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION livi_refund_integrity_guard();

-- A refund ledger event may only reference an existing funded/disputed escrow
-- identity and must never exceed the original escrow principal + shipping.
CREATE OR REPLACE FUNCTION livi_refund_ledger_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  e_amount bigint;
  e_shipping bigint;
  e_status text;
  oid uuid;
  refunded_total bigint;
BEGIN
  IF NEW.type = 'escrow_refund' AND (NEW.metadata ? 'order_id') THEN
    oid := NULLIF(NEW.metadata->>'order_id','')::uuid;
    SELECT amount, shipping_fee, status
      INTO e_amount, e_shipping, e_status
    FROM escrow_transactions
    WHERE order_id = oid
    FOR UPDATE;

    IF e_amount IS NULL THEN
      RAISE EXCEPTION 'Refund references unknown escrow/order';
    END IF;

    IF e_status NOT IN ('funded','disputed','refunded') THEN
      RAISE EXCEPTION 'Refund not allowed for escrow status %', e_status;
    END IF;

    SELECT COALESCE(SUM(ABS(le.amount)) FILTER (
      WHERE la.code IN ('livi_customer_liability_xof','livi_shipping_payable_xof')
    ),0)::bigint
      INTO refunded_total
    FROM ledger_transactions lt
    JOIN ledger_entries le ON le.transaction_id = lt.id
    JOIN ledger_accounts la ON la.id = le.account_id
    WHERE lt.type = 'escrow_refund'
      AND lt.metadata->>'order_id' = oid::text;

    IF refunded_total > e_amount + e_shipping THEN
      RAISE EXCEPTION 'Refund exceeds original escrow amount';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refund_ledger_guard ON ledger_transactions;
CREATE CONSTRAINT TRIGGER refund_ledger_guard
AFTER INSERT ON ledger_transactions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION livi_refund_ledger_guard();

