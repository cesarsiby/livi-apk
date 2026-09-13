-- V53 — audit base de données : users.role (rôle principal) et user_roles
-- (appartenance multi-rôles, PK (user_id, role)) utilisent déjà exactement
-- le même CHECK ('client','vendor','transporter','admin') — pas de
-- vocabulaire divergent. Mais rien ne les maintient synchronisés au niveau
-- base : src/services/auth.js écrit bien les deux tables à l'inscription et
-- à la première connexion OTP, mais uniquement par discipline applicative,
-- dans deux requêtes distinctes non transactionnelles. Un futur chemin de
-- création d'utilisateur (ex. création manuelle par un admin) qui oublierait
-- d'insérer dans user_roles romprait silencieusement la cohérence.
--
-- Ce projet applique déjà ce principe de "seconde ligne de défense" pour
-- d'autres cohérences de rôle (livi_payout_role_guard V24,
-- livi_assert_payout_owner_role V29, livi_kyc_subject_role_guard V30) ;
-- ce trigger comble le même type de trou pour users <-> user_roles.
--
-- Sémantique volontairement additive : user_roles représente l'ensemble
-- des rôles jamais détenus par l'utilisateur, pas seulement le rôle actuel
-- (un vendeur qui redevient client visuellement via users.role reste un
-- vendeur historique). Ce trigger n'insère donc jamais de DELETE — il
-- garantit seulement que le rôle courant de users.role est toujours
-- présent dans user_roles, sans jamais retirer un rôle existant.
CREATE OR REPLACE FUNCTION livi_sync_user_roles() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO user_roles(user_id, role) VALUES (NEW.id, NEW.role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_user_roles ON users;
CREATE TRIGGER trg_sync_user_roles
  AFTER INSERT OR UPDATE OF role ON users
  FOR EACH ROW EXECUTE FUNCTION livi_sync_user_roles();
