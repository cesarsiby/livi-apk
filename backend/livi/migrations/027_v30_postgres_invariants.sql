-- LIVI V30: PostgreSQL invariants for order composition and financial attribution.
-- Goal: prevent database-level corruption even when requests race or bypass the API.

-- 1) Order total must always equal subtotal + shipping.
CREATE OR REPLACE FUNCTION livi_order_amount_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.total_amount IS DISTINCT FROM NEW.subtotal_amount + NEW.shipping_fee THEN
    RAISE EXCEPTION 'Order % total_amount must equal subtotal_amount + shipping_fee', NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_amount_guard ON orders;
CREATE CONSTRAINT TRIGGER trg_order_amount_guard
AFTER INSERT OR UPDATE OF subtotal_amount,shipping_fee,total_amount
ON orders DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION livi_order_amount_guard();

-- 2) Every order item must belong to the same vendor as the order.
CREATE OR REPLACE FUNCTION livi_order_item_vendor_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE order_vendor uuid;
DECLARE product_vendor uuid;
BEGIN
  SELECT vendor_id INTO order_vendor FROM orders WHERE id=NEW.order_id;
  SELECT vendor_id INTO product_vendor FROM products WHERE id=NEW.product_id;

  IF order_vendor IS NULL OR product_vendor IS NULL THEN
    RAISE EXCEPTION 'Order item references an unknown order or product';
  END IF;

  IF product_vendor IS DISTINCT FROM order_vendor THEN
    RAISE EXCEPTION 'Order item product vendor does not match order vendor';
  END IF;

  IF NEW.total_price IS DISTINCT FROM NEW.unit_price * NEW.quantity THEN
    RAISE EXCEPTION 'Order item % total_price must equal unit_price * quantity', NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_item_vendor_guard ON order_items;
CREATE CONSTRAINT TRIGGER trg_order_item_vendor_guard
AFTER INSERT OR UPDATE OF order_id,product_id,unit_price,quantity,total_price
ON order_items DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION livi_order_item_vendor_guard();

-- 3) An escrow must represent exactly the order subtotal plus separately
-- recorded shipping. This matches LIVI's convention where shipping is not
-- part of the seller's merchandise payable.
CREATE OR REPLACE FUNCTION livi_escrow_amount_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE subtotal bigint;
DECLARE shipping bigint;
DECLARE total bigint;
BEGIN
  SELECT subtotal_amount,shipping_fee,total_amount
    INTO subtotal,shipping,total
  FROM orders WHERE id=NEW.order_id;

  IF subtotal IS NULL THEN
    RAISE EXCEPTION 'Escrow references unknown order';
  END IF;

  IF NEW.amount IS DISTINCT FROM subtotal THEN
    RAISE EXCEPTION 'Escrow % amount must equal order subtotal', NEW.id;
  END IF;

  IF NEW.shipping_fee IS DISTINCT FROM shipping THEN
    RAISE EXCEPTION 'Escrow % shipping_fee must equal order shipping_fee', NEW.id;
  END IF;

  IF total IS DISTINCT FROM subtotal + shipping THEN
    RAISE EXCEPTION 'Order % has inconsistent total', NEW.order_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_escrow_amount_guard ON escrow_transactions;
CREATE CONSTRAINT TRIGGER trg_escrow_amount_guard
AFTER INSERT OR UPDATE OF order_id,amount,shipping_fee
ON escrow_transactions DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION livi_escrow_amount_guard();

-- 4) KYC ownership: KYC documents may only belong to users for whom KYC
-- makes business sense in LIVI (vendor/transporter). Admin/client KYC records
-- are rejected at DB level.
CREATE OR REPLACE FUNCTION livi_kyc_subject_role_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  SELECT role INTO r FROM users WHERE id=NEW.user_id;
  IF r IS NULL OR r NOT IN ('vendor','transporter') THEN
    RAISE EXCEPTION 'KYC document owner must be vendor or transporter';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kyc_subject_role_guard ON kyc_documents;
CREATE TRIGGER trg_kyc_subject_role_guard
BEFORE INSERT OR UPDATE OF user_id ON kyc_documents
FOR EACH ROW EXECUTE FUNCTION livi_kyc_subject_role_guard();

-- 5) Product media and dispute evidence are private-file references.
-- Empty/obviously-public URLs are rejected; storage implementation still
-- enforces private access at the application/object-store layer.
CREATE OR REPLACE FUNCTION livi_private_file_key_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.file_key IS NULL OR btrim(NEW.file_key) = '' OR NEW.file_key ~ '(^/|^https?://|(^|/)\.\.(/|$))' THEN
    RAISE EXCEPTION 'Private file_key is invalid';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kyc_private_file_guard ON kyc_documents;
CREATE TRIGGER trg_kyc_private_file_guard
BEFORE INSERT OR UPDATE OF file_key ON kyc_documents
FOR EACH ROW EXECUTE FUNCTION livi_private_file_key_guard();

DROP TRIGGER IF EXISTS trg_dispute_private_file_guard ON dispute_evidence;
CREATE TRIGGER trg_dispute_private_file_guard
BEFORE INSERT OR UPDATE OF file_key ON dispute_evidence
FOR EACH ROW EXECUTE FUNCTION livi_private_file_key_guard();

-- 6) Shipment transporter assignment must keep the business identity intact.
CREATE OR REPLACE FUNCTION livi_shipment_transporter_identity_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r text;
DECLARE k text;
BEGIN
  IF NEW.transporter_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT u.role,t.kyc_status INTO r,k
  FROM users u JOIN transporters t ON t.id=u.id
  WHERE u.id=NEW.transporter_id;

  IF r IS DISTINCT FROM 'transporter' OR k IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Shipment transporter must be an approved transporter';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shipment_transporter_identity_guard ON shipments;
CREATE TRIGGER trg_shipment_transporter_identity_guard
BEFORE INSERT OR UPDATE OF transporter_id ON shipments
FOR EACH ROW EXECUTE FUNCTION livi_shipment_transporter_identity_guard();

