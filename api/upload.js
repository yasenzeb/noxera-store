import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'POST only' });

  try {
    const { data: base64Data, fileName } = req.body;

    if (!base64Data || !fileName) {
      return res.status(400).json({ success: false, error: 'data و fileName مطلوبان' });
    }

    // استخراج mime type والـ buffer من base64
    const matches = base64Data.match(/^data:(.+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ success: false, error: 'base64 format invalid' });

    const mimeType  = matches[1];
    const buffer    = Buffer.from(matches[2], 'base64');
    const ext       = fileName.split('.').pop().toLowerCase() || 'jpg';
    const uniqueName = `product_${Date.now()}_${Math.random().toString(36).slice(2,7)}.${ext}`;

    const { error } = await supabase.storage
      .from('products')
      .upload(uniqueName, buffer, { contentType: mimeType, upsert: false });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('products')
      .getPublicUrl(uniqueName);

    return res.status(200).json({ success: true, url: publicUrl });

  } catch (err) {
    console.error('[API /upload]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
