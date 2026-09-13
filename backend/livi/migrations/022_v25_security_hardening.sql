-- V25 security hardening: no secrets/file keys exposed through broad SELECTs,
-- safe KYC document types, and constraints that prevent malformed KYC references.

ALTER TABLE kyc_documents
  DROP CONSTRAINT IF EXISTS kyc_document_type_check;

ALTER TABLE kyc_documents
  ADD CONSTRAINT kyc_document_type_check
  CHECK (
    document_type IN (
      'cni',
      'passport',
      'business_registration',
      'tax_document',
      'other'
    )
  );

ALTER TABLE kyc_documents
  ADD CONSTRAINT kyc_file_key_no_traversal
  CHECK (
    file_key NOT LIKE '%..%'
    AND file_key NOT LIKE '%/%'
    AND file_key NOT LIKE '%\\%'
  );

CREATE INDEX IF NOT EXISTS idx_auth_otp_phone_purpose_created
  ON auth_otp_challenges(phone, purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shipment_proofs_shipment_type_active
  ON shipment_proofs(
    shipment_id,
    proof_type,
    used_at,
    revoked_at,
    expires_at
  );
