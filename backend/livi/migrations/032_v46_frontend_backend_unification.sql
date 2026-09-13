-- LIVI v46 frontend/backend unification: internal features only.
-- External payment, SMS/push and third-party storage integrations remain out of scope.
CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role varchar(20) NOT NULL CHECK(role IN ('client','vendor','transporter','admin')),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, role)
);
INSERT INTO user_roles(user_id, role)
SELECT id, role FROM users
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS social_follows (
  follower_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(follower_id, following_id),
  CHECK(follower_id <> following_id)
);
CREATE TABLE IF NOT EXISTS social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  kind varchar(20) NOT NULL DEFAULT 'product' CHECK(kind IN ('product','video','text')),
  media_url text,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS social_likes (
  post_id uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(post_id,user_id)
);
CREATE TABLE IF NOT EXISTS social_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK(length(body) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS social_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_posts_author_idx ON social_posts(author_id,created_at DESC);
CREATE INDEX IF NOT EXISTS social_comments_post_idx ON social_comments(post_id,created_at DESC);

CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operator varchar(30) NOT NULL,
  phone varchar(30) NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified','disabled')),
  provider_reference varchar(160),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_methods_user_idx ON payment_methods(user_id,status);
CREATE TABLE IF NOT EXISTS vendor_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(200), description text, file_key text NOT NULL, thumbnail_url text,
  status varchar(20) NOT NULL DEFAULT 'published', views bigint NOT NULL DEFAULT 0, likes bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS live_shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), vendor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(200) NOT NULL, stream_url text, thumbnail_url text,
  status varchar(20) NOT NULL DEFAULT 'live', viewer_count integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz
);
CREATE INDEX IF NOT EXISTS vendor_videos_vendor_idx ON vendor_videos(vendor_id,created_at DESC);
CREATE INDEX IF NOT EXISTS live_shops_status_idx ON live_shops(status,started_at DESC);
