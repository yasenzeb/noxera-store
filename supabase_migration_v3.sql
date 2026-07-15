-- NOXERA — Supabase Migration v3
-- شغّل هذا الملف في Supabase SQL Editor لتحديث الحقول الجديدة

-- إضافة حقول النفاد من المخزن (Sold Out) للمنتجات والمقاسات
ALTER TABLE products ADD COLUMN IF NOT EXISTS sold_out BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sold_out_sizes JSONB DEFAULT '[]';

-- إضافة حقل ملاحظات العميل لجدول الطلبات
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;
