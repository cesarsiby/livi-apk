CREATE TABLE IF NOT EXISTS payout_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES users(id),amount bigint NOT NULL CHECK(amount>0),currency char(3) NOT NULL DEFAULT 'XOF',destination_ref text NOT NULL,status varchar(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','paid','failed','cancelled')),reference varchar(120) UNIQUE NOT NULL,provider_reference varchar(160),failure_reason text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),paid_at timestamptz
);
CREATE INDEX IF NOT EXISTS payout_user_status_idx ON payout_requests(user_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS payout_pending_idx ON payout_requests(status,created_at) WHERE status='pending';
ALTER TABLE idempotency_keys ALTER COLUMN user_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS partner_events_unprocessed_idx ON partner_payment_events(created_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS audit_request_idx ON audit_logs(request_id);
CREATE OR REPLACE FUNCTION prevent_payout_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.status IN ('paid','failed','cancelled') AND (NEW.amount,NEW.destination_ref,NEW.user_id,NEW.reference) IS DISTINCT FROM (OLD.amount,OLD.destination_ref,OLD.user_id,OLD.reference) THEN RAISE EXCEPTION 'Final payout immutable'; END IF; RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS payout_immutable_fields ON payout_requests;
CREATE TRIGGER payout_immutable_fields BEFORE UPDATE ON payout_requests FOR EACH ROW EXECUTE FUNCTION prevent_payout_mutation();
