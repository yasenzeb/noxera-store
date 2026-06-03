import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function normalise(p) {
  let urls = Array.isArray(p.image_urls) ? p.image_urls.filter(Boolean) : [];
  if (urls.length === 0 && p.image_url) urls = [p.image_url];
  urls = urls.slice(0, 4);
  return {
    ...p,
    image_url:      urls[0] || p.image_url || '',
    image_urls:     urls,
    discount_type:  p.discount_type  || 'none',
    discount_value: p.discount_value || 0,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { type } = req.query;
      let query = supabase.from('products').select('*').order('created_at', { ascending: false });
      if (type && type !== 'all') query = query.eq('type', type);
      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json({ success: true, products: (data || []).map(normalise) });
    }

    if (req.method === 'POST') {
      const { name, type, price, image_url = '', image_urls = [], discount_type, discount_value } = req.body;
      if (!name || !type || !price) return res.status(400).json({ success: false, error: 'name, type, price مطلوبة' });

      let urls = Array.isArray(image_urls) ? image_urls.filter(Boolean) : [];
      if (urls.length === 0 && image_url) urls = [image_url];
      urls = urls.slice(0, 4);
      const cover = urls[0] || '';

      const { data, error } = await supabase.from('products')
        .insert([{
          name, type,
          price:          parseInt(price),
          image_url:      cover,
          image_urls:     urls,
          discount_type:  discount_type  || 'none',
          discount_value: discount_value || 0,
        }])
        .select().single();
      if (error) throw error;
      return res.status(201).json({ success: true, product: normalise(data) });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
