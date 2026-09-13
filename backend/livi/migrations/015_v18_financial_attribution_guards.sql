-- LIVI V18: intégrité d'attribution par commande et bénéficiaire.
-- Empêche qu'un escrow, une livraison ou une écriture de payable soit rattaché
-- à un mauvais acteur.

CREATE OR REPLACE FUNCTION livi_order_escrow_identity_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  ob uuid; ov uuid;
BEGIN
  SELECT buyer_id, vendor_id INTO ob, ov FROM orders WHERE id = NEW.order_id;
  IF ob IS NULL THEN RAISE EXCEPTION 'Escrow references unknown order'; END IF;
  IF NEW.buyer_id IS DISTINCT FROM ob THEN RAISE EXCEPTION 'Escrow buyer mismatch with order'; END IF;
  IF NEW.vendor_id IS DISTINCT FROM ov THEN RAISE EXCEPTION 'Escrow vendor mismatch with order'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS order_escrow_identity_guard ON escrow_transactions;
CREATE CONSTRAINT TRIGGER order_escrow_identity_guard
AFTER INSERT OR UPDATE ON escrow_transactions
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION livi_order_escrow_identity_guard();

CREATE OR REPLACE FUNCTION livi_shipment_identity_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  expected_transporter uuid;
BEGIN
  IF NEW.transporter_id IS NOT NULL THEN
    SELECT transporter_id INTO expected_transporter FROM shipments WHERE id = NEW.id;
  END IF;
  -- Prevent reassignment after pickup/delivery; a mission owner must remain stable.
  IF TG_OP = 'UPDATE' AND OLD.transporter_id IS NOT NULL
     AND NEW.transporter_id IS DISTINCT FROM OLD.transporter_id
     AND OLD.status IN ('picked_up','in_transit','delivered','completed') THEN
    RAISE EXCEPTION 'Transporter cannot be changed after pickup';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS shipment_identity_guard ON shipments;
CREATE TRIGGER shipment_identity_guard
BEFORE UPDATE ON shipments
FOR EACH ROW EXECUTE FUNCTION livi_shipment_identity_guard();

CREATE OR REPLACE FUNCTION livi_order_financial_amount_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.total_amount IS DISTINCT FROM NEW.subtotal_amount + NEW.shipping_fee THEN
    RAISE EXCEPTION 'Order total must equal subtotal plus shipping fee';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS order_financial_amount_guard ON orders;
CREATE TRIGGER order_financial_amount_guard
BEFORE INSERT OR UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION livi_order_financial_amount_guard();

-- Financial operation keys must remain unique even under concurrent webhook retries.
CREATE UNIQUE INDEX IF NOT EXISTS financial_operations_operation_key_uq
  ON financial_operations(operation_key);

-- Useful indexes for reconciliation and ownership audits.
CREATE INDEX IF NOT EXISTS ledger_entries_order_metadata_idx
  ON ledger_transactions ((metadata->>'order_id'))
  WHERE metadata ? 'order_id';
CREATE INDEX IF NOT EXISTS escrow_identity_idx
  ON escrow_transactions(order_id,buyer_id,vendor_id,status);
CREATE INDEX IF NOT EXISTS payout_owner_status_idx
  ON payout_requests(user_id,status,created_at);

