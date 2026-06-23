/**
 * POST /api/send-wa
 * Resend WhatsApp notification to customer with a (possibly corrected) phone number.
 * Body: { phone, order_id, order_number, lang }
 */

const SITE_URL = 'https://src-sigma-ecru-25.vercel.app';

const ALLOWED_ORIGINS = [
  'https://src-sigma-ecru-25.vercel.app',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

function toWaId(phone) {
  const digits = phone.replace(/\D/g, '');
  const norm = digits.startsWith('8') && digits.length === 11 ? '7' + digits.slice(1) : digits;
  return norm + '@c.us';
}

function parseBody(req) {
  return new Promise((resolve) => {
    if (req.body !== undefined) { resolve(req.body); return; }
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } });
    req.on('error', () => resolve(null));
  });
}

export default async function handler(req, res) {
  const origin = req.headers['origin'] || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (origin) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = await parseBody(req);
  if (!body || !body.phone) return res.status(400).json({ error: 'Missing phone' });

  const phone  = body.phone;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return res.status(400).json({ error: 'Phone too short', sent: false });

  const instance = (process.env.GREEN_API_INSTANCE || '').trim();
  const apiToken = (process.env.GREEN_API_TOKEN   || '').trim();
  if (!instance || !apiToken) return res.status(500).json({ error: 'WhatsApp not configured', sent: false });

  const lang     = body.lang || 'ru';
  const orderNum = body.order_number ? `№${body.order_number}` : '';
  const statusUrl = body.order_number ? `${SITE_URL}/status?num=${body.order_number}` : '';

  const TMPL = {
    ru: `✅ Заказ ${orderNum} принят!\nОжидайте подтверждения менеджера.${statusUrl ? '\n\n🔗 Статус: ' + statusUrl : ''}`,
    en: `✅ Order ${orderNum} received!\nAwaiting manager confirmation.${statusUrl ? '\n\n🔗 Status: ' + statusUrl : ''}`,
    he: `✅ הזמנה ${orderNum} התקבלה!\nממתינים לאישור מנהל.${statusUrl ? '\n\n🔗 סטטוס: ' + statusUrl : ''}`,
  };
  const message = TMPL[lang] || TMPL.ru;

  try {
    const url = `https://api.green-api.com/waInstance${instance}/sendMessage/${apiToken}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: toWaId(phone), message }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok && data.idMessage) {
      return res.status(200).json({ sent: true });
    }
    return res.status(200).json({ sent: false, error: data.message || 'WhatsApp error', detail: data });
  } catch (e) {
    return res.status(500).json({ sent: false, error: e.message });
  }
}
