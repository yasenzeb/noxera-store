import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';

export const config = { api: { bodyParser: false } };
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const form = formidable({ maxFileSize: 5 * 1024 * 1024 });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ error: err.message });
    const file = files.file?.[0] || files.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const ext = file.originalFilename?.split('.').pop() || 'jpg';
    const fileName = `product_${Date.now()}.${ext}`;
    const fileBuffer = fs.readFileSync(file.filepath);

    const { data, error } = await supabase.storage.from('products').upload(fileName, fileBuffer, {
      contentType: file.mimetype || 'image/jpeg',
      upsert: true
    });

    if (error) return res.status(500).json({ error: error.message });

    const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(fileName);
    return res.status(200).json({ success: true, url: publicUrl });
  });
}
