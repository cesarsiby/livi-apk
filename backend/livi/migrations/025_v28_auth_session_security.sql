ALTER TABLE auth_refresh_tokens
  ADD COLUMN IF NOT EXISTS device_name varchar(120),
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_reason varchar(80);

CREATE INDEX IF NOT EXISTS idx_refresh_active_user ON auth_refresh_tokens(user_id, revoked_at, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_refresh_last_used ON auth_refresh_tokens(user_id, last_used_at DESC);

-- A refresh token may only be revoked, never rewritten into a new session.
CREATE OR REPLACE FUNCTION prevent_refresh_token_identity_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id <> OLD.user_id OR NEW.jti <> OLD.jti OR NEW.token_hash <> OLD.token_hash OR NEW.expires_at <> OLD.expires_at THEN
    RAISE EXCEPTION 'auth_refresh_tokens identity is immutable';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS refresh_token_identity_guard ON auth_refresh_tokens;
CREATE TRIGGER refresh_token_identity_guard BEFORE UPDATE ON auth_refresh_tokens
FOR EACH ROW EXECUTE FUNCTION prevent_refresh_token_identity_change();

-- A consumed OTP cannot be made active again.
CREATE OR REPLACE FUNCTION prevent_otp_reactivation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.consumed_at IS NOT NULL AND NEW.consumed_at IS NULL THEN
    RAISE EXCEPTION 'Consumed OTP cannot be reactivated';
  END IF;
  IF NEW.attempts < OLD.attempts THEN
    RAISE EXCEPTION 'OTP attempts cannot decrease';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS otp_integrity_guard ON auth_otp_challenges;
CREATE TRIGGER otp_integrity_guard BEFORE UPDATE ON auth_otp_challenges
FOR EACH ROW EXECUTE FUNCTION prevent_otp_reactivation();
