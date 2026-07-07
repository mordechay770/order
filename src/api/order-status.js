/**
 * GET /api/order-status?num=123  — customer status page
 * GET /api/order-status?id=recXXX — manager page (includes items + phone)
 */

import { getRecord, listRecords } from '../lib/db.js';

// Orders table
const T_ORDERS    = 'tblMnlLwYCD27ou80';
const FO_SERIAL   = 'fldlJLSKuSB5zvmGt';
const FO_STATUS   = 'fldcekWvpJwdVVMK6';
const FO_NAME_RU  = 'flddCvqJiwEsg9pr1';
const FO_DATE_EXE = 'fldF8G3nQ7FU7GAqS';
const FO_CUST_NAME= 'fld1FKztthSOvgJhJ';
const FO_PHONE    = 'fldMPQfkQATfg6j0t';
const FO_PRICE    = 'fldJA6xBGacdetQjI';
const FO_COUNT    = 'fldBrAoMYSoO8f2ug';
const FO_NOTES    = 'fldKGooL6E0PkqKfI';
const FO_ADDRESS  = 'fld2j0eu6qrid1DXA';
const FO_PAYMENT  = 'fldjE5esZVBwDjNDi';

// Quantities table (order items)
const T_QTY     = 'tblcP1zvc3Tu9oQuL';
const FQ_DISH   = 'fldYKuxwzyR0zsA6W'; // link → מאכלים
const FQ_TXT    = 'fldermtin9p2JInVx'; // dish name (text fallback)
const FQ_QTY    = 'fldZI30djxv54dm8j'; // quantity
const FQ_PRICE  = 'fld2hjBAMbg4NeRef'; // unit price

// Backlink on orders → כמויות record IDs
const FO_QTY_LINK = 'fldcWbQXZM8Agv6ir';

// Dishes table
const T_DISHES  = 'tblhkNaiSGBiLRUxA';
const FD_NAME   = 'fld8ia1Q9b1WoZhE7'; // Russian name
const FD_PORTION= 'fldXNADlCSPdnowbQ'; // portion size (grams)

const ALLOWED_ORIGINS = [
  'https://src-sigma-ecru-25.vercel.app',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

function extractSelect(val) {
  if (!val) return '';
  return (typeof val === 'object') ? (val.name || '') : val;
}

async function fetchItems(qtyIds) {
  if (!qtyIds || !qtyIds.length) return [];

  const settled = await Promise.all(
    qtyIds.map(id => getRecord(T_QTY, id).catch(() => null))
  );
  const rows = settled.filter(Boolean);
  if (!rows.length) return [];

  const dishIds = [...new Set(rows.flatMap(r => (r.fields[FQ_DISH] || [])))];

  const dishMap = {};
  if (dishIds.length) {
    const formula2 = `OR(${dishIds.map(id => `RECORD_ID()="${id}"`).join(',')})`;
    const dishRecs = await listRecords(T_DISHES, {
      filterByFormula: formula2,
      fields: [FD_NAME, FD_PORTION],
    }).catch(() => []);
    for (const rec of dishRecs) {
      dishMap[rec.id] = {
        name:    rec.fields[FD_NAME]    || '',
        portion: rec.fields[FD_PORTION] || 0,
      };
    }
  }

  // 4. Build items array
  return rows.map((row, i) => {
    const linkedIds = row.fields[FQ_DISH] || [];
    const dishId    = linkedIds[0] || null;
    const dish      = dishId ? dishMap[dishId] : null;
    return {
      num:        i + 1,
      dish_id:    dishId,
      name:       dish?.name || row.fields[FQ_TXT] || '—',
      portion:    dish?.portion || 0,
      quantity:   row.fields[FQ_QTY]   || 0,
      unit_price: row.fields[FQ_PRICE] || 0,
      total:      (row.fields[FQ_QTY] || 0) * (row.fields[FQ_PRICE] || 0),
    };
  });
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

  const byId  = req.query.id;
  const byNum = parseInt(req.query.num, 10);
  const withItems = req.query.items === '1' || !!byId; // always fetch items for manager

  if (!byId && (!byNum || byNum < 1)) return res.status(400).json({ error: 'Provide id or num' });

  try {
    let rec;

    if (byId && /^rec[A-Za-z0-9]{14}$/.test(byId)) {
      rec = await getRecord(T_ORDERS, byId).catch(e => {
        if (e.message?.includes('404')) return null;
        throw e;
      });
      if (!rec) return res.status(404).json({ error: 'Order not found' });
    } else {
      const formula = `{${FO_SERIAL}}=${byNum}`;
      const recs = await listRecords(T_ORDERS, {
        filterByFormula: formula,
        fields: [FO_SERIAL, FO_STATUS, FO_NAME_RU, FO_DATE_EXE, FO_CUST_NAME, FO_PHONE, FO_PRICE, FO_COUNT, FO_NOTES, FO_ADDRESS, FO_PAYMENT],
      });
      rec = recs[0];
      if (!rec) return res.status(404).json({ error: 'Order not found' });
    }

    const f = rec.fields || {};
    const status = extractSelect(f[FO_STATUS]);

    const base = {
      order_id:     rec.id,
      order_number: f[FO_SERIAL]    ?? byNum ?? null,
      status,
      order_type:   f[FO_NAME_RU]   || '',
      delivery_at:  f[FO_DATE_EXE]  || null,
      customer:     f[FO_CUST_NAME] || '',
      phone:        f[FO_PHONE]     || '',
      total:        f[FO_PRICE]     || 0,
      item_count:   f[FO_COUNT]     || 0,
      notes:        f[FO_NOTES]     || '',
      address:      f[FO_ADDRESS]   || '',
      payment:      extractSelect(f[FO_PAYMENT]) || '',
    };

    if (withItems) {
      const qtyIds = f[FO_QTY_LINK] || [];
      base.items = await fetchItems(qtyIds);
    }

    return res.status(200).json(base);
  } catch (err) {
    console.error('[order-status]', err.message);
    return res.status(502).json({ error: 'Failed to fetch order', detail: err.message });
  }
}
