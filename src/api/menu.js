/**
 * GET /api/menu?type=צהריים
 * Secure proxy: Airtable token lives only here, never in the browser.
 * type must be one of ALLOWED_TYPES — anything else returns 400.
 */

import { listRecords, getRecord } from '../lib/db.js';

// Tables
const T_DISHES = 'tblhkNaiSGBiLRUxA';
const T_SLOTS  = 'tblJ7a7d5HfORkMu4'; // סוגי הזמנות
const T_TPLS   = 'tbl0T5TTLqDr0uCGR'; // תבניות
const T_PRICES = 'tblMe5ZQp6Ygfca5W'; // אבלת מחירי מאכלים

// Fields — dishes (מאכלים)
const FD_NAME      = 'fld8ia1Q9b1WoZhE7'; // שם ברוסית
const FD_NAME_HE   = 'fldmvvvqFpYOq00XK'; // שם בעברית (aiText — may be empty)
const FD_NAME_EN   = 'fldKQECFtMyvmw7Mc'; // שם באנגלית (singleLineText)
const FD_PORTION   = 'fldXNADlCSPdnowbQ'; // משקל או נפח למנה (גרמים/מ"ל)
const FD_TYPES     = 'flddm1dEMqIXBfieF'; // סוגי הזמנות (multipleSelects)
const FD_MINQTY    = 'fldnDpI70fL8sRXKF'; // min_qty_per_order
const FD_STATUS    = 'fldnxpBolUFbfUxNX'; // סטטוס
const FD_PRC_LINK  = 'fldosw1NlPlqWbcWI'; // link → T_PRICES (price record IDs per dish)
const FD_CATEGORY  = 'fldQHBaXkahg5Bcq7'; // קטגוריה (from מתכון) — lookup singleSelect, returns array

// Fields — prices (אבלת מחירי מאכלים)
// NOTE: FP_DISH links to the recipes/BOM table, NOT to מאכלים — do not filter by dish ID
const FP_PRICE   = 'fldiDyytpcE9CZlc0'; // Цена, תג.
const FP_TYPE    = 'fldxQeaawfV911vMK'; // סוג הזמנה (singleSelect)
// status values: "Действующая цена" = active — not used in filter (we select by record ID)

// Fields — slots (סוגי הזמנות)
const FS_TYPE   = 'flddj8yoiko7U4MWf'; // סוג
const FS_STATUS = 'fldYgc5Vz5ZrFGHop'; // סטטוס
const FS_DATE   = 'fldS3NWmxIaqyUm6g'; // תאריך
const FS_TIME   = 'fldFQ7zyY15817hef'; // שעת_הגשה (dateTime)
const FS_TPL    = 'fldmCacFFUVxp8CTz'; // תבנית (link)

// Fields — templates (תבניות)
const FT_DISHES = 'fldTkRa6caF2yl7YG'; // מנות (link → מאכלים)
const FT_STATUS = 'fldD1XfdS3z9IeHqw'; // סטטוס

const ALLOWED_TYPES  = ['בוקר','צהריים','ערב','שבת','חג','טיול','מיוחד','מאפים','מוצרים מוכנים'];
const DAILY_TYPES    = new Set(['צהריים','ערב','שבת','חג']);

// ── Only our own Vercel domain + local dev may call this ─────────────────────
const ALLOWED_ORIGINS = [
  'https://src-sigma-ecru-25.vercel.app',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

// ── helpers ───────────────────────────────────────────────────────────────────

function extractAiText(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') return raw || null;
  // aiText field: { state: 'generated'|'loading'|'error', value: string|null }
  return (raw.state === 'generated' && raw.value) ? raw.value : null;
}

function extractLookupFirst(raw) {
  if (!raw) return '';
  if (Array.isArray(raw)) return raw[0] || '';
  return raw;
}

function formatDish(rec, priceMap) {
  const price  = priceMap?.[rec.id] ?? 0;
  return {
    id:       rec.id,
    name:     rec.fields[FD_NAME]    || '',
    name_he:  extractAiText(rec.fields[FD_NAME_HE]),
    name_en:  extractAiText(rec.fields[FD_NAME_EN]),
    price:    Number(price)          || 0,
    portion:  rec.fields[FD_PORTION] || 0,
    min_qty:  rec.fields[FD_MINQTY]  || 0,
    category: extractLookupFirst(rec.fields[FD_CATEGORY]),
  };
}

/**
 * Fetch prices from T_PRICES for a list of dish records.
 * dishPriceLinks: array of { dishId, priceRecIds: string[] }
 * Returns map { dishId → price } using type-specific price with default fallback.
 *
 * NOTE: FP_DISH in T_PRICES links to the BOM/recipes table, NOT to מאכלים.
 * We therefore select price rows directly by record ID (from FD_PRC_LINK on each dish).
 */
async function fetchPrices(dishPriceLinks, orderType) {
  // Collect all price record IDs
  const allPriceIds = [...new Set(dishPriceLinks.flatMap(d => d.priceRecIds))];
  if (!allPriceIds.length) return {};

  // Fetch price rows by record ID via OR filter
  const formula = `OR(${allPriceIds.map(id => `RECORD_ID()="${id}"`).join(',')})`;
  const rows = await listRecords(T_PRICES, {
    filterByFormula: formula,
    fields: [FP_PRICE, FP_TYPE],
  });

  // Map priceRecId → { price, type }
  const priceById = {};
  for (const row of rows) {
    priceById[row.id] = {
      price:   Number(row.fields[FP_PRICE]) || 0,
      rowType: row.fields[FP_TYPE] || null,
    };
  }

  // Resolve per dish: prefer type-specific, fallback to default (no type set)
  const result = {};
  for (const { dishId, priceRecIds } of dishPriceLinks) {
    let specific = null, fallback = null;
    for (const recId of priceRecIds) {
      const p = priceById[recId];
      if (!p) continue;
      if (p.rowType === orderType) specific = p.price;
      else if (!p.rowType)         fallback  = p.price;
    }
    result[dishId] = specific ?? fallback ?? 0;
  }
  return result;
}

// ── static menu (בוקר, טיול, מיוחד, מאפים, מוצרים מוכנים) ──────────────────

async function fetchStaticMenu(type) {
  const formula = `FIND(${JSON.stringify(type)}, ARRAYJOIN({${FD_TYPES}}, ","))`;

  const records = await listRecords(T_DISHES, {
    filterByFormula: formula,
    fields: [FD_NAME, FD_NAME_HE, FD_NAME_EN, FD_PORTION, FD_MINQTY, FD_PRC_LINK, FD_CATEGORY],
  });

  const dishPriceLinks = records.map(r => ({
    dishId:      r.id,
    priceRecIds: (r.fields[FD_PRC_LINK] || []),
  }));
  const priceMap = await fetchPrices(dishPriceLinks, type);

  return records.map(r => formatDish(r, priceMap));
}

// ── daily menu (צהריים, ערב, שבת, חג) ────────────────────────────────────────

async function fetchDailyMenu(type) {
  const today = new Date().toISOString().slice(0, 10);

  const formula = `AND({${FS_TYPE}}=${JSON.stringify(type)},{${FS_STATUS}}="פתוח להזמנה",NOT(IS_BEFORE({${FS_DATE}},"${today}")))`;

  const slots = await listRecords(T_SLOTS, {
    filterByFormula: formula,
    fields: [FS_DATE, FS_TIME, FS_TPL],
    sort: [{ field: FS_DATE, direction: 'asc' }],
  });

  if (!slots.length) return [];

  // 2. Collect unique template IDs
  const tplIds = [...new Set(
    slots.flatMap(s => (s.fields[FS_TPL] || []))
  )];

  // 3. Fetch each template to get its dish IDs (parallel)
  const tplRecords = await Promise.all(
    tplIds.map(id => getRecord(T_TPLS, id).catch(() => null))
  );
  const tplDishMap = {}; // tplId → dishIds[]
  for (const rec of tplRecords) {
    if (rec) tplDishMap[rec.id] = rec.fields[FT_DISHES] || [];
  }

  // 4. Collect unique dish IDs across all templates
  const dishIds = [...new Set(Object.values(tplDishMap).flat())];
  if (!dishIds.length) return [];

  // 5. Fetch all dishes in one call using OR formula
  const dishFormula = `OR(${dishIds.map(id => `RECORD_ID()="${id}"`).join(',')})`;
  const dishRecords = await listRecords(T_DISHES, {
    filterByFormula: dishFormula,
    fields: [FD_NAME, FD_NAME_HE, FD_NAME_EN, FD_PORTION, FD_MINQTY, FD_PRC_LINK, FD_CATEGORY],
  });
  const dishPriceLinks = dishRecords.map(r => ({
    dishId:      r.id,
    priceRecIds: (r.fields[FD_PRC_LINK] || []),
  }));
  const priceMap = await fetchPrices(dishPriceLinks, type);
  const dishMap  = Object.fromEntries(dishRecords.map(r => [r.id, formatDish(r, priceMap)]));

  // 6. Build output: one entry per slot date
  return slots.map(slot => {
    const date    = slot.fields[FS_DATE];
    const tplId   = (slot.fields[FS_TPL] || [])[0] || null;
    const dishIds = tplId ? (tplDishMap[tplId] || []) : [];
    // Extract HH:MM from dateTime field (stored as ISO, may be UTC)
    const rawTime = slot.fields[FS_TIME];
    const slotTime = rawTime
      ? new Date(rawTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Almaty' })
      : null;
    return {
      slot_id: slot.id,
      date,
      time: slotTime,
      template: tplId,
      dishes: dishIds.map(id => dishMap[id]).filter(Boolean),
    };
  });
}

// ── main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // CORS — lock to our domain only
  const origin = req.headers['origin'] || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // same-origin or server-side: allow
  } else {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' });

  const type = (req.query.type || '').trim();
  if (!ALLOWED_TYPES.includes(type)) {
    return res.status(400).json({ error: 'Invalid type', allowed: ALLOWED_TYPES });
  }

  try {
    const data = DAILY_TYPES.has(type)
      ? await fetchDailyMenu(type)
      : await fetchStaticMenu(type);

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(200).json(data);
  } catch (err) {
    console.error('[menu api]', err.message, err.stack);
    return res.status(502).json({ error: 'Failed to fetch menu' });
  }
}
