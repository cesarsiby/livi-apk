-- LIVI v46 architecture alignment: cumulative roles, KYC levels, login lockout and product variants.
ALTER TABLE user_roles
  ADD COLUMN IF NOT EXISTS kyc_level smallint NOT NULL DEFAULT 0 CHECK (kyc_level BETWEEN 0 AND 3);
CREATE INDEX IF NOT EXISTS user_roles_verified_idx ON user_roles(user_id, role, verified_at, kyc_level);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS failed_login_attempts integer NOT NULL DEFAULT 0 CHECK (failed_login_attempts >= 0),
  ADD COLUMN IF NOT EXISTS locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

CREATE TABLE IF NOT EXISTS product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku varchar(100),
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  price_xof bigint CHECK (price_xof IS NULL OR price_xof > 0),
  stock_qty integer NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS product_variants_product_sku_uq ON product_variants(product_id, sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS product_variants_product_idx ON product_variants(product_id, status);

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_variant_id uuid REFERENCES product_variants(id);
CREATE INDEX IF NOT EXISTS order_items_variant_idx ON order_items(product_variant_id);

ALTER TABLE product_media ADD COLUMN IF NOT EXISTS alt_text varchar(200);

CREATE TABLE IF NOT EXISTS notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel varchar(20) NOT NULL CHECK (channel IN ('in_app','push','sms','email')),
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notification_outbox_pending_idx ON notification_outbox(status, available_at);

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS slogan varchar(200),
  ADD COLUMN IF NOT EXISTS category varchar(120),
  ADD COLUMN IF NOT EXISTS phone varchar(30),
  ADD COLUMN IF NOT EXISTS city varchar(100),
  ADD COLUMN IF NOT EXISTS address text;

CREATE TABLE IF NOT EXISTS partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) UNIQUE NOT NULL,
  name varchar(160) NOT NULL,
  kind varchar(30) NOT NULL CHECK (kind IN ('payment','logistics','insurance','sms','push','storage')),
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS partner_instructions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES partners(id),
  operation_key varchar(180) UNIQUE NOT NULL,
  order_id uuid REFERENCES orders(id),
  payout_id uuid REFERENCES payout_requests(id),
  type varchar(30) NOT NULL CHECK (type IN ('HOLD','RELEASE','REFUND','PAYOUT')),
  amount bigint NOT NULL CHECK (amount > 0),
  currency char(3) NOT NULL DEFAULT 'XOF',
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','quarantined')),
  provider_reference varchar(160),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response jsonb,
  idempotency_key varchar(180) NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS partner_instruction_idempotency_uq ON partner_instructions(idempotency_key);
CREATE INDEX IF NOT EXISTS partner_instructions_order_idx ON partner_instructions(order_id,type,created_at DESC);
CREATE INDEX IF NOT EXISTS partner_instructions_status_idx ON partner_instructions(status,created_at);

CREATE TABLE IF NOT EXISTS settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_instruction_id uuid REFERENCES partner_instructions(id),
  order_id uuid REFERENCES orders(id),
  payout_id uuid REFERENCES payout_requests(id),
  beneficiary_user_id uuid REFERENCES users(id),
  beneficiary_type varchar(20) CHECK (beneficiary_type IN ('vendor','transporter','buyer','livi')),
  amount bigint NOT NULL CHECK (amount > 0),
  currency char(3) NOT NULL DEFAULT 'XOF',
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
  provider_reference varchar(160),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS settlements_order_idx ON settlements(order_id,created_at);
CREATE INDEX IF NOT EXISTS settlements_beneficiary_idx ON settlements(beneficiary_user_id,status,created_at);

ALTER TABLE kyc_documents DROP CONSTRAINT IF EXISTS kyc_document_type_check;
ALTER TABLE kyc_documents ADD CONSTRAINT kyc_document_type_check CHECK (document_type IN ('cni','passport','permis','assurance','business_registration','tax_document','other'));

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES orders(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS reviews_order_product_user_uq ON reviews(order_id,product_id,user_id) WHERE order_id IS NOT NULL;
