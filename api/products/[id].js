import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function normalise(p) {
  let urls = Array.isArray(p.image_urls) ? p.image_urls.filter(Boolean) : [];
  if (urls.length === 0 && p.image_url) urls = [p.image_url];
  urls = urls.slice(0, 4);
  return { ...p, image_url: urls[0] || '', image_urls: urls, discount_type: p.discount_type || 'none', discount_value: p.discount_value || 0 };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ success: false, error: 'ID مطلوب' });

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
      if (error) throw error;
      return res.status(200).json({ success: true, product: normalise(data) });
    }

    if (req.method === 'PUT') {
      const { name, type, price, image_url, image_urls, discount_type, discount_value } = req.body || {};
      const updates = {};
      if (name  !== undefined) updates.name  = name;
      if (type  !== undefined) updates.type  = type;
      if (price !== undefined) updates.price = parseInt(price);
      if (discount_type  !== undefined) updates.discount_type  = discount_type;
      if (discount_value !== undefined) updates.discount_value = discount_type === 'none' ? 0 : parseFloat(discount_value) || 0;
      if (updates.discount_type === 'none') updates.discount_value = 0;

      // Handle image_urls array
      if (image_urls !== undefined || image_url !== undefined) {
        let urls = Array.isArray(image_urls) ? image_urls.filter(Boolean) : [];
        if (urls.length === 0 && image_url) urls = [image_url];
        urls = urls.slice(0, 4);
        updates.image_urls = urls;
        updates.image_url  = urls[0] || '';
      }

      const { data, error } = await supabase.from('products').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json({ success: true, product: normalise(data) });
    }

    if (req.method === 'DELETE') {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true, message: 'تم الحذف' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
