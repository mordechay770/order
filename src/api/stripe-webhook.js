/**
 * POST /api/stripe-webhook
 * Stripe sends checkout.session.completed here.
 * Creates a payment record in Airtable linked to the order.
 *
 * Env vars required:
 *   STRIPE_WEBHOOK_SECRET  — from Stripe dashboard > Webhooks > signing secret
 *   AIRTABLE_TOKEN
 *
 * Must register in Stripe: endpoint = https://src-sigma-ecru-25.vercel.app/api/stripe-webhook
 * Event: checkout.session.completed
 */

import crypto from 'crypto';

export const config = { api: { bodyParser: false } };

const BASE    = 'appM61hkcOruhdBuv';
const AT_BASE = `https://api.airtable.com/v0/${BASE}`;

const T_ORDERS   = 'tblMnlLwYCD27ou80';
const T_PAYMENTS = 'tblaNK6mYqr20YtT1';
const FO_SERIAL  = 'fldlJLSKuSB5zvmGt';

// Payments table fields
const FP_ORDER    = 'fldG5Hooz07INgFB1'; // multipleRecordLinks → הזמנות
const FP_DATE     = 'fldW2CuSoBsTFqV5E'; // date
const FP_KZT      = 'fld8ZPOiTjoSyjzaa'; // number — סכום בתנגה
const FP_FOREIGN  = 'fldrbKz3JHBuiARSA'; // checkbox — שולם במטבע זר
const FP_FOR_AMT  = 'fldoGe8BXCT0VITUQ'; // number — סכום במטבע זר
const FP_CURRENCY = 'fldp3mSTxtqDH9FSh'; // singleSelect — USD/ILS/EUR/RUB
const FP_RATE     = 'fldrFvqePRaNt6TKq'; // number — שער ₸ ל-1 יחידת מטבע זר
const FP_NOTES    = 'fldNvdvqVWt0Go6Ze'; // multilineText
const FP_STATUS   = 'fldETI893nLw717mj'; // singleSelect — Done

function atHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  const parts   = sigHeader.split(',');
  const tsPart  = parts.find(p => p.startsWith('t='));
  const v1Part  = parts.find(p => p.startsWith('v1='));
  if (!tsPart || !v1Part) return false;
  const ts       = tsPart.slice(2);
  const v1       = v1Part.slice(3);
  const payload  = `${ts}.${rawBody.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}

/** Fetch live USD→KZT exchange rate from open.er-api.com (free, no auth) */
async function fetchKztRate() {
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(4000) });
    if (!r.ok) throw new Error(`er-api ${r.status}`);
    const d = await r.json();
    const rate = d?.rates?.KZT;
    if (rate && rate > 1) return Math.round(rate * 100) / 100;
    throw new Error('no KZT rate');
  } catch (e) {
    console.error('[stripe-webhook] exchange rate fetch failed:', e.message);
    return null;
  }
}

/** Find Airtable order record ID by serial number */
async function findOrderRecordId(serial, token) {
  const url = `${AT_BASE}/${T_ORDERS}?returnFieldsByFieldId=true`
    + `&filterByFormula=${encodeURIComponent(`{${FO_SERIAL}}=${serial}`)}`
    + `&fields[]=${FO_SERIAL}&maxRecords=1`;
  const r = await fetch(url, { headers: atHeaders(token) });
  if (!r.ok) return null;
  const d = await r.json();
  return d.records?.[0]?.id || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  const sigHeader     = req.headers['stripe-signature'] || '';
  const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  const airtableToken = (process.env.AIRTABLE_TOKEN || '').replace(/^﻿/, '').trim();

  // Verify Stripe signature (skip only if webhook secret is not configured yet)
  if (webhookSecret && !verifyStripeSignature(rawBody, sigHeader, webhookSecret)) {
    console.error('[stripe-webhook] signature mismatch');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true, skipped: event.type });
  }

  const session  = event.data?.object || {};
  const meta     = session.metadata   || {};

  const amountKzt     = Number(meta.amount_kzt) || 0;
  const orderNum      = meta.order_num           || '';
  const orderRecordId = meta.order_record_id     || '';
  const sessionId     = session.id               || '';
  const amountUsd     = (session.amount_total || 0) / 100; // dollars

  if (!airtableToken) {
    console.error('[stripe-webhook] no AIRTABLE_TOKEN');
    return res.status(500).json({ error: 'Airtable not configured' });
  }

  // Resolve order record ID (from metadata, or search by serial)
  let recId = orderRecordId && /^rec[A-Za-z0-9]{14}$/.test(orderRecordId) ? orderRecordId : null;
  if (!recId && orderNum) {
    recId = await findOrderRecordId(Number(orderNum), airtableToken);
  }

  // Fetch live exchange rate
  const kztRate = await fetchKztRate();

  // Compute rate: how many ₸ per 1 USD
  // prefer live rate; fallback to computed from amounts
  let rate = kztRate;
  if (!rate && amountUsd > 0 && amountKzt > 0) {
    rate = Math.round((amountKzt / amountUsd) * 100) / 100;
  }

  const today = new Date().toISOString().slice(0, 10);

  const fields = {
    [FP_DATE]:     today,
    [FP_FOREIGN]:  true,
    [FP_CURRENCY]: 'USD',
    [FP_STATUS]:   'Done',
    [FP_NOTES]:    `Stripe session: ${sessionId}${orderNum ? ` | Заказ №${orderNum}` : ''}${kztRate ? ` | Курс из API: ${kztRate}` : ''}`,
  };

  if (amountKzt > 0)  fields[FP_KZT]     = amountKzt;
  if (amountUsd > 0)  fields[FP_FOR_AMT] = amountUsd;
  if (rate)           fields[FP_RATE]     = rate;
  if (recId)          fields[FP_ORDER]    = [recId];

  try {
    const r = await fetch(`${AT_BASE}/${T_PAYMENTS}?returnFieldsByFieldId=true`, {
      method: 'POST',
      headers: atHeaders(airtableToken),
      body: JSON.stringify({ fields }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(d).slice(0, 200));
    console.log('[stripe-webhook] payment created:', d.id, '| order:', recId, '| rate:', rate);
    return res.status(200).json({ received: true, payment_id: d.id });
  } catch (err) {
    console.error('[stripe-webhook] Airtable error:', err.message);
    return res.status(502).json({ error: err.message });
  }
}
