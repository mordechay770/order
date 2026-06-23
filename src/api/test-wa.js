/**
 * GET /api/test-wa?phone=77015888488
 * Temporary debug endpoint — tests Green API connectivity.
 * DELETE THIS FILE after debugging.
 */
export default async function handler(req, res) {
  const instance = (process.env.GREEN_API_INSTANCE || '').trim();
  const apiToken = (process.env.GREEN_API_TOKEN   || '').trim();

  if (!instance || !apiToken) {
    return res.status(500).json({ error: 'GREEN_API_INSTANCE or GREEN_API_TOKEN not set', instance: !!instance, token: !!apiToken });
  }

  const phone = (req.query.phone || '77015888488').replace(/\D/g, '');
  const norm  = phone.startsWith('8') && phone.length === 11 ? '7' + phone.slice(1) : phone;
  const chatId = norm + '@c.us';

  const url = `https://api.green-api.com/waInstance${instance}/sendMessage/${apiToken}`;

  try {
    const r = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chatId, message: `✅ Тест Green API — ${new Date().toISOString()}` }),
    });
    const body = await r.json().catch(() => r.text());
    return res.status(200).json({ status: r.status, ok: r.ok, body, url: url.replace(apiToken, '***'), chatId });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
