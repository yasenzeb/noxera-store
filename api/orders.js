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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Supabase integration is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' });
  }

  try {
    const { id } = req.query;

    if (req.method === 'GET') {
      const { number } = req.query;
      if (id || number) {
        let query = supabase.from('orders').select('*');
        if (id) {
          query = query.eq('id', id);
        } else {
          query = query.eq('order_number', number);
        }
        const { data, error } = await query.maybeSingle();
        if (error) throw error;
        return res.status(200).json({ success: true, order: data });
      } else {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return res.status(200).json({ success: true, orders: data || [] });
      }
    }

    if (req.method === 'POST') {
      const {
        order_number, customer_name, customer_phone,
        governorate, address, total, payment_method,
        status = 'pending', items = []
      } = req.body || {};

      if (!customer_name || !customer_phone || !total) {
        return res.status(400).json({ success: false, error: 'بيانات الطلب غير مكتملة' });
      }

      const { data, error } = await supabase.from('orders').insert([{
        order_number,
        customer_name,
        customer_phone,
        governorate,
        address,
        total: parseFloat(total),
        payment_method: payment_method || 'cod',
        status,
        items
      }]).select().single();

      if (error) throw error;
      return res.status(201).json({ success: true, order: data });
    }

    if (req.method === 'PUT') {
      if (!id) return res.status(400).json({ success: false, error: 'ID مطلوب' });
      const { status } = req.body || {};
      if (!status) return res.status(400).json({ success: false, error: 'status مطلوب' });

      const { data, error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id)
        .select().single();
      if (error) throw error;
      return res.status(200).json({ success: true, order: data });
    }

    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ success: false, error: 'ID مطلوب' });
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true, message: 'تم حذف الطلب' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
