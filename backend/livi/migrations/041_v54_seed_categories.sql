-- V-AUDIT: renumbered from 040 to 041 on merge — this file arrived
-- independently (LIVI_Correctifs_Categorie_Photos_Video.zip) numbered
-- "040_v54_seed_categories.sql", colliding with
-- 040_v55_commission_snapshot.sql already produced in this same audit
-- (Session 10). Content unchanged from the original submission; only the
-- filename's numeric prefix changed, since migrate.js tracks applied
-- state by filename.
--
-- V54 (suite) — la table `categories` existe depuis 001_initial.sql
-- (id, name, slug) mais n'a jamais reçu la moindre ligne, et
-- products.category_id n'était accepté par aucune route. 10 catégories
-- de départ pour un social commerce ouest-africain (Mali) — modifiables/
-- complétables par l'admin ensuite, ce n'est pas une liste figée.
INSERT INTO categories(name,slug) VALUES
  ('Téléphones & Accessoires','telephones-accessoires'),
  ('Vêtements & Mode','vetements-mode'),
  ('Beauté & Cosmétiques','beaute-cosmetiques'),
  ('Alimentation & Épicerie','alimentation-epicerie'),
  ('Électronique & Informatique','electronique-informatique'),
  ('Maison & Cuisine','maison-cuisine'),
  ('Chaussures','chaussures'),
  ('Bijoux & Accessoires','bijoux-accessoires'),
  ('Santé & Bien-être','sante-bien-etre'),
  ('Autres','autres')
ON CONFLICT (slug) DO NOTHING;
