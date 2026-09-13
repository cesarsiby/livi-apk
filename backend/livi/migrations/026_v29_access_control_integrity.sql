ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_version integer NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION livi_assert_payout_owner_role()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  SELECT role INTO r FROM users WHERE id=NEW.user_id;
  IF r IS NULL OR r NOT IN ('vendor','transporter') THEN
    RAISE EXCEPTION 'Payout owner must be vendor or transporter';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_payout_owner_role ON payout_requests;
CREATE TRIGGER trg_payout_owner_role BEFORE INSERT OR UPDATE OF user_id ON payout_requests
FOR EACH ROW EXECUTE FUNCTION livi_assert_payout_owner_role();

CREATE OR REPLACE FUNCTION livi_assert_shipment_assignment()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r text; k text;
BEGIN
  IF NEW.transporter_id IS NOT NULL THEN
    SELECT u.role,t.kyc_status INTO r,k FROM users u JOIN transporters t ON t.id=u.id WHERE u.id=NEW.transporter_id;
    IF r <> 'transporter' OR k <> 'approved' THEN
      RAISE EXCEPTION 'Shipment transporter must be approved';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_shipment_assignment ON shipments;
CREATE TRIGGER trg_shipment_assignment BEFORE INSERT OR UPDATE OF transporter_id ON shipments
FOR EACH ROW EXECUTE FUNCTION livi_assert_shipment_assignment();
