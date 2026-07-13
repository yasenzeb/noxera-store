-- NOXERA — Supabase Migration v2
-- شغّل هذا الملف في Supabase SQL Editor

-- ════════════════════════════════════════════
-- جدول المنتجات (مع الحقول الجديدة)
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS products (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT        NOT NULL,
  type             TEXT        NOT NULL,
  price            NUMERIC     NOT NULL,
  cost_price       NUMERIC     NOT NULL DEFAULT 0,
  description      TEXT        DEFAULT '',
  image_url        TEXT,
  image_urls       JSONB       DEFAULT '[]',
  gallery          JSONB       DEFAULT '[]',
  discount_type    TEXT        NOT NULL DEFAULT 'none',
  discount_value   NUMERIC     NOT NULL DEFAULT 0,
  sizes            JSONB       DEFAULT '[]',
  colors           JSONB       DEFAULT '[]',
  main_image_index INT         NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- إضافة الأعمدة الناقصة إن وُجد الجدول من قبل
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price       NUMERIC     NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS description      TEXT        DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_urls       JSONB       DEFAULT '[]';
ALTER TABLE products ADD COLUMN IF NOT EXISTS gallery          JSONB       DEFAULT '[]';
ALTER TABLE products ADD COLUMN IF NOT EXISTS sizes            JSONB       DEFAULT '[]';
ALTER TABLE products ADD COLUMN IF NOT EXISTS colors           JSONB       DEFAULT '[]';
ALTER TABLE products ADD COLUMN IF NOT EXISTS main_image_index INT         NOT NULL DEFAULT 0;

-- ════════════════════════════════════════════
-- جدول الفئات
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS categories (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  slug       TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════
-- جدول الطلبات
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS orders (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number   TEXT        NOT NULL UNIQUE,
  customer_name  TEXT        NOT NULL,
  customer_phone TEXT        NOT NULL,
  governorate    TEXT,
  address        TEXT,
  total          NUMERIC     NOT NULL,
  payment_method TEXT        NOT NULL DEFAULT 'cod',
  status         TEXT        NOT NULL DEFAULT 'pending',
  items          JSONB       DEFAULT '[]',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════
-- جدول الآراء
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS reviews (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  text       TEXT        NOT NULL,
  rating     INT         NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- بيانات افتراضية للفئات
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
