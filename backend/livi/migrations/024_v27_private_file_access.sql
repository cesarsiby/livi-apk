
CREATE TABLE IF NOT EXISTS kyc_file_access_logs(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_document_id uuid NOT NULL REFERENCES kyc_documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  access_type varchar(30) NOT NULL CHECK (access_type IN ('token_issued','downloaded')),
  expires_at timestamptz,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyc_file_access_document_created
  ON kyc_file_access_logs(kyc_document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kyc_file_access_user_created
  ON kyc_file_access_logs(user_id, created_at DESC);

