export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const {
        product, price, shipping, total,
        name, phone, gov, address, payMethod
    } = req.body;

    const message =
        `🚨 *طلب جديد من NOXERA* 🚨\n\n` +
        `📦 *المنتج:* ${product}\n` +
        `💵 *السعر:* ${price} ج.م\n` +
        `🚚 *الشحن:* ${shipping} ج.م\n` +
        `💰 *الإجمالي:* ${total} ج.م\n\n` +
        `👤 *العميل:* ${name}\n` +
        `📞 *الموبايل:* ${phone}\n` +
        `📍 *المحافظة:* ${gov}\n` +
        `🏡 *العنوان:* ${address}\n` +
        `💳 *الدفع:* ${payMethod}`;

    try {
        const waRes = await fetch('https://gate.whapi.cloud/messages/text', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.WHAPI_TOKEN}`
            },
            body: JSON.stringify({
                to: process.env.OWNER_PHONE,
                body: message
            })
        });

        if (!waRes.ok) {
            const err = await waRes.text();
            console.error('Whapi error:', err);
            return res.status(500).json({ success: false, error: 'whapi_failed' });
        }

        return res.status(200).json({ success: true });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, error: 'server_error' });
    }
}
