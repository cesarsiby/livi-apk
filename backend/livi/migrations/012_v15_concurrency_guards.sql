-- LIVI V15: concurrency and state-integrity guards.

-- A payout reservation is serialized per user. This prevents two concurrent
-- withdrawal requests from both observing the same available payable balance.
CREATE OR REPLACE FUNCTION livi_payout_user_lock(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('livi:payout:user:' || p_user_id::text, 0));
END;
$$;

-- Prevent more than one open/processing payout reservation per user from
-- exceeding the payable balance at application level; the advisory lock above
-- serializes the calculation. Keep a fast lookup index for the reservation set.
CREATE INDEX IF NOT EXISTS payout_user_reserved_idx
ON payout_requests(user_id, status, amount)
WHERE status IN ('pending','processing');

-- A payout may only become paid once a provider reference exists. The API also
-- enforces this in production, but the database is the final guard.
CREATE OR REPLACE FUNCTION livi_payout_paid_requires_provider()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'paid' AND (NEW.provider IS NULL OR NEW.provider_reference IS NULL OR btrim(NEW.provider) = '' OR btrim(NEW.provider_reference) = '') THEN
    RAISE EXCEPTION 'Paid payout requires provider and provider_reference';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payout_paid_provider_guard ON payout_requests;
CREATE CONSTRAINT TRIGGER payout_paid_provider_guard
AFTER INSERT OR UPDATE ON payout_requests
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION livi_payout_paid_requires_provider();

-- A used delivery proof is immutable. Rotation is only valid before use.
CREATE OR REPLACE FUNCTION livi_proof_no_mutation_after_use()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.used_at IS NOT NULL AND (
    NEW.token_hash IS DISTINCT FROM OLD.token_hash OR
    NEW.pin_hash IS DISTINCT FROM OLD.pin_hash OR
    NEW.secret_ciphertext IS DISTINCT FROM OLD.secret_ciphertext OR
    NEW.secret_iv IS DISTINCT FROM OLD.secret_iv OR
    NEW.secret_tag IS DISTINCT FROM OLD.secret_tag OR
    NEW.expires_at IS DISTINCT FROM OLD.expires_at OR
    NEW.used_at IS DISTINCT FROM OLD.used_at OR
    NEW.used_by IS DISTINCT FROM OLD.used_by OR
    NEW.revoked_at IS DISTINCT FROM OLD.revoked_at OR
    NEW.attempts IS DISTINCT FROM OLD.attempts
  ) THEN
    RAISE EXCEPTION 'Used delivery proof is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS proof_used_immutable_guard ON shipment_proofs;
CREATE TRIGGER proof_used_immutable_guard
BEFORE UPDATE ON shipment_proofs
FOR EACH ROW EXECUTE FUNCTION livi_proof_no_mutation_after_use();

