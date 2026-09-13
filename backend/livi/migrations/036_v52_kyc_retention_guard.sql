-- V52 — audit base de données : kyc_documents.user_id était défini en
-- ON DELETE CASCADE depuis la migration initiale. Or kyc_documents
-- contient des pièces justificatives d'identité/conformité (CNI,
-- passeport, permis, registre de commerce...) qui relèvent typiquement
-- d'obligations de conservation même après suppression d'un compte, et non
-- de données jetables qui doivent disparaître avec l'utilisateur. Ce projet
-- applique déjà ce principe ailleurs (audit_logs, ledger_entries, etc. sont
-- protégés contre la suppression) ; kyc_documents en était l'exception.
--
-- Constat : aucun chemin de code applicatif ne fait aujourd'hui de
-- `DELETE FROM users` (seulement des scripts de test/scénario) — ce
-- changement est donc un durcissement préventif ("seconde ligne de
-- défense"), pas la correction d'un bug actif.
--
-- Le nom de la contrainte FK d'origine étant auto-généré par Postgres
-- (colonne définie en ligne dans la migration 001, sans CONSTRAINT nommé),
-- on la retrouve dynamiquement plutôt que de supposer son nom exact.
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
   AND tc.table_schema = ccu.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name = 'kyc_documents'
    AND kcu.column_name = 'user_id'
    AND ccu.table_name = 'users'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE kyc_documents DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE kyc_documents
  ADD CONSTRAINT kyc_documents_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
