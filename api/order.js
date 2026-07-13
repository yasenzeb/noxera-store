import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).end();

    if (req.method !== 'POST') return res.status(405).end();

    const {
        product, productId, price, shipping, total,
        name, phone, gov, address, payMethod
    } = req.body;

    const orderNumber = `NOX-${Math.floor(100000 + Math.random() * 900000)}`;

    const message =
        `🚨 <b>طلب جديد من NOXERA (#${orderNumber})</b> 🚨\n\n` +
        `📦 <b>المنتج:</b> ${product}\n` +
        `💵 <b>السعر:</b> ${price} ج.م\n` +
        `🚚 <b>الشحن:</b> ${shipping} ج.م\n` +
        `💰 <b>الإجمالي:</b> ${total} ج.م\n\n` +
        `👤 <b>العميل:</b> ${name}\n` +
        `📞 <b>الموبايل:</b> ${phone}\n` +
        `📍 <b>المحافظة:</b> ${gov}\n` +
        `🏡 <b>العنوان:</b> ${address}\n` +
        `💳 <b>الدفع:</b> ${payMethod}`;

    try {
        // 1. Send Telegram Notification
        const botToken = '8895784637:AAE0R_kF1myYsSaMEYJYoavFpSVpDUWqNO4';
        const chatId = '5022327836';
        const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

        const tgRes = await fetch(telegramUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML'
            })
        });

        if (!tgRes.ok) {
            const err = await tgRes.text();
            console.error('Telegram error:', err);
        }

        // 2. Save Order to Supabase Table (orders)
        const items = [{
            id: productId || null,
            name: product,
            price: price,
            quantity: 1
        }];

        const { error: dbError } = await supabase.from('orders').insert([{
            order_number: orderNumber,
            customer_name: name,
            customer_phone: phone,
            governorate: gov,
            address: address,
            total: total,
            payment_method: payMethod === 'كاش عند الاستلام' ? 'cod' : 'card',
            status: 'pending',
            items: items
        }]);

        if (dbError) {
            console.error('Database error saving order:', dbError);
        }

        return res.status(200).json({ success: true });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, error: 'server_error' });
    }
}
