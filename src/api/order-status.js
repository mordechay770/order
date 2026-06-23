/**
 * GET /api/order-status?num=123
 * Returns order status + basic details for a customer-facing status page.
 */

const BASE    = 'appM61hkcOruhdBuv';
const AT_BASE = `https://api.airtable.com/v0/${BASE}`;

const T_ORDERS = 'tblMnlLwYCD27ou80';

const FO_SERIAL   = 'fldlJLSKuSB5zvmGt';
const FO_STATUS   = 'fldcekWvpJwdVVMK6';
const FO_NAME_RU  = 'flddCvqJiwEsg9pr1';
const FO_DATE_EXE = 'fldF8G3nQ7FU7GAqS';
const FO_CUST_NAME= 'fld1FKztthSOvgJhJ';
const FO_PRICE    = 'fldJA6xBGacdetQjI';
const FO_COUNT    = 'fldBrAoMYSoO8f2ug';

const ALLOWED_ORIGINS = [
  'https://src-sigma-ecru-25.vercel.app',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

function atHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
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

  const byId  = req.query.id;   // Airtable record ID (for manager page)
  const byNum = parseInt(req.query.num, 10); // serial number (for customer page)

  if (!byId && (!byNum || byNum < 1)) return res.status(400).json({ error: 'Provide id or num' });

  const token = (process.env.AIRTABLE_TOKEN || '').replace(/^﻿/, '').trim();
  if (!token) return res.status(500).json({ error: 'Server misconfigured' });

  try {
    const fields = [FO_SERIAL, FO_STATUS, FO_NAME_RU, FO_DATE_EXE, FO_CUST_NAME, FO_PRICE, FO_COUNT];
    let rec;

    if (byId && /^rec[A-Za-z0-9]{14}$/.test(byId)) {
      const qs = `${fields.map(f=>`fields[]=${f}`).join('&')}&returnFieldsByFieldId=true`;
      const r = await fetch(`${AT_BASE}/${T_ORDERS}/${byId}?${qs}`, { headers: atHeaders(token) });
      if (r.status === 404) return res.status(404).json({ error: 'Order not found' });
      if (!r.ok) throw new Error(`Airtable ${r.status}`);
      rec = await r.json();
    } else {
      const formula = `{${FO_SERIAL}}=${byNum}`;
      const qs = `filterByFormula=${encodeURIComponent(formula)}&${fields.map(f=>`fields[]=${f}`).join('&')}&returnFieldsByFieldId=true`;
      const r = await fetch(`${AT_BASE}/${T_ORDERS}?${qs}`, { headers: atHeaders(token) });
      if (!r.ok) throw new Error(`Airtable ${r.status}`);
      const data = await r.json();
      rec = data.records?.[0];
      if (!rec) return res.status(404).json({ error: 'Order not found' });
    }

    const f = rec.fields || {};
    // singleSelect returns {id, name, color} — extract name
    const statusRaw = f[FO_STATUS];
    const status = (statusRaw && typeof statusRaw === 'object') ? (statusRaw.name || '') : (statusRaw || '');
    return res.status(200).json({
      order_id:     rec.id,
      order_number: f[FO_SERIAL]    ?? byNum ?? null,
      status,
      order_type:   f[FO_NAME_RU]   || '',
      delivery_at:  f[FO_DATE_EXE]  || null,
      customer:     f[FO_CUST_NAME] || '',
      total:        f[FO_PRICE]     || 0,
      item_count:   f[FO_COUNT]     || 0,
    });
  } catch (err) {
    console.error('[order-status]', err.message, err.stack);
    return res.status(502).json({ error: 'Failed to fetch order', detail: err.message });
  }
}
