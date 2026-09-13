-- V10: recoverable encrypted proof credentials for stable QR/PIN display
ALTER TABLE shipment_proofs
  ADD COLUMN IF NOT EXISTS secret_ciphertext text,
  ADD COLUMN IF NOT EXISTS secret_iv text,
  ADD COLUMN IF NOT EXISTS secret_tag text;

CREATE INDEX IF NOT EXISTS idx_shipment_proofs_active
  ON shipment_proofs(shipment_id, proof_type, used_at, revoked_at, expires_at);
