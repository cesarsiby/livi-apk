-- LIVI V24: database-level authorization and ownership invariants.

-- Every business row must reference a user with the correct role.
CREATE OR REPLACE FUNCTION livi_assert_user_role(p_user_id uuid, p_role text, p_context text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual_role text;
BEGIN
  SELECT role INTO actual_role FROM users WHERE id=p_user_id;
  IF actual_role IS NULL THEN RAISE EXCEPTION '% references unknown user', p_context; END IF;
  IF actual_role <> p_role THEN RAISE EXCEPTION '% requires role %, got %', p_context, p_role, actual_role; END IF;
END; $$;

CREATE OR REPLACE FUNCTION livi_product_owner_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM livi_assert_user_role(NEW.vendor_id,'vendor','product.vendor_id'); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS product_owner_guard ON products;
CREATE CONSTRAINT TRIGGER product_owner_guard AFTER INSERT OR UPDATE OF vendor_id ON products DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION livi_product_owner_guard();

CREATE OR REPLACE FUNCTION livi_order_party_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM livi_assert_user_role(NEW.buyer_id,'client','order.buyer_id');
  PERFORM livi_assert_user_role(NEW.vendor_id,'vendor','order.vendor_id');
  IF NOT EXISTS (SELECT 1 FROM user_addresses a WHERE a.id=NEW.delivery_address_id AND a.user_id=NEW.buyer_id) THEN
    RAISE EXCEPTION 'Order delivery address does not belong to buyer';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS order_party_guard ON orders;
CREATE CONSTRAINT TRIGGER order_party_guard AFTER INSERT OR UPDATE OF buyer_id,vendor_id,delivery_address_id ON orders DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION livi_order_party_guard();

CREATE OR REPLACE FUNCTION livi_escrow_party_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ob uuid; ov uuid;
BEGIN
  SELECT buyer_id,vendor_id INTO ob,ov FROM orders WHERE id=NEW.order_id;
  IF ob IS NULL THEN RAISE EXCEPTION 'Escrow references unknown order'; END IF;
  IF NEW.buyer_id IS DISTINCT FROM ob OR NEW.vendor_id IS DISTINCT FROM ov THEN RAISE EXCEPTION 'Escrow parties do not match order'; END IF;
  PERFORM livi_assert_user_role(NEW.buyer_id,'client','escrow.buyer_id');
  PERFORM livi_assert_user_role(NEW.vendor_id,'vendor','escrow.vendor_id');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS escrow_party_guard ON escrow_transactions;
CREATE CONSTRAINT TRIGGER escrow_party_guard AFTER INSERT OR UPDATE OF order_id,buyer_id,vendor_id ON escrow_transactions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION livi_escrow_party_guard();

CREATE OR REPLACE FUNCTION livi_shipment_party_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ov uuid;
BEGIN
  SELECT vendor_id INTO ov FROM orders WHERE id=NEW.order_id;
  IF ov IS NULL THEN RAISE EXCEPTION 'Shipment references unknown order'; END IF;
  IF NEW.transporter_id IS NOT NULL THEN PERFORM livi_assert_user_role(NEW.transporter_id,'transporter','shipment.transporter_id'); END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS shipment_party_guard ON shipments;
CREATE CONSTRAINT TRIGGER shipment_party_guard AFTER INSERT OR UPDATE OF order_id,transporter_id ON shipments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION livi_shipment_party_guard();

CREATE OR REPLACE FUNCTION livi_payout_role_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actual_role text;
BEGIN
  SELECT role INTO actual_role FROM users WHERE id=NEW.user_id;
  IF actual_role NOT IN ('vendor','transporter') THEN RAISE EXCEPTION 'Payout beneficiary must be vendor or transporter'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS payout_role_guard ON payout_requests;
CREATE CONSTRAINT TRIGGER payout_role_guard AFTER INSERT OR UPDATE OF user_id ON payout_requests DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION livi_payout_role_guard();

CREATE OR REPLACE FUNCTION livi_dispute_actor_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE buyer uuid; vendor uuid;
BEGIN
  SELECT buyer_id,vendor_id INTO buyer,vendor FROM orders WHERE id=NEW.order_id;
  IF NEW.opened_by IS DISTINCT FROM buyer AND NEW.opened_by IS DISTINCT FROM vendor THEN
    RAISE EXCEPTION 'Dispute opener is not a party to the order';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS dispute_actor_guard ON disputes;
CREATE CONSTRAINT TRIGGER dispute_actor_guard AFTER INSERT OR UPDATE OF order_id,opened_by ON disputes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION livi_dispute_actor_guard();

-- A message sender must be a member of its conversation.
CREATE OR REPLACE FUNCTION livi_message_sender_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id=NEW.conversation_id AND user_id=NEW.sender_id) THEN
    RAISE EXCEPTION 'Message sender is not a conversation member';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS message_sender_guard ON messages;
CREATE CONSTRAINT TRIGGER message_sender_guard AFTER INSERT OR UPDATE OF conversation_id,sender_id ON messages DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION livi_message_sender_guard();

-- KYC reviewers must be administrators.
CREATE OR REPLACE FUNCTION livi_kyc_reviewer_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE reviewer_role text;
BEGIN
  IF NEW.reviewed_by IS NOT NULL THEN
    SELECT role INTO reviewer_role FROM users WHERE id=NEW.reviewed_by;
    IF reviewer_role IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'KYC reviewer must be admin'; END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS kyc_reviewer_guard ON kyc_documents;
CREATE CONSTRAINT TRIGGER kyc_reviewer_guard AFTER INSERT OR UPDATE OF reviewed_by ON kyc_documents DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION livi_kyc_reviewer_guard();

-- Useful ownership indexes for authorization queries.
CREATE INDEX IF NOT EXISTS orders_buyer_idx ON orders(buyer_id,created_at DESC);
CREATE INDEX IF NOT EXISTS orders_vendor_idx ON orders(vendor_id,created_at DESC);
CREATE INDEX IF NOT EXISTS shipments_transporter_idx ON shipments(transporter_id,created_at DESC);
CREATE INDEX IF NOT EXISTS disputes_order_opened_idx ON disputes(order_id,opened_by,created_at DESC);
CREATE INDEX IF NOT EXISTS kyc_user_status_idx ON kyc_documents(user_id,status,created_at DESC);

