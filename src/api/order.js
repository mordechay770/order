/**
 * POST /api/order
 * Saves an order directly to Airtable (replaces Make.com scenario 4914420).
 * Body: { customer_name, customer_phone, delivery_address?, notes?,
 *         order_type, order_type_title, order_date?, delivery_time?,
 *         items: [{dish_id, dish_name, quantity, unit_price}],
 *         total_price, payment_method, payment_breakdown? }
 */

const BASE    = 'appM61hkcOruhdBuv';
const AT_BASE = `https://api.airtable.com/v0/${BASE}`;

// Tables
const T_ORDERS = 'tblMnlLwYCD27ou80'; // הזמנות אוכל מהמטבח
const T_QTY    = 'tblcP1zvc3Tu9oQuL'; // כמויות - משויך להזמנות

// Fields — orders (הזמנות)
const FO_SERIAL   = 'fldlJLSKuSB5zvmGt'; // מס' סידורי (autoNumber)
const FO_STATUS   = 'fldcekWvpJwdVVMK6'; // סטטוס הזמנה
const FO_NAME_RU  = 'flddCvqJiwEsg9pr1'; // שם ההזמנה
const FO_DATE_RCV = 'fldiftbFtfWuWvNPq'; // תאריך קבלת ההזמנה
const FO_DATE_EXE = 'fldF8G3nQ7FU7GAqS'; // תאריך ושעת ביצוע
const FO_CUST_NAME= 'fld1FKztthSOvgJhJ'; // שם הלקוח
const FO_PHONE    = 'fldMPQfkQATfg6j0t'; // מספר טלפון
const FO_ADDRESS  = 'fld2j0eu6qrid1DXA'; // כתובת למשלוח
const FO_DELIVERY = 'fldH9aXNoJSABpTJP'; // משלוח (כן/לא)
const FO_NOTES    = 'fldKGooL6E0PkqKfI'; // הערות לקוח
const FO_PAYMENT  = 'fldjE5esZVBwDjNDi'; // צורת תשלום
const FO_PRICE    = 'fldJA6xBGacdetQjI'; // מחיר (מספר)
const FO_COUNT    = 'fldBrAoMYSoO8f2ug'; // מס' פוזיציות

// Fields — quantities (כמויות)
const FQ_ORDER    = 'fld4DlEIkuKYTJIwr'; // link → הזמנות
const FQ_DISH_LNK = 'fldYKuxwzyR0zsA6W'; // link → מאכלים (tblhkNaiSGBiLRUxA)
const FQ_DISH_TXT = 'fldermtin9p2JInVx'; // מאכל (טקסט חופשי) — fallback בלבד
const FQ_QTY      = 'fldZI30djxv54dm8j'; // כמות
const FQ_PRICE    = 'fld2hjBAMbg4NeRef'; // עלות מנה בזמן ההזמנה

const SITE_URL = 'https://src-sigma-ecru-25.vercel.app';

const ALLOWED_ORIGINS = [
  'https://src-sigma-ecru-25.vercel.app',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

// payment_method → Airtable singleSelect option name (must match existing choices)
const PAY_MAP = {
  cash:    'מזומן',
  kaspi:   'כספי',
  // voucher / combined have no matching option — field left empty
};

// ── Green API — WhatsApp ──────────────────────────────────────────────────────

function toWaId(phone) {
  // Strip everything except digits, ensure international format + @c.us
  const digits = phone.replace(/\D/g, '');
  // Kazakhstan: numbers starting with 8 → replace with 7
  const norm = digits.startsWith('8') && digits.length === 11 ? '7' + digits.slice(1) : digits;
  return norm + '@c.us';
}

async function sendWa(phone, message) {
  const instance = (process.env.GREEN_API_INSTANCE || '').trim();
  const apiToken = (process.env.GREEN_API_TOKEN   || '').trim();
  if (!instance || !apiToken) return; // env not configured — skip silently

  const url = `https://api.green-api.com/waInstance${instance}/sendMessage/${apiToken}`;
  await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chatId: toWaId(phone), message }),
  }).catch(e => console.error('[green-api]', e.message));
}

function formatDelivery(orderDate, deliveryTime) {
  if (!orderDate) return '';
  const days = ['вс','пн','вт','ср','чт','пт','сб'];
  const months = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
  const [y,m,d] = orderDate.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  const label = `${days[dt.getDay()]}, ${d} ${months[m-1]}`;
  return deliveryTime ? `${label} в ${deliveryTime}` : label;
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

function atHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function atPost(path, body, token) {
  const r = await fetch(`${AT_BASE}/${path}?returnFieldsByFieldId=true`, {
    method: 'POST',
    headers: atHeaders(token),
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`Airtable ${r.status}: ${txt.slice(0, 300)}`);
  }
  return r.json();
}

export default async function handler(req, res) {
  // CORS
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

  const token = (process.env.AIRTABLE_TOKEN || '').replace(/^﻿/, '').trim();
  if (!token) return res.status(500).json({ error: 'Server misconfigured' });

  const body = await parseBody(req);
  if (
    !body ||
    !body.customer_name?.trim() ||
    !body.customer_phone?.trim() ||
    !Array.isArray(body.items) ||
    !body.items.length
  ) {
    return res.status(400).json({ error: 'Missing required fields: customer_name, customer_phone, items' });
  }

  try {
    const today = new Date().toISOString().slice(0, 10);

    // ── Order record ─────────────────────────────────────────────────────────
    const orderFields = {
      [FO_CUST_NAME]: body.customer_name.trim(),
      [FO_PHONE]:     body.customer_phone.trim(),
      [FO_DATE_RCV]:  today,
      [FO_PRICE]:     Number(body.total_price) || 0,
      [FO_COUNT]:     body.items.length,
      [FO_STATUS]:    'Ожидает подтверждения менеджера',
    };

    if (body.order_type_title) orderFields[FO_NAME_RU] = body.order_type_title;

    if (body.delivery_address?.trim()) {
      orderFields[FO_ADDRESS]  = body.delivery_address.trim();
      orderFields[FO_DELIVERY] = 'Да';
    } else {
      orderFields[FO_DELIVERY] = 'Нет';
    }

    if (body.notes?.trim()) orderFields[FO_NOTES] = body.notes.trim();

    if (body.payment_method) {
      orderFields[FO_PAYMENT] = PAY_MAP[body.payment_method] || body.payment_method;
    }

    // Delivery date + time → Airtable dateTime (ISO UTC)
    if (body.order_date) {
      const time = body.delivery_time || '12:00';
      // Treat as Almaty local time (UTC+5)
      orderFields[FO_DATE_EXE] = `${body.order_date}T${time}:00.000+05:00`;
    }

    // 1. Create order
    const orderResp = await atPost(T_ORDERS, { fields: orderFields }, token);
    const orderId  = orderResp.id;
    const orderNum = orderResp.fields?.[FO_SERIAL] ?? null;

    // 2. Create qty rows in parallel
    await Promise.all(
      body.items.map(item => {
        const qtyFields = {
          [FQ_ORDER]: [orderId],
          [FQ_QTY]:   Number(item.quantity)  || 0,
          [FQ_PRICE]: Number(item.unit_price) || 0,
        };
        // Link to מאכלים record if dish_id is a valid Airtable record ID
        if (item.dish_id && /^rec[A-Za-z0-9]{14}$/.test(item.dish_id)) {
          qtyFields[FQ_DISH_LNK] = [item.dish_id];
        } else {
          // fallback to free-text for sample/unknown dishes
          qtyFields[FQ_DISH_TXT] = String(item.dish_name || '').trim();
        }
        return atPost(T_QTY, { fields: qtyFields }, token);
      })
    );

    // 3. WhatsApp notifications — fire-and-forget (don't block response)
    const managerPhone = (process.env.MANAGER_PHONE || '').trim();
    const managerToken = (process.env.MANAGER_TOKEN || '').trim();
    const custPhone    = body.customer_phone.trim();
    const custName     = body.customer_name.trim();
    const orderType    = body.order_type_title || body.order_type || '';
    const total        = Number(body.total_price) || 0;
    const delivery     = formatDelivery(body.order_date, body.delivery_time);
    const numStr       = orderNum ? `№${orderNum}` : '';
    const custLang     = body.lang || 'ru';
    const mgrLang      = body.manager_lang || 'he';
    const itemLines    = (body.items || []).map(i => `  • ${i.dish_name} × ${i.quantity}`).join('\n');
    const statusUrl    = orderNum ? `${SITE_URL}/status?num=${orderNum}` : '';

    // ── Customer message (in customer's language) ──
    const CUST_TMPL = {
      ru: { head: `✅ Заказ ${numStr} принят!`,     type: '📋', date: '📅', total: '💰 Итого', status: 'Статус заказа', wait: 'Ожидайте подтверждения.' },
      en: { head: `✅ Order ${numStr} received!`,   type: '📋', date: '📅', total: '💰 Total',  status: 'Order status',  wait: 'Awaiting confirmation.' },
      he: { head: `✅ הזמנה ${numStr} התקבלה!`,    type: '📋', date: '📅', total: '💰 סה"כ',  status: 'סטטוס הזמנה',  wait: 'ממתינים לאישור.' },
    };
    const ct = CUST_TMPL[custLang] || CUST_TMPL.ru;
    const custMsg = [
      ct.head,
      orderType  ? `${ct.type} ${orderType}` : '',
      delivery   ? `${ct.date} ${delivery}`  : '',
      itemLines,
      total      ? `${ct.total}: ${total} ₸` : '',
      statusUrl  ? `\n🔗 ${ct.status}: ${statusUrl}` : '',
      ct.wait,
    ].filter(Boolean).join('\n');

    // ── Manager message (in manager's language) ──
    const MGR_TMPL = {
      he: { head: `🔔 הזמנה חדשה ${numStr}`, client: '👤 לקוח', type: '📋', date: '📅', total: '💰', link: '👉 לאישור' },
      ru: { head: `🔔 Новый заказ ${numStr}`, client: '👤',      type: '📋', date: '📅', total: '💰', link: '👉 Управление' },
    };
    const mt = MGR_TMPL[mgrLang] || MGR_TMPL.he;
    const managerLink = managerToken && orderId
      ? `${SITE_URL}/manager?id=${orderId}&token=${managerToken}`
      : '';
    const mgrMsg = [
      mt.head,
      `${mt.client}: ${custName} · ${custPhone}`,
      orderType ? `${mt.type} ${orderType}` : '',
      delivery  ? `${mt.date} ${delivery}`  : '',
      itemLines,
      total     ? `${mt.total} ${total} ₸`  : '',
      managerLink ? `\n${mt.link}:\n${managerLink}` : '',
    ].filter(Boolean).join('\n');

    Promise.all([
      sendWa(custPhone, custMsg),
      managerPhone ? sendWa(managerPhone, mgrMsg) : Promise.resolve(),
    ]).catch(() => {});

    return res.status(200).json({
      success:      true,
      order_id:     orderId,
      order_number: orderNum,
    });

  } catch (err) {
    console.error('[order api]', err.message);
    return res.status(502).json({ error: 'Failed to save order' });
  }
}
