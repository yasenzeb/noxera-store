export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const { text } = req.body;

  if (!text) {
    return res.status(400).json({
      error: 'text required'
    });
  }

  const prompt = `
استخرج من النص التالي:
- الاسم الكامل
- رقم الموبايل المصري
- المحافظة
- العنوان التفصيلي

أرجع JSON فقط بدون أي كلام إضافي بهذا الشكل:

{
  "name":"...",
  "phone":"...",
  "governorate":"...",
  "address":"..."
}

النص:
${text}
`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    let raw =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      '{}';

    raw = raw
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    try {
      return res.status(200).json(JSON.parse(raw));
    } catch {
      return res.status(200).json({});
    }

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
}