-- LIVI V20: cancellation/refund/dispute state machine guards.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_restored_at timestamptz;
CREATE INDEX IF NOT EXISTS orders_stock_restore_idx ON orders(stock_restored_at) WHERE stock_restored_at IS NOT NULL;

-- A payment-pending order cannot be cancelled locally: the partner may still
-- confirm the payment. Cancellation starts only before payment initialization,
-- or after a funded escrow where cancellation is converted into a refund.
CREATE OR REPLACE FUNCTION livi_v20_order_financial_state_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  e_status text;
BEGIN
  SELECT status INTO e_status FROM escrow_transactions WHERE order_id=NEW.id;

  IF NEW.status='cancelled' AND COALESCE(e_status,'') NOT IN ('cancelled','awaiting_payment') THEN
    RAISE EXCEPTION 'Cancelled order % requires an unpaid/cancelled escrow, found %', NEW.id, e_status;
  END IF;

  IF NEW.status='refunded' AND e_status IS DISTINCT FROM 'refunded' THEN
    RAISE EXCEPTION 'Refunded order % requires refunded escrow', NEW.id;
  END IF;

  IF NEW.status='completed' AND e_status IS DISTINCT FROM 'released' THEN
    RAISE EXCEPTION 'Completed order % requires released escrow', NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_v20_financial_state_guard ON orders;
CREATE CONSTRAINT TRIGGER order_v20_financial_state_guard
AFTER INSERT OR UPDATE ON orders
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION livi_v20_order_financial_state_guard();

-- A dispute is only meaningful once the order has been paid and the escrow is
-- still economically unresolved.
CREATE OR REPLACE FUNCTION livi_v20_dispute_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  o_status text;
  e_status text;
BEGIN
  SELECT status INTO o_status FROM orders WHERE id=NEW.order_id;
  SELECT status INTO e_status FROM escrow_transactions WHERE order_id=NEW.order_id;
  IF NEW.status='open' AND o_status NOT IN ('paid','preparing','shipping','delivered','disputed') THEN
    RAISE EXCEPTION 'Order % cannot open a dispute from status %', NEW.order_id, o_status;
  END IF;
  IF NEW.status='open' AND e_status NOT IN ('funded','disputed') THEN
    RAISE EXCEPTION 'Order % dispute requires funded/disputed escrow, found %', NEW.order_id, e_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dispute_v20_guard ON disputes;
CREATE CONSTRAINT TRIGGER dispute_v20_guard
AFTER INSERT OR UPDATE ON disputes
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION livi_v20_dispute_guard();

