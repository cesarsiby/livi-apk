-- LIVI V57 — complete market/intercity model.
-- Additive: preserves existing roles, products.category_id, urban dispatch,
-- and existing financial/escrow structures.

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS seller_type varchar(40);
ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_seller_type_check;
ALTER TABLE vendors ADD CONSTRAINT vendors_seller_type_check CHECK (
  seller_type IS NULL OR seller_type IN (
    'farmer','artisan','independent','retailer','wholesaler','manufacturer','company'
  )
);
CREATE INDEX IF NOT EXISTS vendors_seller_type_idx ON vendors(seller_type);

CREATE TABLE IF NOT EXISTS product_categories (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(product_id, category_id)
);
CREATE INDEX IF NOT EXISTS product_categories_category_idx ON product_categories(category_id,product_id);
INSERT INTO product_categories(product_id,category_id)
SELECT id,category_id FROM products WHERE category_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS unit varchar(40),
  ADD COLUMN IF NOT EXISTS is_perishable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS production_date date,
  ADD COLUMN IF NOT EXISTS harvest_date date,
  ADD COLUMN IF NOT EXISTS shelf_life_hours integer,
  ADD COLUMN IF NOT EXISTS storage_conditions text,
  ADD COLUMN IF NOT EXISTS available_from timestamptz;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_shelf_life_hours_check;
ALTER TABLE products ADD CONSTRAINT products_shelf_life_hours_check
  CHECK(shelf_life_hours IS NULL OR shelf_life_hours>0);
CREATE INDEX IF NOT EXISTS products_perishable_idx ON products(is_perishable,status);

CREATE TABLE IF NOT EXISTS product_price_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  min_quantity integer NOT NULL CHECK(min_quantity>1),
  unit_price_xof bigint NOT NULL CHECK(unit_price_xof>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id,min_quantity)
);
CREATE INDEX IF NOT EXISTS product_price_tiers_lookup_idx
  ON product_price_tiers(product_id,min_quantity DESC);
DROP TRIGGER IF EXISTS product_price_tiers_updated_at ON product_price_tiers;
CREATE TRIGGER product_price_tiers_updated_at BEFORE UPDATE ON product_price_tiers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS unit varchar(40),
  ADD COLUMN IF NOT EXISTS is_perishable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS production_date date,
  ADD COLUMN IF NOT EXISTS harvest_date date,
  ADD COLUMN IF NOT EXISTS shelf_life_hours integer,
  ADD COLUMN IF NOT EXISTS storage_conditions text;
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_shelf_life_hours_check;
ALTER TABLE order_items ADD CONSTRAINT order_items_shelf_life_hours_check
  CHECK(shelf_life_hours IS NULL OR shelf_life_hours>0);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_mode varchar(20) NOT NULL DEFAULT 'urban',
  ADD COLUMN IF NOT EXISTS intercity_partner_id uuid REFERENCES partners(id),
  ADD COLUMN IF NOT EXISTS intercity_destination_location_id uuid,
  ADD COLUMN IF NOT EXISTS estimated_transit_min_hours integer,
  ADD COLUMN IF NOT EXISTS estimated_transit_max_hours integer;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_delivery_mode_check;
ALTER TABLE orders ADD CONSTRAINT orders_delivery_mode_check
  CHECK(delivery_mode IN ('urban','intercity'));
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_transit_hours_check;
ALTER TABLE orders ADD CONSTRAINT orders_transit_hours_check CHECK (
  estimated_transit_min_hours IS NULL OR (
    estimated_transit_min_hours>0 AND
    estimated_transit_max_hours IS NOT NULL AND
    estimated_transit_max_hours>=estimated_transit_min_hours
  )
);
CREATE INDEX IF NOT EXISTS orders_delivery_mode_idx ON orders(delivery_mode,created_at);

CREATE TABLE IF NOT EXISTS partner_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  location_type varchar(20) NOT NULL CHECK(location_type IN ('depot','pickup','both')),
  name varchar(160) NOT NULL,
  code varchar(80),
  address_line text NOT NULL,
  city varchar(100) NOT NULL,
  region varchar(100),
  latitude numeric(9,6),
  longitude numeric(9,6),
  status varchar(20) NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS partner_locations_partner_code_uq
  ON partner_locations(partner_id,code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS partner_locations_lookup_idx
  ON partner_locations(partner_id,city,location_type,status);
DROP TRIGGER IF EXISTS partner_locations_updated_at ON partner_locations;
CREATE TRIGGER partner_locations_updated_at BEFORE UPDATE ON partner_locations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS intercity_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  origin_city varchar(100) NOT NULL,
  destination_city varchar(100) NOT NULL,
  fee_xof bigint NOT NULL CHECK(fee_xof>=0),
  transit_min_hours integer NOT NULL CHECK(transit_min_hours>0),
  transit_max_hours integer NOT NULL CHECK(transit_max_hours>=transit_min_hours),
  status varchar(20) NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(partner_id,origin_city,destination_city)
);
CREATE INDEX IF NOT EXISTS intercity_routes_lookup_idx
  ON intercity_routes(origin_city,destination_city,status,partner_id);
DROP TRIGGER IF EXISTS intercity_routes_updated_at ON intercity_routes;
CREATE TRIGGER intercity_routes_updated_at BEFORE UPDATE ON intercity_routes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS delivery_mode varchar(20) NOT NULL DEFAULT 'urban',
  ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES partners(id),
  ADD COLUMN IF NOT EXISTS origin_location_id uuid REFERENCES partner_locations(id),
  ADD COLUMN IF NOT EXISTS destination_location_id uuid REFERENCES partner_locations(id);
ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_delivery_mode_check;
ALTER TABLE shipments ADD CONSTRAINT shipments_delivery_mode_check
  CHECK(delivery_mode IN ('urban','intercity'));
CREATE INDEX IF NOT EXISTS shipments_delivery_mode_status_idx
  ON shipments(delivery_mode,status,created_at);
CREATE INDEX IF NOT EXISTS shipments_partner_idx ON shipments(partner_id,status);

-- The 16 commercial categories are configuration, not pricing assumptions.
INSERT INTO categories(name,slug) VALUES
('Agriculture & Alimentation','agriculture-alimentation'),
('Produits périssables','produits-perissables'),
('Mode & Vêtements','mode-vetements'),
('Électronique & Technologie','electronique-technologie'),
('Maison & Équipement','maison-equipement'),
('Beauté & Soins','beaute-soins'),
('Auto & Moto','auto-moto'),
('Construction & BTP','construction-btp'),
('Énergie & Solaire','energie-solaire'),
('Outils & Équipements professionnels','outils-equipements-professionnels'),
('Bébé & Enfant','bebe-enfant'),
('Éducation & Fournitures','education-fournitures'),
('Artisanat & Produits locaux','artisanat-produits-locaux'),
('Élevage & Agriculture professionnelle','elevage-agriculture-professionnelle'),
('Fournitures & Commerce professionnel','fournitures-commerce-professionnel'),
('Autres','autres')
ON CONFLICT(slug) DO NOTHING;
