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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  // GET request: Auto-register the webhook url with Telegram Bot API
  if (req.method === 'GET') {
    if (!botToken) {
      return res.status(400).json({ success: false, error: 'TELEGRAM_BOT_TOKEN environment variable is not defined.' });
    }

    try {
      const host = req.headers.host;
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const webhookUrl = `${protocol}://${host}/api/telegram-webhook`;

      const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
      const data = await response.json();

      return res.status(200).json({
        success: true,
        message: 'Webhook registration attempt completed.',
        telegram_response: data,
        webhook_url: webhookUrl
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST request: Handle incoming updates from Telegram
  if (req.method === 'POST') {
    try {
      const update = req.body;
      if (!update || !update.callback_query) {
        return res.status(200).json({ success: true, message: 'Unhandled update type.' });
      }

      const callbackQuery = update.callback_query;
      const callbackData = callbackQuery.data; // format: "status:new_status:order_id"
      const callbackQueryId = callbackQuery.id;

      if (callbackData && callbackData.startsWith('status:')) {
        const parts = callbackData.split(':');
        const newStatus = parts[1];
        const orderId = parts[2];

        if (!supabase) {
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callback_query_id: callbackQueryId,
              text: '❌ خطأ: لم يتم تهيئة اتصال قاعدة البيانات.'
            })
          });
          return res.status(200).json({ success: false, error: 'Supabase client not initialized' });
        }

        // Update the order status in Supabase database
        const { data: updatedOrder, error: dbError } = await supabase
          .from('orders')
          .update({ status: newStatus })
          .eq('id', orderId)
          .select()
          .single();

        if (dbError) {
          console.error('Database update error:', dbError);
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callback_query_id: callbackQueryId,
              text: '❌ فشل تحديث حالة الطلب في قاعدة البيانات.'
            })
          });
          return res.status(200).json({ success: false, error: dbError.message });
        }

        // Mapping labels
        const statusLabels = {
          pending: '🟡 قيد الانتظار',
          confirmed: '🔵 تم قبول الطلب وجاري تجهيزه',
          shipped: '🚚 خرج للشحن',
          delivered: '🟢 تم التسليم'
        };
        const statusLabel = statusLabels[newStatus] || newStatus;

        // Answer callback query with alert popup
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callbackQueryId,
            text: `✅ تم تحديث حالة الطلب بنجاح إلى: ${statusLabel}`
          })
        });

        // Edit message text to show updated status at the bottom of the original message
        const originalText = callbackQuery.message.text || '';
        const cleanText = originalText.split('\n\n🔄 حالة الطلب')[0];
        const updatedText = `${cleanText}\n\n🔄 حالة الطلب الحالية: <b>${statusLabel}</b>`;

        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: callbackQuery.message.chat.id,
            message_id: callbackQuery.message.message_id,
            text: updatedText,
            parse_mode: 'HTML',
            reply_markup: callbackQuery.message.reply_markup // Keep the inline keyboard buttons active
          })
        });
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Webhook handler error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
