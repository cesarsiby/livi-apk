-- LIVI V13: database guard tying escrow release to delivery proof.
-- Deferred so the application can update shipment/order/escrow in one transaction.

CREATE OR REPLACE FUNCTION livi_assert_escrow_release_has_delivery_proof()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  proof_time timestamptz;
BEGIN
  IF NEW.status = 'released' THEN
    SELECT s.delivery_proof_used_at
      INTO proof_time
    FROM shipments s
    WHERE s.order_id = NEW.order_id;

    IF proof_time IS NULL THEN
      RAISE EXCEPTION 'Escrow % cannot be released before buyer delivery proof is consumed', NEW.id;
    END IF;

    IF NEW.released_at IS NULL THEN
      RAISE EXCEPTION 'Released escrow % must have released_at', NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS escrow_release_delivery_guard ON escrow_transactions;
CREATE CONSTRAINT TRIGGER escrow_release_delivery_guard
AFTER INSERT OR UPDATE ON escrow_transactions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION livi_assert_escrow_release_has_delivery_proof();

