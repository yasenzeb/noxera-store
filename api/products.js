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

function normalise(p) {
  if (!p) return null;
  let urls = Array.isArray(p.image_urls) ? p.image_urls.filter(Boolean) : [];
  if (urls.length === 0 && p.image_url) urls = [p.image_url];
  urls = urls.slice(0, 4);
  
  // Parse sold_out_sizes
  let soldOutSizes = p.sold_out_sizes || [];
  if (typeof soldOutSizes === 'string') {
    try { soldOutSizes = JSON.parse(soldOutSizes); } catch(e) { soldOutSizes = []; }
  }

  return {
    ...p,
    image_url:      urls[0] || p.image_url || '',
    image_urls:     urls,
    discount_type:  p.discount_type  || 'none',
    discount_value: p.discount_value || 0,
    description:    p.description    || '',
    cost_price:     p.cost_price     || 0,
    sizes:          p.sizes          || [],
    colors:         p.colors         || [],
    main_image_index: p.main_image_index || 0,
    sold_out:       p.sold_out || false,
    sold_out_sizes: soldOutSizes
  };
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
    const { id, type } = req.query;

    if (req.method === 'GET') {
      if (id) {
        // Fetch single product
        const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
        if (error) throw error;
        return res.status(200).json({ success: true, product: normalise(data) });
      } else {
        // Fetch list of products
        let query = supabase.from('products').select('*').order('created_at', { ascending: false });
        if (type && type !== 'all') query = query.eq('type', type);
        const { data, error } = await query;
        if (error) throw error;
        return res.status(200).json({ success: true, products: (data || []).map(normalise) });
      }
    }

    if (req.method === 'POST') {
      const {
        name, type, price, description = '', cost_price = 0,
        image_url = '', image_urls = [], gallery = [],
        discount_type = 'none', discount_value = 0,
        sizes = [], colors = [], main_image_index = 0,
        sold_out = false, sold_out_sizes = []
      } = req.body;

      if (!name || !type || !price) {
        return res.status(400).json({ success: false, error: 'name, type, price مطلوبة' });
      }

      // admin1 passes gallery instead of image_urls
      const rawUrls = (Array.isArray(gallery) && gallery.length) ? gallery : image_urls;
      let urls = Array.isArray(rawUrls) ? rawUrls.filter(Boolean) : [];
      if (urls.length === 0 && image_url) urls = [image_url];
      urls = urls.slice(0, 4);
      const cover = urls[0] || '';

      const { data, error } = await supabase.from('products')
        .insert([{
          name, type,
          price:          parseInt(price),
          description,
          cost_price:     parseInt(cost_price || 0),
          image_url:      cover,
          image_urls:     urls,
          discount_type:  discount_type || 'none',
          discount_value: discount_value || 0,
          sizes,
          colors,
          main_image_index: parseInt(main_image_index || 0),
          sold_out:       Boolean(sold_out),
          sold_out_sizes: Array.isArray(sold_out_sizes) ? sold_out_sizes : []
        }])
        .select().single();

      if (error) throw error;
      return res.status(201).json({ success: true, product: normalise(data) });
    }

    if (req.method === 'PUT') {
      if (!id) return res.status(400).json({ success: false, error: 'ID مطلوب للتعديل' });

      const {
        name, type, price, description, cost_price,
        image_url, image_urls, gallery,
        discount_type, discount_value,
        sizes, colors, main_image_index,
        sold_out, sold_out_sizes
      } = req.body || {};

      const updates = {};
      if (name !== undefined) updates.name = name;
      if (type !== undefined) updates.type = type;
      if (price !== undefined) updates.price = parseInt(price);
      if (description !== undefined) updates.description = description;
      if (cost_price !== undefined) updates.cost_price = parseInt(cost_price || 0);
      if (discount_type !== undefined) updates.discount_type = discount_type;
      if (discount_value !== undefined) updates.discount_value = discount_type === 'none' ? 0 : parseFloat(discount_value) || 0;
      if (sizes !== undefined) updates.sizes = sizes;
      if (colors !== undefined) updates.colors = colors;
      if (main_image_index !== undefined) updates.main_image_index = parseInt(main_image_index || 0);
      if (sold_out !== undefined) updates.sold_out = Boolean(sold_out);
      if (sold_out_sizes !== undefined) updates.sold_out_sizes = Array.isArray(sold_out_sizes) ? sold_out_sizes : [];

      // Handle image URLs (gallery or image_urls)
      const rawUrls = (Array.isArray(gallery) && gallery.length) ? gallery : image_urls;
      if (rawUrls !== undefined || image_url !== undefined) {
        let urls = Array.isArray(rawUrls) ? rawUrls.filter(Boolean) : [];
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
      if (!id) return res.status(400).json({ success: false, error: 'ID مطلوب للحذف' });

      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true, message: 'تم الحذف بنجاح' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
