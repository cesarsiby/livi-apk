-- V25 security hardening: no secrets/file keys exposed through broad SELECTs,
-- safe KYC document types, and constraints that prevent malformed KYC references.
--
-- SESSION 26 (§34 prompt maître) : corrigé après avoir découvert, en
-- comparant ce fichier à une ré-upload manuelle sur GitHub, que la liste ici
-- ne contenait que 5 types alors que KYC_DOCUMENT_TYPES
-- (routes/kyc.js, utilisé par la vraie route de soumission dans
-- compatibility.js) en autorise 10 depuis un moment — 'permis', 'assurance',
-- 'identity', 'business', 'address' passaient donc la validation Zod
-- applicative pour échouer ensuite sur une contrainte DB générique (23514),
-- jamais avec le message clair que la validation applicative aurait donné.
-- Exactement l'écart que le §34 demande de fermer, dans l'autre sens que
-- prévu : ce n'est pas la contrainte DB qui était seule à valider, c'est la
-- validation applicative qui autorisait plus large que ce que la DB
-- acceptait réellement. Un test compare désormais les deux listes
-- littéralement pour qu'un futur ajout d'un côté sans l'autre soit détecté.
ALTER TABLE kyc_documents DROP CONSTRAINT IF EXISTS kyc_document_type_check;
ALTER TABLE kyc_documents ADD CONSTRAINT kyc_document_type_check CHECK (document_type IN ('cni','passport','permis','assurance','business_registration','tax_document','identity','business','address','other'));
ALTER TABLE kyc_documents ADD CONSTRAINT kyc_file_key_no_traversal CHECK (file_key NOT LIKE '%..%' AND file_key NOT LIKE '%/%' AND file_key NOT LIKE '%\\%' AND position(chr(0) in file_key)=0);
CREATE INDEX IF NOT EXISTS idx_auth_otp_phone_purpose_created ON auth_otp_challenges(phone,purpose,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipment_proofs_shipment_type_active ON shipment_proofs(shipment_id,proof_type,used_at,revoked_at,expires_at);
