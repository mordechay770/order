/**
 * GET /api/pay-link?order=recXXX&token=MANAGER_TOKEN
 *   → validates manager token, computes HMAC, returns { url, order_num, cust_name, phone, amount_kzt }
 *
 * GET /api/pay-link?order=recXXX&sig=HASH
 *   → validates HMAC (public), returns order data for the pay page
 *
 * Env vars: PAYMENT_LINK_SECRET, MANAGER_TOKEN, AIRTABLE_TOKEN
 */

import crypto from 'crypto';
import { getRecord } from '../lib/db.js';

const T_ORDERS     = 'tblMnlLwYCD27ou80';
const FO_SERIAL    = 'fldlJLSKuSB5zvmGt';
const FO_NAME_RU   = 'flddCvqJiwEsg9pr1';
const FO_CUST_NAME = 'fld1FKztthSOvgJhJ';
const FO_PHONE     = 'fldMPQfkQATfg6j0t';
const FO_PRICE     = 'fldJA6xBGacdetQjI';
const FO_STATUS    = 'fldcekWvpJwdVVMK6';

const SITE_URL = 'https://src-sigma-ecru-25.vercel.app';

function getSecret() {
  const s = (process.env.PAYMENT_LINK_SECRET || '').trim();
  if (!s) throw new Error('PAYMENT_LINK_SECRET not configured');
  return s;
}

function makeSignature(recordId) {
  return crypto.createHmac('sha256', getSecret()).update(recordId).digest('hex').slice(0, 32);
}

function verifySignature(recordId, sig) {
  if (!sig || sig.length !== 32) return false;
  const expected = makeSignature(recordId);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(sig, 'utf8'));
  } catch {
    return false;
  }
}

function isManager(token) {
  const clean = t => (t || '').replace(/^﻿/, '').trim();
  return token === clean(process.env.MANAGER_TOKEN);
}

function orderData(recordId, f) {
  return {
    order_id:   recordId,
    order_num:  f[FO_SERIAL]    || '',
    cust_name:  f[FO_CUST_NAME] || '',
    phone:      f[FO_PHONE]     || '',
    amount_kzt: f[FO_PRICE]     || 0,
    order_type: f[FO_NAME_RU]   || '',
    status:     typeof f[FO_STATUS] === 'object' ? f[FO_STATUS].name : (f[FO_STATUS] || ''),
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const orderId = (req.query.order || '').trim();
  if (!orderId || !/^rec[A-Za-z0-9]{14}$/.test(orderId)) {
    return res.status(400).json({ error: 'Invalid order id' });
  }

  // ── Mode 1: manager generates a signed link ──────────────────────────────
  const reqToken = (req.query.token || '').trim();
  if (reqToken) {
    if (!isManager(reqToken)) return res.status(403).json({ error: 'Forbidden' });
    let sig;
    try { sig = makeSignature(orderId); }
    catch (e) { return res.status(500).json({ error: e.message }); }

    const url = `${SITE_URL}/pay?order=${orderId}&sig=${sig}`;
    const rec = await getRecord(T_ORDERS, orderId).catch(() => null);
    const data = orderData(orderId, rec?.fields || {});
    return res.status(200).json({ url, ...data });
  }

  // ── Mode 2: public — verify sig and return order data ────────────────────
  const sig = (req.query.sig || '').trim();
  if (!sig) return res.status(400).json({ error: 'sig or token required' });

  let valid;
  try { valid = verifySignature(orderId, sig); }
  catch (e) { return res.status(500).json({ error: e.message }); }
  if (!valid) return res.status(403).json({ error: 'Invalid signature' });

  const rec = await getRecord(T_ORDERS, orderId).catch(() => null);
  if (!rec) return res.status(404).json({ error: 'Order not found' });

  const data = orderData(orderId, rec.fields || {});

  // Attach public Kaspi config from env (set once in Vercel — KASPI_PHONE, KASPI_IBAN, KASPI_NAME)
  data.kaspi_phone = (process.env.KASPI_PHONE || '').trim();
  data.kaspi_iban  = (process.env.KASPI_IBAN  || '').trim();
  data.kaspi_name  = (process.env.KASPI_NAME  || '').trim();
  data.stripe_enabled = !!(process.env.STRIPE_SECRET_KEY || '').trim();

  return res.status(200).json(data);
}
