import { createClient } from '@supabase/supabase-js';

// Initialize Supabase conditionally to avoid crashes in local dev when env vars are missing
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  } catch (e) {
    console.error('Supabase initialization error:', e);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Supabase integration is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' });
  }

  try {
    const { id } = req.query;

    if (req.method === 'GET') {
      const { data, error } = await supabase.from('categories').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      return res.status(200).json({ success: true, categories: data || [] });
    }

    if (req.method === 'POST') {
      const { name, slug } = req.body || {};
      if (!name || !slug) return res.status(400).json({ success: false, error: 'name و slug مطلوبان' });
      const cleanSlug = slug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      const { data, error } = await supabase.from('categories').insert([{ name: name.trim(), slug: cleanSlug }]).select().single();
      if (error) {
        if (error.code === '23505') return res.status(409).json({ success: false, error: 'الـ slug موجود بالفعل' });
        throw error;
      }
      return res.status(201).json({ success: true, category: data });
    }

    if (req.method === 'PUT') {
      if (!id) return res.status(400).json({ success: false, error: 'ID مطلوب للتحديث' });
      const { name, slug } = req.body || {};
      const updates = {};
      if (name !== undefined) updates.name = name.trim();
      if (slug !== undefined) updates.slug = slug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      if (!Object.keys(updates).length) return res.status(400).json({ success: false, error: 'لا توجد بيانات للتحديث' });
      const { data, error } = await supabase.from('categories').update(updates).eq('id', id).select().single();
      if (error) {
        if (error.code === '23505') return res.status(409).json({ success: false, error: 'الـ slug موجود بالفعل' });
        throw error;
      }
      return res.status(200).json({ success: true, category: data });
    }

    if (req.method === 'DELETE') {
      const { slug } = req.query;
      if (!id && !slug) return res.status(400).json({ success: false, error: 'ID or slug مطلوب للحذف' });

      let query = supabase.from('categories').delete();
      if (id) {
        query = query.eq('id', id);
      } else {
        query = query.eq('slug', slug);
      }

      const { error } = await query;
      if (error) throw error;
      return res.status(200).json({ success: true, message: 'تم الحذف بنجاح' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
