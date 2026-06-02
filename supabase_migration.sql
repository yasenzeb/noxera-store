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