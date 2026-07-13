export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { password } = req.body || {};
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'noxera2026';

    if (password === ADMIN_PASSWORD) {
      return res.status(200).json({ success: true });
    }

    return res.status(401).json({ success: false, error: 'كلمة المرور غير صحيحة' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
