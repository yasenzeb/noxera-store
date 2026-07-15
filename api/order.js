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

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') return res.status(405).end();

  try {
    const {
      product, productId, price, shipping, total,
      name, phone, gov, address, payMethod,
      size = '', color = '', qty = 1, note = ''
    } = req.body || {};

    const orderNumber = `NOX-${Math.floor(100000 + Math.random() * 900000)}`;

    // 1. Save Order to Supabase Table (orders)
    let orderId = null;
    if (supabase) {
      const items = [{
        id: productId || null,
        name: product,
        price: price,
        quantity: parseInt(qty || 1),
        size: size || null,
        color: color || null,
        note: note || null
      }];

      const { data: orderData, error: dbError } = await supabase.from('orders').insert([{
        order_number: orderNumber,
        customer_name: name,
        customer_phone: phone,
        governorate: gov,
        address: address,
        total: parseFloat(total),
        payment_method: payMethod === 'كاش عند الاستلام' ? 'cod' : 'card',
        status: 'pending',
        items: items,
        notes: note || null
      }]).select().single();

      if (dbError) {
        console.error('Database error saving order:', dbError);
      } else if (orderData) {
        orderId = orderData.id;
      }
    }

    // Escape all user inputs to prevent Telegram HTML parse errors
    const safeProduct = escapeHtml(product);
    const safeName = escapeHtml(name);
    const safePhone = escapeHtml(phone);
    const safeGov = escapeHtml(gov);
    const safeAddress = escapeHtml(address);
    const safePayMethod = escapeHtml(payMethod);
    const safeSize = escapeHtml(size);
    const safeColor = escapeHtml(color);
    const safeNote = escapeHtml(note);

    let message =
        `🚨 <b>طلب جديد من NOXERA (#${orderNumber})</b> 🚨\n\n` +
        `📦 <b>المنتج:</b> ${safeProduct}\n`;
    
    if (safeSize) message += `📏 <b>المقاس:</b> ${safeSize.toUpperCase()}\n`;
    if (safeColor) message += `🎨 <b>اللون:</b> ${safeColor}\n`;
    
    message +=
        `🔢 <b>الكمية:</b> ${qty}\n` +
        `💵 <b>السعر:</b> ${price} ج.م\n` +
        `🚚 <b>الشحن:</b> ${shipping} ج.م\n` +
        `💰 <b>الإجمالي:</b> ${total} ج.م\n\n` +
        `👤 <b>العميل:</b> ${safeName}\n` +
        `📞 <b>الموبايل:</b> ${safePhone}\n` +
        `📍 <b>المحافظة:</b> ${safeGov}\n` +
        `🏡 <b>العنوان:</b> ${safeAddress}\n` +
        `💳 <b>الدفع:</b> ${safePayMethod}`;

    if (safeNote) {
      message += `\n📝 <b>ملاحظة:</b> ${safeNote}`;
    }

    // 2. Send Telegram Notification using Vercel Environment Variables
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    // Auto-register the webhook dynamically to make sure inline buttons work immediately on any Vercel domain!
    if (botToken) {
      try {
        const host = req.headers.host;
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const webhookUrl = `${protocol}://${host}/api/telegram-webhook`;
        await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
      } catch (e) {
        console.error('Failed to set Telegram webhook in order API:', e);
      }
    }

    if (botToken && chatId) {
      const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const payload = {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      };

      // Add inline buttons if order was saved successfully and we have orderId
      if (orderId) {
        payload.reply_markup = {
          inline_keyboard: [
            [
              { text: "🟡 قيد الانتظار", callback_data: `status:pending:${orderId}` },
              { text: "🔵 تم القبول والتجهيز", callback_data: `status:confirmed:${orderId}` }
            ],
            [
              { text: "🚚 خرج للشحن", callback_data: `status:shipped:${orderId}` },
              { text: "🟢 تم التسليم", callback_data: `status:delivered:${orderId}` }
            ]
          ]
        };
      }

      const tgRes = await fetch(telegramUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!tgRes.ok) {
        const errText = await tgRes.text();
        console.error('Telegram API error details:', errText);
        throw new Error(`Telegram error: ${errText}`);
      }
    } else {
      console.warn('Telegram integration is not configured. Please set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.');
    }

    return res.status(200).json({ success: true, id: orderId, order_number: orderNumber });

  } catch (err) {
    console.error('Order handler error:', err);
    return res.status(500).json({ success: false, error: err.message || 'server_error' });
  }
}
