-- LIVI V8: cryptographic proof of seller->transporter pickup and transporter->buyer delivery.
CREATE TABLE IF NOT EXISTS shipment_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  proof_type varchar(30) NOT NULL CHECK (proof_type IN ('seller_pickup','buyer_delivery')),
  token_hash char(64) NOT NULL UNIQUE,
  token_hint varchar(12),
  pin_hash char(64) NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by uuid REFERENCES users(id),
  revoked_at timestamptz,
  attempts int NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts int NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shipment_id, proof_type)
);
CREATE INDEX IF NOT EXISTS shipment_proofs_shipment_idx ON shipment_proofs(shipment_id, proof_type);
CREATE INDEX IF NOT EXISTS shipment_proofs_active_idx ON shipment_proofs(expires_at) WHERE used_at IS NULL AND revoked_at IS NULL;

ALTER TABLE shipments ADD COLUMN IF NOT EXISTS pickup_proof_used_at timestamptz;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS delivery_proof_used_at timestamptz;

CREATE TABLE IF NOT EXISTS shipment_proof_events (
  id bigserial PRIMARY KEY,
  proof_id uuid NOT NULL REFERENCES shipment_proofs(id),
  shipment_id uuid NOT NULL REFERENCES shipments(id),
  actor_user_id uuid REFERENCES users(id),
  result varchar(30) NOT NULL CHECK (result IN ('success','invalid','expired','replayed','revoked','attempt_limit')),
  request_id varchar(120),
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shipment_proof_events_idx ON shipment_proof_events(shipment_id,created_at);
