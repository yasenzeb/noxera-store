<<<<<<< HEAD
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
=======
-- Enable UUID generation
create extension if not exists pgcrypto;

-- =========================
-- PRODUCTS TABLE
-- =========================
create table if not exists products (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    type text not null,
    price numeric not null,
    image_url text,
    discount_type text not null default 'none',
    discount_value numeric not null default 0,
    created_at timestamptz not null default now()
);

create index if not exists idx_products_type on products(type);
create index if not exists idx_products_created_at on products(created_at desc);

-- =========================
-- CATEGORIES TABLE
-- =========================
create table if not exists categories (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text not null unique,
    created_at timestamptz not null default now()
);

create index if not exists idx_categories_slug on categories(slug);

-- =========================
-- DEFAULT CATEGORIES
-- =========================
insert into categories (name, slug)
values
('تيشيرتات','tshirts'),
('بناطيل','pants'),
('جاكيتات','jackets'),
('اكسسوارات','accessories')
on conflict (slug) do nothing;

-- =========================
-- STORAGE BUCKET
-- =========================
insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict do nothing;

-- =========================
-- STORAGE POLICIES
-- =========================
create policy "Public Read Products"
on storage.objects
for select
using (bucket_id = 'products');

create policy "Public Upload Products"
on storage.objects
for insert
with check (bucket_id = 'products');

create policy "Public Update Products"
on storage.objects
for update
using (bucket_id = 'products');

create policy "Public Delete Products"
on storage.objects
for delete
using (bucket_id = 'products');

-- =========================
-- ENABLE RLS
-- =========================
alter table products enable row level security;
alter table categories enable row level security;

-- Service Role bypasses RLS automatically.
>>>>>>> c7586527e87ac2c1896002347d53f281f19455df
