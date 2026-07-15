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

    // Build Telegram message as PLAIN TEXT (no HTML parse_mode)
    // This avoids parse errors and makes editMessageText in webhook work flawlessly
    let message = `🚨 طلب جديد من NOXERA (#${orderNumber}) 🚨\n\n`;
    message += `📦 المنتج: ${product || '—'}\n`;

    if (size) message += `📏 المقاس: ${size.toUpperCase()}\n`;
    if (color) message += `🎨 اللون: ${color}\n`;

    message += `🔢 الكمية: ${qty}\n`;
    message += `💵 السعر: ${price} ج.م\n`;
    message += `🚚 الشحن: ${shipping} ج.م\n`;
    message += `💰 الإجمالي: ${total} ج.م\n\n`;
    message += `👤 العميل: ${name}\n`;
    message += `📞 الموبايل: ${phone}\n`;
    message += `📍 المحافظة: ${gov}\n`;
    message += `🏡 العنوان: ${address}\n`;
    message += `💳 الدفع: ${payMethod}`;

    if (note) {
      message += `\n📝 ملاحظة: ${note}`;
    }

    // 2. Send Telegram Notification
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    // Auto-register the webhook to ensure inline buttons work on any Vercel domain
    if (botToken) {
      try {
        const host = req.headers.host;
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const webhookUrl = `${protocol}://${host}/api/telegram-webhook`;
        await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: webhookUrl })
        });
      } catch (e) {
        console.error('Failed to set Telegram webhook:', e);
      }
    }

    if (botToken && chatId) {
      const payload = {
        chat_id: chatId,
        text: message
        // NO parse_mode — plain text so editMessageText in webhook works correctly
      };

      // Add inline keyboard buttons for status control
      if (orderId) {
        payload.reply_markup = {
          inline_keyboard: [
            [
              { text: "🟡 ● قيد الانتظار", callback_data: `status:pending:${orderId}` },
              { text: "🔵 تم التجهيز", callback_data: `status:confirmed:${orderId}` }
            ],
            [
              { text: "🚚 خرج للشحن", callback_data: `status:shipped:${orderId}` },
              { text: "🟢 تم التسليم", callback_data: `status:delivered:${orderId}` }
            ]
          ]
        };
      }

      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!tgRes.ok) {
        const errText = await tgRes.text();
        console.error('Telegram API error:', errText);
        // Don't throw — order was saved, telegram notification is secondary
      }
    } else {
      console.warn('Telegram not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.');
    }

    return res.status(200).json({ success: true, id: orderId, order_number: orderNumber });

  } catch (err) {
    console.error('Order handler error:', err);
    return res.status(500).json({ success: false, error: err.message || 'server_error' });
  }
}
