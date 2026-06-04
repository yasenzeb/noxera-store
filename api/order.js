/**
 * NOXERA — Vercel API Endpoint
 * المسار: /api/order
 *
 * يستقبل الطلب من checkout.html
 * يحفظه في Supabase
 * يبعته للبوت على Koyeb عشان يرسله واتساب
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BOT_URL    = process.env.BOT_URL;    // رابط Koyeb مثلاً: https://noxera-bot.koyeb.app
const BOT_SECRET = process.env.BOT_SECRET; // نفس الـ secret في البوت

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { product, price, shipping, total, name, phone, gov, address, payMethod } = req.body;

  // ── Validation ───────────────────────────────────────────────
  if (!name || !phone || !gov || !address || !product) {
    return res.status(400).json({ success: false, error: 'بيانات ناقصة' });
  }

  const order = { product, price, shipping, total, name, phone, gov, address, payMethod };

  // ── 1. حفظ الطلب في Supabase (اختياري — للأرشيف) ────────────
  try {
    await supabase.from('orders').insert([{
      product_name:  product,
      price:         Number(price)    || 0,
      shipping_cost: Number(shipping) || 0,
      total:         Number(total)    || 0,
      customer_name: name,
      customer_phone: phone,
      governorate:   gov,
      address,
      pay_method:    payMethod || 'كاش عند الاستلام',
      status:        'new',
      created_at:    new Date().toISOString(),
    }]);
  } catch (dbErr) {
    // مش هيوقف العملية لو الـ DB فشل
    console.error('[DB]', dbErr.message);
  }

  // ── 2. إرسال الطلب للبوت ─────────────────────────────────────
  if (!BOT_URL) {
    return res.status(500).json({ success: false, error: 'BOT_URL غير موجود في env' });
  }

  try {
    const botRes = await fetch(`${BOT_URL}/send-order`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ secret: BOT_SECRET, order }),
    });

    const botData = await botRes.json();

    if (!botData.success) {
      throw new Error(botData.error || 'Bot error');
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('[BOT]', err.message);
    return res.status(500).json({ success: false, error: 'فشل إرسال الطلب: ' + err.message });
  }
}
