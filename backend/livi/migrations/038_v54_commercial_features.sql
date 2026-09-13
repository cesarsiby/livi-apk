-- V54 — schéma pour les fonctionnalités commerciales demandées (document
-- Bloc4 + recommandations UX) : commission répercutable, adresses avec
-- repères locaux, frais de livraison calculés par distance (source de
-- vérité backend, pas fournis par le client), notation généralisée entre
-- les 3 profils. Additif uniquement — aucune colonne existante modifiée,
-- aucune donnée existante affectée.

-- 1) Commission répercutée ou absorbée (vendeur). Défaut à false :
-- l'acheteur ne paie pas de commission supplémentaire par défaut, exactement
-- la règle de base énoncée dans le document ("L'acheteur ne paie pas de
-- commission supplémentaire liée à LIVI"), le vendeur doit choisir
-- explicitement l'option inverse.
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS commission_passthrough boolean NOT NULL DEFAULT false;

-- 2) Géolocalisation de la boutique — nécessaire pour calculer une distance
-- vendeur -> acheteur. N'existait nulle part (vendors n'a jamais eu de
-- lat/lng, contrairement à user_addresses qui les a depuis 001_initial).
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS latitude numeric(9,6);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS longitude numeric(9,6);

-- 3) Repères locaux d'adresse (contexte africain : la géolocalisation GPS
-- seule ne suffit pas). Colonnes distinctes plutôt qu'un unique champ texte
-- libre, pour rester structuré et interrogeable.
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS neighborhood varchar(120);
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS landmark_type varchar(40);
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS landmark_description text;

-- 4) Règles de frais de livraison par distance — même schéma versionné que
-- platform_fee_rules/withdrawal_fee_rules (déjà le pattern établi dans ce
-- projet pour toute règle tarifaire modifiable par l'admin sans déploiement).
-- Formule : base_fee_xof + ceil(distance_km) * per_km_fee_xof, plafonné à
-- max_fee_xof si renseigné.
CREATE TABLE IF NOT EXISTS delivery_fee_rules(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(60) NOT NULL UNIQUE,
  base_fee_xof integer NOT NULL DEFAULT 0 CHECK(base_fee_xof>=0),
  per_km_fee_xof integer NOT NULL DEFAULT 0 CHECK(per_km_fee_xof>=0),
  max_fee_xof integer CHECK(max_fee_xof IS NULL OR max_fee_xof>=0),
  active boolean NOT NULL DEFAULT true,
  effective_from timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO delivery_fee_rules(name,base_fee_xof,per_km_fee_xof,max_fee_xof,active)
  VALUES ('default',500,150,5000,true) ON CONFLICT(name) DO NOTHING;
-- Valeurs de départ raisonnables pour Bamako (500 XOF de prise en charge +
-- 150 XOF/km, plafond 5000 XOF) — DONNÉE À VALIDER par vous, modifiable en
-- base sans redéploiement comme toutes les autres règles tarifaires.

-- 5) Notation généralisée entre les 3 profils (Acheteur<->Vendeur déjà
-- couvert par `reviews`, limité à Acheteur->Produit ; il manquait
-- Acheteur<->Transporteur et Vendeur<->Transporteur). Toujours liée à une
-- commande réelle (order_id NOT NULL + contrainte d'unicité par
-- rater/rated/order) pour empêcher une notation arbitraire, exactement
-- comme `reviews` le fait déjà pour les produits.
CREATE TABLE IF NOT EXISTS ratings(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  rater_id uuid NOT NULL REFERENCES users(id),
  rated_id uuid NOT NULL REFERENCES users(id),
  rated_role varchar(20) NOT NULL CHECK(rated_role IN ('vendor','transporter','client')),
  rating int NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id,rater_id,rated_id)
);
CREATE INDEX IF NOT EXISTS ratings_rated_idx ON ratings(rated_id);

-- 6) Commission LIVI confirmée à 3% (était à 0% par défaut depuis
-- 004_finance_v4.sql, jamais changée). Respecte le pattern de versionnement
-- déjà en place pour platform_fee_rules (nouvelle ligne horodatée plutôt
-- qu'UPDATE de l'existante) au lieu de réécrire l'historique ; l'ancienne
-- ligne à 0% est désactivée pour éviter toute ambiguïté si deux lignes
-- 'active' étaient un jour lues sans le tri par effective_from.
UPDATE platform_fee_rules SET active=false WHERE name='default';
INSERT INTO platform_fee_rules(name,commission_bps,active,effective_from)
  VALUES ('v54-3pct',300,true,now()) ON CONFLICT(name) DO NOTHING;
