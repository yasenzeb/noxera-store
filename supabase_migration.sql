-- NOXERA — Supabase Migration
-- شغّل هذا الملف أول حاجة في Supabase SQL Editor

CREATE TABLE IF NOT EXISTS products (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT        NOT NULL,
  type           TEXT        NOT NULL,
  price          NUMERIC     NOT NULL,
  image_url      TEXT,
  discount_type  TEXT        NOT NULL DEFAULT 'none',
  discount_value NUMERIC     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  slug       TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO categories (name, slug) VALUES
  ('تيشيرتات', 'tshirts'),
  ('بناطيل', 'pants'),
  ('جاكيتات', 'jackets'),
  ('اكسسوارات', 'accessories')
ON CONFLICT (slug) DO NOTHING;

-- Storage bucket for product images
-- اعمل الـ bucket يدوياً من Supabase Dashboard > Storage > New Bucket
-- اسمه: products
-- اجعله Public
