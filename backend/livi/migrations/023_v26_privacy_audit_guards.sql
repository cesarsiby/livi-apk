-- V26: privacy/audit hardening.
-- Audit records must not be used as a storage location for authentication
-- secrets or private file-storage keys. Application code redacts these values;
-- this migration adds retention/indexing support without exposing KYC keys.
CREATE INDEX IF NOT EXISTS audit_created_at_idx ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS kyc_user_status_idx ON kyc_documents(user_id,status,created_at DESC);

-- Prevent accidental direct public exposure through a convenience view.
CREATE OR REPLACE VIEW kyc_documents_safe AS
SELECT id,user_id,document_type,status,rejection_reason,reviewed_by,reviewed_at,created_at
FROM kyc_documents;
