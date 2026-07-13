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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Supabase integration is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' });
  }

  try {
    const { id } = req.query;

    if (req.method === 'GET') {
      const { data, error } = await supabase.from('reviews').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ success: true, reviews: data || [] });
    }

    if (req.method === 'POST') {
      const { name, text, rating } = req.body || {};
      if (!name || !text || !rating) {
        return res.status(400).json({ success: false, error: 'name, text, rating مطلوبة' });
      }
      const { data, error } = await supabase.from('reviews')
        .insert([{ name: name.trim(), text: text.trim(), rating: parseInt(rating) }])
        .select().single();
      if (error) throw error;
      return res.status(201).json({ success: true, review: data });
    }

    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ success: false, error: 'ID مطلوب' });
      const { error } = await supabase.from('reviews').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true, message: 'تم حذف الرأي' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
