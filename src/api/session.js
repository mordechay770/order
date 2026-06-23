/**
 * GET /api/session?id=cs_xxx
 * Retrieves Stripe checkout session, extracts order number, and (on first call)
 * creates a payment record in Airtable linked to the order.
 */

const BASE    = 'appM61hkcOruhdBuv';
const AT_BASE = `https://api.airtable.com/v0/${BASE}`;
const T_PAYMENTS = 'tblaNK6mYqr20YtT1';
const T_QTY      = 'tblcP1zvc3Tu9oQuL'; // כמויות הזמנה
const DONATION_DISH_ID = 'reclQgCl0ATOFhepR'; // מאכלים record — "💚 Пожертвование / תרומה"

// כמויות fields
const FQ_ORDER    = 'fld4DlEIkuKYTJIwr'; // link → הזמנות
const FQ_DISH_LNK = 'fldYKuxwzyR0zsA6W'; // link → מאכלים
const FQ_QTY      = 'fldZI30djxv54dm8j'; // כמות
const FQ_PRICE    = 'fld2hjBAMbg4NeRef'; // עלות

// Payments table fields
const FP_ORDER    = 'fldG5Hooz07INgFB1'; // link → הזמנות
const FP_DATE     = 'fldW2CuSoBsTFqV5E'; // date
const FP_KZT      = 'fld8ZPOiTjoSyjzaa'; // Сумма в тенге
const FP_FOREIGN  = 'fldrbKz3JHBuiARSA'; // checkbox — מטבע זר
const FP_FOR_AMT  = 'fldoGe8BXCT0VITUQ'; // סכום במטבע זר
const FP_CURRENCY = 'fldp3mSTxtqDH9FSh'; // singleSelect — USD
const FP_RATE     = 'fldrFvqePRaNt6TKq'; // שער
const FP_NOTES    = 'fldNvdvqVWt0Go6Ze'; // notes
const FP_STATUS   = 'fldETI893nLw717mj'; // Done

const ALLOWED_ORIGINS = [
  'https://src-sigma-ecru-25.vercel.app',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

function atHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function fetchKztRate() {
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) throw new Error(`er-api ${r.status}`);
    const d = await r.json();
    const rate = d?.rates?.KZT;
    if (rate && rate > 1) return Math.round(rate * 100) / 100;
    throw new Error('no KZT rate');
  } catch (e) {
    console.error('[session] exchange rate fetch failed:', e.message);
    return null;
  }
}

async function createDonationQtyRow({ orderRecordId, donationUsd, rate, token }) {
  if (!orderRecordId || !donationUsd) return null;
  const kztRate    = rate || 450;
  const donationKzt = Math.round(donationUsd * kztRate);
  const r = await fetch(`${AT_BASE}/${T_QTY}?returnFieldsByFieldId=true`, {
    method:  'POST',
    headers: atHeaders(token),
    body:    JSON.stringify({ fields: {
      [FQ_ORDER]:    [orderRecordId],
      [FQ_DISH_LNK]: [DONATION_DISH_ID],
      [FQ_QTY]:      1,
      [FQ_PRICE]:    donationKzt,
    }}),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(d).slice(0, 100));
  return d.id;
}

async function paymentAlreadyExists(sessionId, token) {
  // Search for existing payment with this session ID in Notes field
  const url = `${AT_BASE}/${T_PAYMENTS}?returnFieldsByFieldId=true`
    + `&filterByFormula=${encodeURIComponent(`SEARCH("${sessionId}",{${FP_NOTES}})`)}`
    + `&maxRecords=1&fields[]=${FP_NOTES}`;
  const r = await fetch(url, { headers: atHeaders(token) });
  if (!r.ok) return false;
  const d = await r.json();
  return (d.records || []).length > 0;
}

async function createPaymentRecord({ orderRecordId, amountKzt, amountUsd, rate, sessionId, orderNum, token }) {
  const today = new Date().toISOString().slice(0, 10);
  const fields = {
    [FP_DATE]:     today,
    [FP_FOREIGN]:  true,
    [FP_CURRENCY]: 'USD',
    [FP_STATUS]:   'Done',
    [FP_NOTES]:    `Stripe session: ${sessionId}${orderNum ? ` | Заказ №${orderNum}` : ''}${rate ? ` | Курс из API: ${rate}` : ''}`,
  };
  if (amountKzt > 0)  fields[FP_KZT]     = amountKzt;
  if (amountUsd > 0)  fields[FP_FOR_AMT] = amountUsd;
  if (rate)           fields[FP_RATE]     = rate;
  if (orderRecordId && /^rec[A-Za-z0-9]{14}$/.test(orderRecordId)) {
    fields[FP_ORDER] = [orderRecordId];
  }

  const r = await fetch(`${AT_BASE}/${T_PAYMENTS}?returnFieldsByFieldId=true`, {
    method:  'POST',
    headers: atHeaders(token),
    body:    JSON.stringify({ fields }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(d).slice(0, 150));
  return d.id;
}

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

  const stripeKey     = (process.env.STRIPE_SECRET_KEY || '').trim();
  const airtableToken = (process.env.AIRTABLE_TOKEN    || '').replace(/^﻿/, '').trim();
  if (!stripeKey) return res.status(500).json({ error: 'Stripe not configured' });

  try {
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${stripeKey}` },
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error(`Stripe ${r.status}: ${txt.slice(0, 200)}`);
    }
    const session = await r.json();

    const ref     = session.client_reference_id || '';
    const match   = ref.match(/ORDER-(\d+)/i);
    const orderNum = match ? parseInt(match[1], 10) : null;
    const meta    = session.metadata || {};
    const amountKzt     = Number(meta.amount_kzt)     || 0;
    const orderRecordId = meta.order_record_id         || '';
    const donationUsd   = Number(meta.donation_usd)   || 0;
    const amountUsd     = (session.amount_total || 0) / 100; // total including donation

    // Create payment record in Airtable when payment is confirmed
    let paymentId = null;
    if (session.payment_status === 'paid' && airtableToken) {
      try {
        const alreadyExists = await paymentAlreadyExists(sessionId, airtableToken);
        if (alreadyExists) {
          console.log('[session] payment already recorded for', sessionId);
        } else {
          const rate = await fetchKztRate();
          paymentId = await createPaymentRecord({
            orderRecordId,
            amountKzt,
            amountUsd,
            rate,
            sessionId,
            orderNum,
            token: airtableToken,
          });
          console.log('[session] payment record created:', paymentId);

          // Create donation row in כמויות if applicable
          if (donationUsd > 0 && orderRecordId) {
            createDonationQtyRow({ orderRecordId, donationUsd, rate, token: airtableToken })
              .then(id => console.log('[session] donation qty row created:', id))
              .catch(e => console.error('[session] donation qty row failed:', e.message));
          }
        }
      } catch (e) {
        // Non-fatal — still return order info to user
        console.error('[session] payment record failed:', e.message);
      }
    }

    return res.status(200).json({
      order_number:        orderNum,
      client_reference_id: ref,
      payment_status:      session.payment_status,
      amount_total:        session.amount_total,
      amount_kzt:          amountKzt,
      payment_record_id:   paymentId,
    });
  } catch (err) {
    console.error('[session]', err.message);
    return res.status(502).json({ error: 'Failed to retrieve session', detail: err.message });
  }
}
