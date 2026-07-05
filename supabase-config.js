/**
 * ============================================================
 *  TERRY TENDER WEAR — SUPABASE CONFIG
 * ============================================================
 *
 *  STEP 1 — Paste your credentials below (2 lines only):
 * ============================================================
 */

// ✏️  EDIT THESE TWO LINES:
var SUPABASE_URL      = "https://mhqibudechcrkbhcusou.supabase.co";
var SUPABASE_ANON_KEY = "sb_publishable_uBtT9Z9QgY2nLLGefz3zsg_ouwGqz6A";

// ✏️  CHANGE YOUR WHATSAPP NUMBER HERE (no + sign):
var WHATSAPP_NUMBER = "254118053640";

/* ============================================================
   DO NOT EDIT BELOW THIS LINE
   ============================================================ */

var SUPABASE_CONFIGURED = (
  SUPABASE_URL      !== "https://YOUR_PROJECT_ID.supabase.co" &&
  SUPABASE_ANON_KEY !== "YOUR_ANON_PUBLIC_KEY_HERE"           &&
  SUPABASE_URL.indexOf("supabase.co") !== -1                  &&
  SUPABASE_ANON_KEY.length > 30
);

window.TERRY_CONFIG = {
  supabaseUrl:  SUPABASE_URL,
  supabaseKey:  SUPABASE_ANON_KEY,
  configured:   SUPABASE_CONFIGURED,
  whatsapp:     WHATSAPP_NUMBER,
};

if (SUPABASE_CONFIGURED) {
  console.log("%c✅ Supabase CONNECTED", "color:#25D366;font-weight:bold;font-size:13px");
  console.log("URL:", SUPABASE_URL);
} else {
  console.log("%c⚠️  Running in LOCAL STORAGE mode", "color:orange;font-weight:bold;font-size:13px");
  console.log("Edit SUPABASE_URL and SUPABASE_ANON_KEY in supabase-config.js");
}

/*
 * ============================================================
 *  SUPABASE SETUP — Run this SQL in Supabase → SQL Editor
 *  (Copy everything between the dashes and run it once)
 * ============================================================

-- ── STEP 1: Create tables ─────────────────────────────────

CREATE TABLE IF NOT EXISTS products (
  id          BIGSERIAL    PRIMARY KEY,
  name        TEXT         NOT NULL,
  price       INTEGER      NOT NULL CHECK (price > 0),
  category    TEXT         NOT NULL DEFAULT '',
  description TEXT         NOT NULL DEFAULT '',
  image_url   TEXT         NOT NULL DEFAULT '',
  stock       INTEGER      NOT NULL DEFAULT 0 CHECK (stock >= 0),
  is_new      BOOLEAN      NOT NULL DEFAULT false,
  is_featured BOOLEAN      NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id             BIGSERIAL    PRIMARY KEY,
  customer_name  TEXT         NOT NULL DEFAULT '',
  customer_phone TEXT         NOT NULL DEFAULT '',
  items          JSONB        NOT NULL DEFAULT '[]',
  total          INTEGER      NOT NULL DEFAULT 0,
  status         TEXT         NOT NULL DEFAULT 'pending',
  notes          TEXT         NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── ANALYTICS TABLES ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS analytics_sessions (
  id              BIGSERIAL    PRIMARY KEY,
  session_id      TEXT         NOT NULL UNIQUE,
  first_visit     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_visit      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  page_count      INTEGER      NOT NULL DEFAULT 1,
  total_time_sec  INTEGER      NOT NULL DEFAULT 0,
  referrer        TEXT         NOT NULL DEFAULT '',
  country         TEXT         NOT NULL DEFAULT 'Unknown',
  device_type     TEXT         NOT NULL DEFAULT 'Unknown'
);

CREATE TABLE IF NOT EXISTS analytics_page_views (
  id              BIGSERIAL    PRIMARY KEY,
  session_id      TEXT         NOT NULL,
  page_url        TEXT         NOT NULL,
  page_title      TEXT         NOT NULL DEFAULT '',
  time_on_page_sec INTEGER      NOT NULL DEFAULT 0,
  viewed_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  FOREIGN KEY (session_id) REFERENCES analytics_sessions(session_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS analytics_product_views (
  id              BIGSERIAL    PRIMARY KEY,
  session_id      TEXT         NOT NULL,
  product_id      BIGINT       NOT NULL,
  product_name    TEXT         NOT NULL DEFAULT '',
  interaction     TEXT         NOT NULL DEFAULT 'view',
  viewed_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  FOREIGN KEY (session_id) REFERENCES analytics_sessions(session_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS analytics_sales (
  id              BIGSERIAL    PRIMARY KEY,
  order_id        BIGINT       NOT NULL,
  session_id      TEXT         NOT NULL DEFAULT '',
  total_amount    INTEGER      NOT NULL DEFAULT 0,
  item_count      INTEGER      NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES analytics_sessions(session_id) ON DELETE SET NULL
);

-- ── STEP 2: Enable Row Level Security ──────────────────────

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders   ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_product_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_sales ENABLE ROW LEVEL SECURITY;

-- ── STEP 3: Drop any old conflicting policies ──────────────

DROP POLICY IF EXISTS "Public read products"   ON products;
DROP POLICY IF EXISTS "Admin all products"     ON products;
DROP POLICY IF EXISTS "Authenticated all"      ON products;
DROP POLICY IF EXISTS "Public insert orders"   ON orders;
DROP POLICY IF EXISTS "Admin all orders"       ON orders;
DROP POLICY IF EXISTS "Authenticated orders"   ON orders;

-- ── STEP 4: Create correct RLS policies ───────────────────
-- NOTE: Supabase v2 uses auth.uid() IS NOT NULL for auth checks
-- NOT auth.role() = 'authenticated' (that's the old v1 way)

-- Public storefront can READ products (no login needed)
CREATE POLICY "Public read products"
  ON products FOR SELECT
  TO anon, authenticated
  USING (true);

-- Logged-in admin can INSERT, UPDATE, DELETE products
CREATE POLICY "Admin insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admin update products"
  ON products FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admin delete products"
  ON products FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Anyone (customers) can INSERT orders (for WhatsApp checkout logging)
CREATE POLICY "Public insert orders"
  ON orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Logged-in admin can read and update orders
CREATE POLICY "Admin read orders"
  ON orders FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin update orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── ANALYTICS POLICIES ──────────────────────────────────
-- Public/anon can INSERT analytics (for tracking)
-- Only admin can READ analytics

CREATE POLICY "Public insert analytics_sessions"
  ON analytics_sessions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Public insert analytics_page_views"
  ON analytics_page_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Public insert analytics_product_views"
  ON analytics_product_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Public insert analytics_sales"
  ON analytics_sales FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admin read analytics_sessions"
  ON analytics_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin read analytics_page_views"
  ON analytics_page_views FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin read analytics_product_views"
  ON analytics_product_views FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin read analytics_sales"
  ON analytics_sales FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ── STEP 5: Create Storage bucket for product images ────────
-- In Supabase Dashboard → Storage → New Bucket
-- Name: product-images
-- Toggle: Make public ✅ (IMPORTANT — images won't load if private)
-- Then run this policy:

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow anyone to view images (public read)
CREATE POLICY "Public read images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Allow authenticated admin to upload images
CREATE POLICY "Admin upload images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);

-- Allow authenticated admin to delete images
CREATE POLICY "Admin delete images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);

-- ── STEP 6: Create admin user ─────────────────────────────
-- Go to: Supabase Dashboard → Authentication → Users → Add user
-- Enter your email and a strong password
-- Use those credentials to log into admin-login.html

-- ── STEP 6: Seed sample products (optional) ───────────────

INSERT INTO products (name, price, category, description, image_url, stock, is_new, is_featured)
VALUES
  ('Rosebud Onesie',       1200, 'Onesies',  'Ultra-soft cotton onesie with a delicate rose print.',          'https://images.unsplash.com/photo-1522771930-78848d9293e8?w=500&h=500&auto=format&fit=crop&q=80', 25, true,  true ),
  ('Sage Snuggle Set',     2400, 'Sets',      'Two-piece matching set in calming sage green.',                  'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=500&h=500&auto=format&fit=crop&q=80', 15, true,  false),
  ('Cloud Knit Romper',    1800, 'Rompers',   'Lightweight knit romper with easy snap closure.',                'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=500&h=500&auto=format&fit=crop&q=80', 20, true,  true ),
  ('Petal Soft Sleepsuit', 1500, 'Sleepwear', 'Footed sleepsuit in brushed cotton. Keeps babies warm.',        'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=500&h=500&auto=format&fit=crop&q=80', 30, false, false),
  ('Linen Bloom Dress',    2100, 'Dresses',   'Airy linen blend dress with flutter sleeves.',                  'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=500&h=500&auto=format&fit=crop&q=80', 12, false, true ),
  ('Warm Hug Cardigan',    1950, 'Knitwear',  'Hand-knit style cardigan in ivory. Easy front buttons.',        'https://images.unsplash.com/photo-1543087903-1ac2ec7aa8c5?w=500&h=500&auto=format&fit=crop&q=80', 18, true,  false);

 * ============================================================
 */
