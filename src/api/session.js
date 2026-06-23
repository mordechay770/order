/**
 * GET /api/session?id=cs_xxx
 * Retrieves Stripe checkout session and extracts client_reference_id → order number.
 * Used by /status page after Stripe payment redirect.
 */

const ALLOWED_ORIGINS = [
  'https://src-sigma-ecru-25.vercel.app',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

export default async function handler(req, res) {
  const origin = req.headers['origin'] || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (origin) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const sessionId = req.query.id;
  if (!sessionId || !sessionId.startsWith('cs_')) {
    return res.status(400).json({ error: 'Invalid session_id' });
  }

  const stripeKey = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!stripeKey) return res.status(500).json({ error: 'Stripe not configured' });

  try {
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: {
        Authorization: `Bearer ${stripeKey}`,
      },
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error(`Stripe ${r.status}: ${txt.slice(0, 200)}`);
    }
    const session = await r.json();
    const ref = session.client_reference_id || '';
    // ref format: "ORDER-42" → extract number
    const match = ref.match(/ORDER-(\d+)/i);
    const orderNum = match ? parseInt(match[1], 10) : null;

    return res.status(200).json({
      order_number:         orderNum,
      client_reference_id:  ref,
      payment_status:       session.payment_status,
      amount_total:         session.amount_total,
    });
  } catch (err) {
    console.error('[session]', err.message);
    return res.status(502).json({ error: 'Failed to retrieve session', detail: err.message });
  }
}
