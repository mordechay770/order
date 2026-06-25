/**
 * POST /api/stripe-checkout
 * Creates a Stripe Checkout Session with the exact order amount.
 * Body: { amount_kzt, order_num, order_id, customer_email? }
 * Returns: { url }  — redirect the user to this URL
 *
 * Requires env: STRIPE_SECRET_KEY, STRIPE_PRICE_KZT (optional price ID for KZT product)
 * If STRIPE_PRICE_KZT is set, uses it with quantity=1 and adjustable_quantity.
 * Otherwise creates an ad-hoc price in USD (converted at STRIPE_KZT_RATE env or 450).
 */

const SITE_URL = 'https://src-sigma-ecru-25.vercel.app';

const ALLOWED_ORIGINS = [
  'https://src-sigma-ecru-25.vercel.app',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

function parseBody(req) {
  return new Promise(resolve => {
    if (req.body !== undefined) { resolve(req.body); return; }
    let raw = '';
    req.on('data', c => { raw += c; });
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

  const stripeKey = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!stripeKey) return res.status(500).json({ error: 'Stripe not configured' });

  const body = await parseBody(req);
  if (!body || !body.amount_kzt || body.amount_kzt < 1) {
    return res.status(400).json({ error: 'amount_kzt required' });
  }

  const amountKzt = Math.round(Number(body.amount_kzt));
  const orderNum  = body.order_num  || '';
  const orderId   = body.order_id   || '';
  const ref       = orderNum ? `ORDER-${orderNum}` : (orderId || '');

  // Success URL — Stripe replaces {CHECKOUT_SESSION_ID} automatically
  const successUrl = `${SITE_URL}/status?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl  = `${SITE_URL}/`;

  // Build Stripe Checkout Session via REST (no SDK needed)
  const kztRate    = Number(process.env.STRIPE_KZT_RATE || 450);
  const amountUsd  = Math.max(1, Math.round((amountKzt / kztRate) * 100)); // cents

  const orderRecordId = body.order_record_id || '';
  const donationUsd   = Math.max(0, Math.round(Number(body.donation_usd) || 0));
  const donationCents = donationUsd * 100;

  const params = new URLSearchParams({
    'mode':                          'payment',
    'success_url':                   successUrl,
    'cancel_url':                    cancelUrl,
    'client_reference_id':           ref,
    'line_items[0][price_data][currency]':              'usd',
    'line_items[0][price_data][unit_amount]':           String(amountUsd),
    'line_items[0][price_data][product_data][name]':   `Заказ ${orderNum || orderId} · ${amountKzt} ₸`,
    'line_items[0][quantity]':       '1',
    // store KZT amount and order record ID in metadata
    'metadata[amount_kzt]':          String(amountKzt),
    'metadata[order_num]':           String(orderNum),
    'metadata[order_record_id]':     orderRecordId,
    'metadata[donation_usd]':        String(donationUsd),
  });

  // Add donation as second line item if provided
  if (donationCents > 0) {
    params.set('line_items[1][price_data][currency]',                  'usd');
    params.set('line_items[1][price_data][unit_amount]',               String(donationCents));
    params.set('line_items[1][price_data][product_data][name]',        '💚 Пожертвование кухне / Kitchen Donation');
    params.set('line_items[1][price_data][product_data][description]', 'Добровольное пожертвование на питание членов общины');
    params.set('line_items[1][quantity]',                              '1');
  }

  if (body.customer_email) params.set('customer_email', body.customer_email);

  try {
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error?.message || `Stripe ${r.status}`);
    return res.status(200).json({ url: data.url, session_id: data.id });
  } catch (err) {
    console.error('[stripe-checkout]', err.message);
    return res.status(502).json({ error: err.message });
  }
}
