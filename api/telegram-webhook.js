import { createClient } from '@supabase/supabase-js';

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  } catch (e) {
    console.error('Supabase initialization error:', e);
  }
}

const STATUS_LABELS = {
  pending:   '🟡 قيد الانتظار',
  confirmed: '🔵 تم القبول والتجهيز',
  shipped:   '🚚 خرج للشحن',
  delivered: '🟢 تم التسليم'
};

async function tgApi(botToken, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!data.ok) {
    console.error(`Telegram ${method} error:`, JSON.stringify(data));
  }
  return data;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  // ──────────────────────────────────────────────
  // GET: Register webhook with Telegram
  // ──────────────────────────────────────────────
  if (req.method === 'GET') {
    if (!botToken) {
      return res.status(400).json({ success: false, error: 'TELEGRAM_BOT_TOKEN not set.' });
    }
    try {
      const host = req.headers.host;
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const webhookUrl = `${protocol}://${host}/api/telegram-webhook`;

      // First delete any old webhook
      await tgApi(botToken, 'deleteWebhook', {});
      // Then set new one
      const result = await tgApi(botToken, 'setWebhook', { url: webhookUrl });

      return res.status(200).json({
        success: true,
        webhook_url: webhookUrl,
        telegram_response: result
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ──────────────────────────────────────────────
  // POST: Handle Telegram callback_query updates
  // ──────────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const update = req.body;

      // Telegram sends many update types; we only care about callback_query
      if (!update || !update.callback_query) {
        return res.status(200).json({ ok: true });
      }

      const cb = update.callback_query;
      const cbId = cb.id;
      const cbData = cb.data || '';

      // Our format: "status:<newStatus>:<orderId>"
      if (!cbData.startsWith('status:')) {
        await tgApi(botToken, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: '⚠️ إجراء غير معروف'
        });
        return res.status(200).json({ ok: true });
      }

      const parts = cbData.split(':');
      if (parts.length < 3) {
        await tgApi(botToken, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: '❌ بيانات غير صحيحة'
        });
        return res.status(200).json({ ok: true });
      }

      const newStatus = parts[1];
      const orderId = parts.slice(2).join(':'); // Handle UUIDs with colons (won't happen, but safe)

      // ── 1. Validate Supabase connection ──
      if (!supabase) {
        await tgApi(botToken, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: '❌ خطأ: قاعدة البيانات غير متصلة'
        });
        return res.status(200).json({ ok: true });
      }

      // ── 2. Update order in database ──
      const { data: updatedOrder, error: dbError } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId)
        .select()
        .single();

      if (dbError) {
        console.error('DB update error:', dbError);
        await tgApi(botToken, 'answerCallbackQuery', {
          callback_query_id: cbId,
          text: '❌ فشل التحديث: ' + (dbError.message || 'خطأ غير معروف')
        });
        return res.status(200).json({ ok: true });
      }

      const statusLabel = STATUS_LABELS[newStatus] || newStatus;

      // ── 3. Answer the callback (toast popup in Telegram) ──
      await tgApi(botToken, 'answerCallbackQuery', {
        callback_query_id: cbId,
        text: `✅ تم التحديث: ${statusLabel}`,
        show_alert: true
      });

      // ── 4. Edit the message to show current status ──
      // Use the original message text (plain text, no HTML entities from callback)
      const msg = cb.message;
      if (msg) {
        const chatId = msg.chat.id;
        const messageId = msg.message_id;

        // Rebuild the message text: keep original + append/update status line
        let originalText = msg.text || '';
        
        // Remove any previously appended status line
        const statusLineRegex = /\n\n━━━━━━━━━━━━━━━━━━━━\n🔄 حالة الطلب:.*/s;
        originalText = originalText.replace(statusLineRegex, '');

        const newText = originalText +
          `\n\n━━━━━━━━━━━━━━━━━━━━\n🔄 حالة الطلب: ${statusLabel}`;

        // Rebuild the inline keyboard (keep buttons active for future clicks)
        const inlineKeyboard = [
          [
            { text: newStatus === 'pending' ? '🟡 ● قيد الانتظار' : '🟡 قيد الانتظار', callback_data: `status:pending:${orderId}` },
            { text: newStatus === 'confirmed' ? '🔵 ● تم التجهيز' : '🔵 تم التجهيز', callback_data: `status:confirmed:${orderId}` }
          ],
          [
            { text: newStatus === 'shipped' ? '🚚 ● خرج للشحن' : '🚚 خرج للشحن', callback_data: `status:shipped:${orderId}` },
            { text: newStatus === 'delivered' ? '🟢 ● تم التسليم' : '🟢 تم التسليم', callback_data: `status:delivered:${orderId}` }
          ]
        ];

        await tgApi(botToken, 'editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: newText,
          reply_markup: { inline_keyboard: inlineKeyboard }
        });
      }

      return res.status(200).json({ ok: true, status: newStatus });

    } catch (err) {
      console.error('Webhook handler error:', err);
      // Always return 200 to Telegram to prevent retries
      return res.status(200).json({ ok: true, error: err.message });
    }
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
