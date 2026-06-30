/**
 * GET /api/orders-today
 * Query params:
 *   token        — required (MANAGER_TOKEN | CHEF_TOKEN | BAKER_TOKEN | MASHGIACH_TOKEN)
 *   range        — today | tomorrow | week | 0,1 (days offset list, default 0,1)
 *   baker        — 1 = filter to bakery order type + return totals
 *   all_statuses — 1 = no status filter (mashgiach mode)
 *   dish         — text = filter orders that contain this dish name (partial match)
 *   type=kosher  — returns kosher requirements list instead of orders
 */

const BASE    = 'appM61hkcOruhdBuv';
const AT_BASE = `https://api.airtable.com/v0/${BASE}`;

const T_ORDERS = 'tblMnlLwYCD27ou80';
const T_QTY    = 'tblcP1zvc3Tu9oQuL';
const T_DISHES = 'tblhkNaiSGBiLRUxA';
const T_RECIPES = 'tbl053nytobUU4ytc';
const T_KOSHER = 'tbl5CIVzLNulJbbcF';

// Kosher table fields
const FK_ID      = 'fld4gD1NehN308XRw';
const FK_PROD_HE = 'fldGQziVRuxkAI7jS';
const FK_TYPE    = 'fldEBvLhMNYSVs0zF';
const FK_STATUS  = 'fldq0jc1bDSvgYtkP';
const FK_DESC_HE = 'fldWbBdR0TgtKadtP';
const FK_DESC_RU = 'flduUzEQ4ApyEwrVn';
const FK_NOTES   = 'fld7mdifBqyjnKCll';

const FO_STATUS   = 'fldcekWvpJwdVVMK6';
const FO_SERIAL   = 'fldlJLSKuSB5zvmGt';
const FO_CUST     = 'fld1FKztthSOvgJhJ';
const FO_DATE_EXE = 'fldF8G3nQ7FU7GAqS';
const FO_NAME_RU  = 'flddCvqJiwEsg9pr1';
const FO_QTY_LINK = 'fldcWbQXZM8Agv6ir';
const FO_NOTES    = 'fldKGooL6E0PkqKfI';
const FO_KITCHEN_NOTES = 'fldQqZkF3rUgXrvvD';
const FO_NOTES_INT     = 'flddO88Cmj7qZ5xDU'; // הערות פנימי
const FO_PHONE    = 'fldMPQfkQATfg6j0t';
const FO_EVENT_TYPE = 'fldJgHup8TWwCtZXe';
const FO_PEOPLE   = 'fldkOkfJcr3KoQdEy';
const FO_DELIVERY_TYPE   = 'fldH9aXNoJSABpTJP'; // משלוח (singleSelect)
const FO_DELIVERY_METHOD = 'fldLNDBxakM60KfJ4'; // אופן קבלת ההזמנה (איסוף עצמי / לקוח מזמין / לבקש מהמטבח)
const FO_DELIVERY_ADDR   = 'fld2j0eu6qrid1DXA'; // כתובת למשלוח
const FO_DELIVERY_STATUS = 'fldvAUsFNkaRHYQ8q'; // סטטוס משלוח
const FO_PAYMENT_METHOD  = 'fldjE5esZVBwDjNDi'; // צורת תשלום
const FO_PRICE           = 'fldJA6xBGacdetQjI'; // מחיר (number)
const FO_TOTAL           = 'fldGnFezjuay28sDG'; // מחיר כולל משלוח (formula)

const FQ_DISH = 'fldYKuxwzyR0zsA6W';
const FQ_TXT  = 'fldermtin9p2JInVx';
const FQ_QTY  = 'fldZI30djxv54dm8j';

const FD_NAME     = 'fld8ia1Q9b1WoZhE7';
const FD_CATEGORY = 'fldQHBaXkahg5Bcq7'; // קטגוריה (from מתכון)
const FD_PORTION  = 'fldXNADlCSPdnowbQ'; // גרמים/מ"ל למנה

// Field NAMES for use in filterByFormula (Airtable requires names, not IDs, in formulas)
const FN_STATUS   = 'סטטוס הזמנה';
const FN_DATE_EXE = 'תאריך ושעת ביצוע ההזמנה';

const ACTIVE_STATUSES = ['Подтверждён', 'Готов', 'Ожидает подтверждения менеджера', 'Ожидает подтверждения клиента', 'В обработке'];

function atHeaders(t) {
  return { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' };
}

function getRole(reqToken) {
  const clean = t => (t || '').replace(/^﻿/, '').trim();
  if (reqToken === clean(process.env.MANAGER_TOKEN))   return 'manager';
  if (reqToken === clean(process.env.CHEF_TOKEN))      return 'chef';
  if (reqToken === clean(process.env.BAKER_TOKEN))     return 'baker';
  if (reqToken === clean(process.env.MASHGIACH_TOKEN)) return 'mashgiach';
  return null;
}

function isoDay(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function buildFormula(dateFilter, allStatuses) {
  const statusPart = allStatuses
    ? ''
    : `OR(${ACTIVE_STATUSES.map(s => `{${FN_STATUS}}='${s}'`).join(',')})`;
  return statusPart ? `AND(${statusPart},${dateFilter})` : dateFilter;
}

async function fetchOrdersRange(startISO, endISO, token, allStatuses) {
  const dateFilter = `AND(DATESTR({${FN_DATE_EXE}})>='${startISO}',DATESTR({${FN_DATE_EXE}})<='${endISO}')`;
  const formula = buildFormula(dateFilter, allStatuses);
  const fields = [FO_STATUS, FO_SERIAL, FO_CUST, FO_DATE_EXE, FO_NAME_RU, FO_QTY_LINK,
                  FO_NOTES, FO_KITCHEN_NOTES, FO_NOTES_INT, FO_PHONE, FO_EVENT_TYPE, FO_PEOPLE,
                  FO_DELIVERY_TYPE, FO_DELIVERY_METHOD, FO_DELIVERY_ADDR, FO_DELIVERY_STATUS, FO_PAYMENT_METHOD,
                  FO_PRICE, FO_TOTAL];
  const qs = `filterByFormula=${encodeURIComponent(formula)}&${fields.map(f=>`fields[]=${f}`).join('&')}&returnFieldsByFieldId=true&sort[0][field]=${FO_DATE_EXE}&sort[0][direction]=asc`;
  const r = await fetch(`${AT_BASE}/${T_ORDERS}?${qs}`, { headers: atHeaders(token) });
  if (!r.ok) throw new Error(`Airtable orders ${r.status}`);
  const data = await r.json();
  return data.records || [];
}

async function fetchItems(qtyIds, token) {
  if (!qtyIds?.length) return [];
  const settled = await Promise.all(
    qtyIds.map(id =>
      fetch(`${AT_BASE}/${T_QTY}/${id}?returnFieldsByFieldId=true`, { headers: atHeaders(token) })
        .then(r => r.ok ? r.json() : null).catch(() => null)
    )
  );
  const rows = settled.filter(Boolean);
  if (!rows.length) return [];

  const dishIds = [...new Set(rows.flatMap(r => r.fields[FQ_DISH] || []))];
  const dishMap = {};
  if (dishIds.length) {
    const formula = `OR(${dishIds.map(id => `RECORD_ID()="${id}"`).join(',')})`;
    const qs = `filterByFormula=${encodeURIComponent(formula)}&fields[]=${FD_NAME}&fields[]=${FD_CATEGORY}&fields[]=${FD_PORTION}&returnFieldsByFieldId=true`;
    const r = await fetch(`${AT_BASE}/${T_DISHES}?${qs}`, { headers: atHeaders(token) });
    if (r.ok) {
      const d = await r.json();
      for (const rec of (d.records || [])) {
        dishMap[rec.id] = {
          name:     rec.fields[FD_NAME] || '',
          category: typeof rec.fields[FD_CATEGORY] === 'object' ? rec.fields[FD_CATEGORY]?.name : (rec.fields[FD_CATEGORY] || ''),
          portion:  rec.fields[FD_PORTION] || 0,
        };
      }
    }
  }

  return rows.map(row => ({
    name:     dishMap[row.fields[FQ_DISH]?.[0]]?.name || row.fields[FQ_TXT] || '—',
    category: dishMap[row.fields[FQ_DISH]?.[0]]?.category || '',
    quantity: row.fields[FQ_QTY] || 0,
    portion:  dishMap[row.fields[FQ_DISH]?.[0]]?.portion || 0,
  })).filter(i => i.quantity > 0);
}

// ── Kosher requirements handler ──────────────────────────────────────────────
async function fetchKosherRequirements(airtableToken) {
  const fields = [FK_ID, FK_PROD_HE, FK_TYPE, FK_STATUS, FK_DESC_HE, FK_DESC_RU, FK_NOTES];
  const qs = `${fields.map(f=>`fields[]=${f}`).join('&')}&returnFieldsByFieldId=true&sort[0][field]=${FK_ID}`;
  const r = await fetch(`${AT_BASE}/${T_KOSHER}?${qs}`, { headers: atHeaders(airtableToken) });
  if (!r.ok) throw new Error(`Airtable kosher ${r.status}`);
  const data = await r.json();
  return (data.records || []).map(rec => {
    const f = rec.fields;
    const nameLkp = f[FK_PROD_HE];
    return {
      id:      rec.id,
      serial:  f[FK_ID]    || null,
      product: Array.isArray(nameLkp) ? nameLkp[0] : (typeof nameLkp === 'string' ? nameLkp : ''),
      type:    typeof f[FK_TYPE]   === 'object' ? f[FK_TYPE].name   : (f[FK_TYPE]   || ''),
      status:  typeof f[FK_STATUS] === 'object' ? f[FK_STATUS].name : (f[FK_STATUS] || ''),
      desc_he: f[FK_DESC_HE] || '',
      desc_ru: f[FK_DESC_RU] || '',
      notes:   f[FK_NOTES]   || '',
    };
  });
}

// ── WhatsApp helper (same pattern as manager-action) ─────────────────────────
function toWaId(phone) {
  const digits = phone.replace(/\D/g, '');
  const norm = digits.startsWith('8') && digits.length === 11 ? '7' + digits.slice(1) : digits;
  return norm + '@c.us';
}
async function sendWaMsg(chatId, message) {
  const instance = (process.env.GREEN_API_INSTANCE || '').trim();
  const apiToken = (process.env.GREEN_API_TOKEN    || '').trim();
  if (!instance || !apiToken) throw new Error('GREEN_API not configured');
  const r = await fetch(`https://api.green-api.com/waInstance${instance}/sendMessage/${apiToken}`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ chatId, message }),
  });
  if (!r.ok) throw new Error(`GREEN_API ${r.status}`);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const airtableToken = (process.env.AIRTABLE_TOKEN || '').replace(/^﻿/, '').trim();
  const reqToken      = (req.query.token || '').trim();
  const role          = getRole(reqToken);

  if (!role)            return res.status(403).json({ error: 'Forbidden' });

  // POST /api/orders-today?action=notify_kitchen — send WA to chef/kitchen group
  if (req.method === 'POST' && req.query.action === 'notify_kitchen') {
    if (!['manager','chef'].includes(role)) return res.status(403).json({ error: 'Forbidden' });
    const { message, to = 'personal' } = req.body || {};
    if (!message?.trim()) return res.status(400).json({ error: 'message required' });
    const chefPhone = (process.env.CHEF_PHONE       || '').trim();
    const groupId   = (process.env.KITCHEN_GROUP_ID || '').trim();
    const chatId    = to === 'group' && groupId ? groupId : (chefPhone ? toWaId(chefPhone) : null);
    if (!chatId) return res.status(500).json({ error: 'No kitchen contact configured' });
    try { await sendWaMsg(chatId, message); return res.status(200).json({ ok: true }); }
    catch(err) { return res.status(502).json({ error: err.message }); }
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // GET ?type=kosher — return kosher requirements
  if (req.query.type === 'kosher') {
    if (!airtableToken) return res.status(500).json({ error: 'Server misconfigured' });
    try {
      const requirements = await fetchKosherRequirements(airtableToken);
      res.setHeader('Cache-Control','public,max-age=600');
      return res.status(200).json({ requirements });
    } catch(err) { return res.status(502).json({ error: err.message }); }
  }
  if (!airtableToken)   return res.status(500).json({ error: 'Server misconfigured' });

  const bakerMode   = req.query.baker       === '1';
  const allStatuses = req.query.all_statuses === '1' || role === 'mashgiach';
  const dishFilter  = (req.query.dish || '').toLowerCase();

  // Determine date range
  let startISO, endISO;
  const range = req.query.range;
  if (range === 'week') {
    startISO = isoDay(0);
    endISO   = isoDay(6);
  } else if (range === 'today') {
    startISO = endISO = isoDay(0);
  } else if (range === 'tomorrow') {
    startISO = endISO = isoDay(1);
  } else if (range === 'month') {
    const now = new Date();
    startISO = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    endISO   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  } else if (range === 'this_week') {
    const now = new Date();
    const day = now.getDay(); // 0=Sun
    const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    startISO = mon.toISOString().slice(0, 10);
    endISO   = sun.toISOString().slice(0, 10);
  } else if (req.query.start && req.query.end) {
    startISO = req.query.start;
    endISO   = req.query.end;
  } else {
    // Legacy days param: "0,1" or "0" etc.
    const daysParam = (req.query.days || range || '0,1').split(',').map(Number).filter(n => !isNaN(n));
    const sorted = [...new Set(daysParam)].sort((a, b) => a - b);
    startISO = isoDay(sorted[0] ?? 0);
    endISO   = isoDay(sorted[sorted.length - 1] ?? 0);
  }

  try {
    const allRecords = await fetchOrdersRange(startISO, endISO, airtableToken, allStatuses);

    const withItems = await Promise.all(
      allRecords.map(async rec => {
        const f        = rec.fields;
        const items    = await fetchItems(f[FO_QTY_LINK] || [], airtableToken);
        const typeRaw  = f[FO_NAME_RU] || '';
        const typeName = typeof typeRaw === 'object' ? (typeRaw.name || '') : typeRaw;
        const status   = typeof f[FO_STATUS] === 'object' ? f[FO_STATUS].name : (f[FO_STATUS] || '');
        const evType   = typeof f[FO_EVENT_TYPE] === 'object' ? f[FO_EVENT_TYPE].name : (f[FO_EVENT_TYPE] || '');
        return {
          id:           rec.id,
          order_number: f[FO_SERIAL]    || null,
          customer:     f[FO_CUST]      || '',
          phone:        f[FO_PHONE]     || '',
          status,
          delivery_at:  f[FO_DATE_EXE]  || null,
          order_type:   typeName,
          event_type:   evType,
          people:       f[FO_PEOPLE]    || null,
          notes:           f[FO_NOTES]          || '',
          kitchen_notes:   f[FO_KITCHEN_NOTES]  || '',
          notes_internal:  f[FO_NOTES_INT]      || '',
          delivery_type:   typeof f[FO_DELIVERY_TYPE]   === 'object' ? f[FO_DELIVERY_TYPE].name   : (f[FO_DELIVERY_TYPE]   || ''),
          delivery_method: typeof f[FO_DELIVERY_METHOD] === 'object' ? f[FO_DELIVERY_METHOD].name : (f[FO_DELIVERY_METHOD] || ''),
          delivery_addr:   f[FO_DELIVERY_ADDR]  || '',
          delivery_status: typeof f[FO_DELIVERY_STATUS] === 'object' ? f[FO_DELIVERY_STATUS].name : (f[FO_DELIVERY_STATUS] || ''),
          payment_method:  typeof f[FO_PAYMENT_METHOD]  === 'object' ? f[FO_PAYMENT_METHOD].name  : (f[FO_PAYMENT_METHOD]  || ''),
          price:           f[FO_PRICE]          || 0,
          total:           f[FO_TOTAL]          || 0,
          items,
        };
      })
    );

    let orders = withItems;

    // Baker filter
    if (bakerMode) {
      orders = orders.filter(o => /מאפים|выпечка|bak/i.test(o.order_type));
      const totals = {};
      for (const o of orders) for (const item of o.items)
        totals[item.name] = (totals[item.name] || 0) + item.quantity;
      return res.status(200).json({ orders, totals, role });
    }

    // Dish filter
    if (dishFilter) {
      orders = orders.filter(o => o.items.some(i => i.name.toLowerCase().includes(dishFilter)));
    }

    // Group by order_type for chef view
    const groups = {};
    for (const o of orders) {
      const key = o.order_type || 'Прочее';
      if (!groups[key]) groups[key] = [];
      groups[key].push(o);
    }

    // Dish aggregation (totals per dish across all orders)
    const dishTotals = {};
    for (const o of orders) {
      for (const item of o.items) {
        if (!dishTotals[item.name]) dishTotals[item.name] = { name: item.name, category: item.category, total: 0, orders: [] };
        dishTotals[item.name].total += item.quantity;
        dishTotals[item.name].orders.push({ order_number: o.order_number, qty: item.quantity });
      }
    }
    const dishList = Object.values(dishTotals).sort((a, b) => b.total - a.total);

    return res.status(200).json({ groups, orders, dishList, role });
  } catch (err) {
    console.error('[orders-today]', err.message);
    return res.status(502).json({ error: 'Failed to fetch orders', detail: err.message });
  }
}
