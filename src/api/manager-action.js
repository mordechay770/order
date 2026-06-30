/**
 * GET /api/manager-action?id=recXXX&action=approve|reject|ready&token=SECRET
 * Updates order status in Airtable. Designed to be called from a link in WhatsApp.
 * Returns HTML page (so manager sees confirmation in browser).
 */

const BASE    = 'appM61hkcOruhdBuv';
const AT_BASE = `https://api.airtable.com/v0/${BASE}`;

const T_ORDERS   = 'tblMnlLwYCD27ou80';
const T_PAYMENTS = 'tblaNK6mYqr20YtT1';
const T_QTY      = 'tblcP1zvc3Tu9oQuL';
const FQ_ORDER   = 'fld4DlEIkuKYTJIwr';
const FQ_DISH_LK = 'fldYKuxwzyR0zsA6W';
const FQ_TXT     = 'fldermtin9p2JInVx';
const FQ_QTY     = 'fldZI30djxv54dm8j';

const FO_STATUS    = 'fldcekWvpJwdVVMK6';
const FO_SERIAL    = 'fldlJLSKuSB5zvmGt';
const FO_NAME_RU   = 'flddCvqJiwEsg9pr1';
const FO_CUST_NAME = 'fld1FKztthSOvgJhJ';
const FO_PHONE     = 'fldMPQfkQATfg6j0t';
const FO_DATE_EXE  = 'fldF8G3nQ7FU7GAqS';
const FO_PRICE     = 'fldJA6xBGacdetQjI';
const FO_PAYMENT   = 'fldjE5esZVBwDjNDi';
const FO_KASPI_URL = 'fldMmQtQsDSM5muX4'; // קישור לכספי פיי לתשלום (formula)

// Payments table fields
const T_PAY_METHODS = 'tbl2psZY9uuNiXIUi'; // Способ оплаты
const T_CONTACTS    = 'tbl9KpBHdGSzhNf0E';

const FP_ORDER        = 'fldG5Hooz07INgFB1';
const FP_DATE         = 'fldW2CuSoBsTFqV5E';
const FP_KZT          = 'fld8ZPOiTjoSyjzaa';
const FP_STATUS       = 'fldETI893nLw717mj';
const FP_NOTES        = 'fldNvdvqVWt0Go6Ze';
const FP_METHOD_LINK  = 'fldoLjhJ0WnmV7Orc'; // link to payment method
const FP_METHOD_LKP   = 'fldW3SusWnIShLbeM'; // lookup name from method
const FP_FOREIGN_CHK  = 'fldrbKz3JHBuiARSA'; // checkbox
const FP_FOREIGN_AMT  = 'fldoGe8BXCT0VITUQ'; // amount in foreign currency
const FP_CURRENCY     = 'fldp3mSTxtqDH9FSh'; // singleSelect USD/ILS/EUR/RUB
const FP_RATE         = 'fldrFvqePRaNt6TKq'; // exchange rate
const FP_TOTAL_KZT    = 'fldDYkKx0PpIOlue7'; // formula: total in tenge (read-only)
const FPO_ORDER_LINK  = 'fldItGcZY4SOhSCPz'; // link payments→order in orders table

const FM_NAME   = 'fld3jk2jb20YpwsB4'; // name field in payment methods table
const FC_PHONE  = 'fldwpjfjihVux2f9W';
const FC_LNAME  = 'fldijzThKYRMNfUzI';
const FC_FNAME  = 'fldHywAgv4fP7soEX';

const SITE_URL = 'https://src-sigma-ecru-25.vercel.app';

const STATUS_MAP = {
  approve:  'Подтверждён',
  reject:   'Отменён',
  ready:    'Готов',
  deliver:  'Нмсрм', // marks delivery_status only (not order status)
  // kaspi_paid is handled separately — does not update order status
};

function atHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function toWaId(phone) {
  // Already a Green API chat ID (personal @c.us or group @g.us) — pass through unchanged
  if (phone.includes('@')) return phone;
  const digits = phone.replace(/\D/g, '');
  const norm = digits.startsWith('8') && digits.length === 11 ? '7' + digits.slice(1) : digits;
  return norm + '@c.us';
}

/** Manager notification target: WhatsApp group if configured, else the personal manager number */
function managerTarget() {
  const groupId = (process.env.MANAGER_GROUP_ID || '').trim();
  return groupId || (process.env.MANAGER_PHONE || '').trim();
}

async function sendWa(phone, message) {
  const instance = (process.env.GREEN_API_INSTANCE || '').trim();
  const apiToken = (process.env.GREEN_API_TOKEN   || '').trim();
  if (!instance || !apiToken || !phone) return;
  const url = `https://api.green-api.com/waInstance${instance}/sendMessage/${apiToken}`;
  await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chatId: toWaId(phone), message }),
  }).catch(e => console.error('[green-api manager-action]', e.message));
}

async function sendWaButtons(phone, opts) {
  const instance = (process.env.GREEN_API_INSTANCE || '').trim();
  const apiToken = (process.env.GREEN_API_TOKEN   || '').trim();
  if (!instance || !apiToken || !phone) return;
  const { header, body, footer, buttons = [] } = opts;
  const payload = { chatId: toWaId(phone), body, buttons };
  if (header) payload.header = header;
  if (footer) payload.footer = footer;
  const endpoint = `https://api.green-api.com/waInstance${instance}/sendInteractiveButtons/${apiToken}`;
  try {
    const r = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok && data.idMessage) return;
    console.error('[green-api-buttons manager]', r.status, JSON.stringify(data).slice(0, 150));
    // Fallback to plain text
    const urlLines = buttons.filter(b => b.type === 'url').map(b => `🔗 ${b.buttonText}:\n${b.url}`).join('\n');
    await sendWa(phone, [header, body, footer, urlLines].filter(Boolean).join('\n'));
  } catch (e) {
    console.error('[green-api-buttons manager]', e.message);
    await sendWa(phone, [header, body].filter(Boolean).join('\n'));
  }
}

function htmlPage(title, body, color = '#22c55e') {
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:system-ui,sans-serif;background:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:16px}
  .card{background:#1e293b;border-radius:20px;padding:32px 24px;max-width:440px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,.4);text-align:center}
  .icon{font-size:52px;margin-bottom:12px}
  h1{margin:0 0 6px;font-size:22px;color:#f1f5f9;font-weight:700}
  p{color:#94a3b8;margin:0 0 8px;font-size:15px;line-height:1.5}
  .badge{display:inline-block;padding:6px 16px;border-radius:99px;font-size:13px;font-weight:700;background:${color}30;color:${color};margin:8px 0 20px;border:1px solid ${color}55}
  .info-row{text-align:left;background:#0f172a;border-radius:10px;padding:10px 14px;margin:4px 0;font-size:14px;color:#cbd5e1}
  .info-row span{color:#94a3b8;font-size:12px;display:block;margin-bottom:2px}
  .btn{display:block;width:100%;margin-top:12px;padding:14px 20px;border-radius:12px;font-size:15px;font-weight:700;text-decoration:none;text-align:center;cursor:pointer;border:none}
  .btn-primary{background:${color};color:#fff}
  .btn-secondary{background:#334155;color:#e2e8f0}
  .btn-danger{background:#dc2626;color:#fff}
  .divider{height:1px;background:#334155;margin:20px 0}
</style></head><body><div class="card">${body}</div></body></html>`;
}

function getRole(reqToken) {
  const clean = t => (t || '').replace(/^﻿/, '').trim();
  const mt = clean(process.env.MANAGER_TOKEN);
  const ct = clean(process.env.CHEF_TOKEN);
  const bt = clean(process.env.BAKER_TOKEN);
  if (reqToken === mt && mt) return 'manager';
  if (reqToken === ct && ct) return 'chef';
  if (reqToken === bt && bt) return 'baker';
  return null;
}

const FO_NOTES_INT     = 'flddO88Cmj7qZ5xDU';
const FO_KITCHEN_NOTES = 'fldQqZkF3rUgXrvvD';
const FO_NOTES_CUST    = 'fldKGooL6E0PkqKfI';
const FO_DELIVERY_ADDR = 'fld2j0eu6qrid1DXA';
const FO_DELIVERY_STAT = 'fldvAUsFNkaRHYQ8q';
const FO_DELIVERY_TYPE = 'fldH9aXNoJSABpTJP';
const FO_LANG          = 'fldCOu0rGNLrThxtV'; // שפת לקוח
const FQ_PRICE         = 'fld2hjBAMbg4NeRef'; // עלות מנה בזמן ההזמנה
const FQ_ORDER_REC_ID  = 'fldAcoyLDwIUoqqQH'; // lookup: order record ID (reliable filter key)

async function fetchItems(orderId, token) {
  // fldAcoyLDwIUoqqQH is a lookup returning the order record ID — ARRAYJOIN gives us the ID string
  const qFormula = `FIND("${orderId}",ARRAYJOIN({${FQ_ORDER_REC_ID}}))`;
  const qQs = `filterByFormula=${encodeURIComponent(qFormula)}&returnFieldsByFieldId=true`;
  try {
    const r = await fetch(`${AT_BASE}/${T_QTY}?${qQs}`, { headers: atHeaders(token) });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.records || []).map(rec => {
      const rf = rec.fields;
      const links = rf[FQ_DISH_LK];
      // Try: linked record name (primary field), then lookup text field, then free-text fallback
      const linkName = Array.isArray(links) && links[0]?.name ? links[0].name : '';
      const lookupName = Array.isArray(rf['fldXvuBwTBbqfcNpc']) ? rf['fldXvuBwTBbqfcNpc'][0] : '';
      const rawName = linkName || lookupName || rf[FQ_TXT] || '—';
      const name = rawName.replace(/^\d+\s+/, '');
      const qty  = Number(rf[FQ_QTY]) || 1;
      const unit = Number(rf[FQ_PRICE]) || 0;
      return { name, qty, unit, total: Math.round(qty * unit) };
    });
  } catch { return []; }
}

function itemsTable(items) {
  if (!items.length) return '';
  const rows = items.map((i, idx) =>
    `<tr style="background:${idx%2?'#0f172a':'#1a2540'}">
      <td style="padding:8px 6px;border-radius:4px">${i.name}</td>
      <td style="padding:8px 6px;text-align:center;white-space:nowrap">${i.qty}</td>
      <td style="padding:8px 6px;text-align:right;white-space:nowrap;color:#94a3b8">${i.unit ? i.unit+' ₸' : '—'}</td>
      <td style="padding:8px 6px;text-align:right;white-space:nowrap;color:#fde047;font-weight:700">${i.total ? i.total+' ₸' : '—'}</td>
    </tr>`
  ).join('');
  return `
    <table style="width:100%;border-collapse:separate;border-spacing:0 2px;margin:8px 0 4px;font-size:13px;text-align:left">
      <thead><tr style="color:#94a3b8;border-bottom:1px solid #334155">
        <th style="padding:4px 6px;font-weight:600">Блюдо</th>
        <th style="padding:4px 6px;text-align:center;font-weight:600">Кол.</th>
        <th style="padding:4px 6px;text-align:right;font-weight:600">Цена</th>
        <th style="padding:4px 6px;text-align:right;font-weight:600">Итого</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

const LANG_LABEL = { ru: '🇷🇺 Русский', en: '🇬🇧 English', he: '🇮🇱 עברית' };

// Customer-facing WhatsApp templates for approve/ready/reject, keyed by customer language ({num} placeholder)
const CUST_ACTION_TMPL = {
  ru: {
    approveHead: '✅ Заказ {num} подтверждён!',
    readyHead: '🍽️ Заказ {num} готов!', readyBody: 'Заберите заказ',
    rejectHead: '❌ Заказ {num} отменён', rejectBody: 'Свяжитесь с нами для уточнения деталей.',
    btnStatus: 'Статус заказа', btnKaspi: 'Оплатить Kaspi',
  },
  en: {
    approveHead: '✅ Order {num} confirmed!',
    readyHead: '🍽️ Order {num} is ready!', readyBody: 'Please pick up your order',
    rejectHead: '❌ Order {num} cancelled', rejectBody: 'Please contact us for details.',
    btnStatus: 'Order status', btnKaspi: 'Pay with Kaspi',
  },
  he: {
    approveHead: '✅ הזמנה {num} אושרה!',
    readyHead: '🍽️ הזמנה {num} מוכנה!', readyBody: 'נא לאסוף את ההזמנה',
    rejectHead: '❌ הזמנה {num} בוטלה', rejectBody: 'צרו איתנו קשר לפרטים נוספים.',
    btnStatus: 'סטטוס הזמנה', btnKaspi: 'תשלום Kaspi',
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const { id, action, token: reqToken } = req.query;

  // ── PATCH: edit order fields ────────────────────────────────────────────────
  if (req.method === 'PATCH') {
    const role = getRole((reqToken || '').trim());
    const airtableToken = (process.env.AIRTABLE_TOKEN || '').replace(/^﻿/, '').trim();
    if (role !== 'manager') return res.status(403).json({ error: 'Forbidden' });
    if (!id || !/^rec[A-Za-z0-9]{14}$/.test(id)) return res.status(400).json({ error: 'Invalid id' });
    const { notes_internal, notes_kitchen, notes_customer, delivery_address, delivery_status,
            delivery_type, status } = req.body || {};
    const fields = {};
    if (notes_internal  !== undefined) fields[FO_NOTES_INT]     = notes_internal;
    if (notes_kitchen   !== undefined) fields[FO_KITCHEN_NOTES] = notes_kitchen;
    if (notes_customer  !== undefined) fields[FO_NOTES_CUST]    = notes_customer;
    if (delivery_address!== undefined) fields[FO_DELIVERY_ADDR] = delivery_address;
    // singleSelect: Airtable rejects empty string — use null to clear
    if (delivery_status !== undefined) fields[FO_DELIVERY_STAT] = delivery_status || null;
    if (delivery_type   !== undefined) fields[FO_DELIVERY_TYPE] = delivery_type   || null;
    if (status          !== undefined) fields[FO_STATUS]        = status          || null;
    if (!Object.keys(fields).length) return res.status(400).json({ error: 'Nothing to update' });
    const r = await fetch(`${AT_BASE}/${T_ORDERS}/${id}?returnFieldsByFieldId=true`, {
      method: 'PATCH', headers: atHeaders(airtableToken),
      body: JSON.stringify({ fields }),
    });
    if (!r.ok) { const d = await r.json().catch(()=>({})); return res.status(502).json({ error: 'Airtable error', detail: JSON.stringify(d).slice(0,200) }); }
    return res.status(200).json({ ok: true });
  }

  const role = getRole((reqToken || '').trim());
  const airtableToken = (process.env.AIRTABLE_TOKEN || '').replace(/^﻿/, '').trim();

  // ── JSON GET actions (return JSON, not HTML) ─────────────────────────────
  if (['GET','POST'].includes(req.method) && ['payments','payment_methods','contacts','pay','notify_staff'].includes(action)) {
    if (role !== 'manager') return res.status(403).json({ error: 'Forbidden' });

    if (action === 'payment_methods') {
      const qs = `fields[]=${FM_NAME}&returnFieldsByFieldId=true&sort[0][field]=${FM_NAME}&sort[0][direction]=asc`;
      const r2 = await fetch(`${AT_BASE}/${T_PAY_METHODS}?${qs}`, { headers: atHeaders(airtableToken) });
      if (!r2.ok) return res.status(502).json({ error: 'Airtable error' });
      const d2 = await r2.json();
      const methods = (d2.records || []).map(rec => ({ id: rec.id, name: rec.fields[FM_NAME] || '' })).filter(m => m.name);
      return res.status(200).json({ methods });
    }

    if (action === 'payments') {
      if (!id || !/^rec[A-Za-z0-9]{14}$/.test(id)) return res.status(400).json({ error: 'Invalid order id' });
      // Fetch payments linked to this order
      const formula = `FIND("${id}",ARRAYJOIN({${FP_ORDER}}))`;
      const fields = [FP_ORDER, FP_DATE, FP_KZT, FP_STATUS, FP_NOTES, FP_METHOD_LKP,
                      FP_FOREIGN_CHK, FP_FOREIGN_AMT, FP_CURRENCY, FP_RATE, FP_TOTAL_KZT];
      const qs = `filterByFormula=${encodeURIComponent(formula)}&${fields.map(f=>`fields[]=${f}`).join('&')}&returnFieldsByFieldId=true&sort[0][field]=${FP_DATE}&sort[0][direction]=desc`;
      const r2 = await fetch(`${AT_BASE}/${T_PAYMENTS}?${qs}`, { headers: atHeaders(airtableToken) });
      if (!r2.ok) return res.status(502).json({ error: 'Airtable error ' + r2.status });
      const d2 = await r2.json();
      const payments = (d2.records || []).map(rec => {
        const f = rec.fields;
        const methodLkp = f[FP_METHOD_LKP];
        const methodName = Array.isArray(methodLkp) ? methodLkp[0] :
          (methodLkp && methodLkp.valuesByLinkedRecordId
            ? Object.values(methodLkp.valuesByLinkedRecordId)[0]?.[0] || ''
            : (typeof methodLkp === 'string' ? methodLkp : ''));
        return {
          id:             rec.id,
          date:           f[FP_DATE] || '',
          kzt:            f[FP_KZT] || 0,
          total_kzt:      f[FP_TOTAL_KZT] || f[FP_KZT] || 0,
          status:         typeof f[FP_STATUS]==='object' ? f[FP_STATUS].name : (f[FP_STATUS]||''),
          notes:          f[FP_NOTES] || '',
          method:         methodName,
          is_foreign:     f[FP_FOREIGN_CHK] || false,
          foreign_amount: f[FP_FOREIGN_AMT] || 0,
          currency:       typeof f[FP_CURRENCY]==='object' ? f[FP_CURRENCY].name : (f[FP_CURRENCY]||''),
          rate:           f[FP_RATE] || 0,
        };
      });
      return res.status(200).json({ payments });
    }

    if (action === 'contacts') {
      const phone = (req.query.phone || '').trim();
      if (!phone) return res.status(400).json({ error: 'phone required' });
      const clean = phone.replace(/\D/g,'');
      const formula = `FIND("${clean.slice(-9)}",SUBSTITUTE({Номер телефона},"+",""))`;
      const qs = `filterByFormula=${encodeURIComponent(formula)}&fields[]=${FC_PHONE}&fields[]=${FC_LNAME}&fields[]=${FC_FNAME}&returnFieldsByFieldId=true`;
      const r2 = await fetch(`${AT_BASE}/${T_CONTACTS}?${qs}`, { headers: atHeaders(airtableToken) });
      if (!r2.ok) return res.status(502).json({ error: 'Airtable error' });
      const d2 = await r2.json();
      const contacts = (d2.records || []).map(rec => ({
        id:    rec.id,
        fname: rec.fields[FC_FNAME] || '',
        lname: rec.fields[FC_LNAME] || '',
        phone: rec.fields[FC_PHONE] || '',
      }));
      return res.status(200).json({ contacts });
    }

    if (action === 'notify_staff') {
      if (role !== 'manager') return res.status(403).json({ error: 'Forbidden' });
      if (!id || !/^rec[A-Za-z0-9]{14}$/.test(id)) return res.status(400).json({ error: 'Invalid order id' });
      const target = (req.query.target || '').trim(); // 'chef' | 'group'
      const chefPhone  = (process.env.CHEF_WA_PHONE  || '').trim();
      const groupWaId  = (process.env.GROUP_WA_ID    || '').trim();
      const instance   = (process.env.GREEN_API_INSTANCE || '').trim();
      const apiToken   = (process.env.GREEN_API_TOKEN    || '').trim();
      if (!instance || !apiToken) return res.status(500).json({ error: 'WhatsApp not configured' });
      if (target === 'chef'  && !chefPhone) return res.status(400).json({ error: 'CHEF_WA_PHONE not set' });
      if (target === 'group' && !groupWaId) return res.status(400).json({ error: 'GROUP_WA_ID not set' });
      if (!target) return res.status(400).json({ error: 'target required: chef or group' });

      // Fetch order — single-record endpoint returns all fields, no fields[] filtering
      const orR = await fetch(`${AT_BASE}/${T_ORDERS}/${id}?returnFieldsByFieldId=true`, { headers: atHeaders(airtableToken) });
      if (!orR.ok) return res.status(502).json({ error: 'Order fetch failed', status: orR.status });
      const orData = await orR.json();
      const f = orData.fields || {};
      const serial    = f[FO_SERIAL]    ? `№${f[FO_SERIAL]}` : '';
      const custName  = f[FO_CUST_NAME] || '';
      const orderType = f[FO_NAME_RU]   || '';
      const dateExe   = f[FO_DATE_EXE]  || '';
      const status    = f[FO_STATUS]    || '';
      const kitNotes  = f[FO_KITCHEN_NOTES] || '';

      // Fetch items — no fields[] so linked records return {id,name}
      const items = await fetchItems(id, airtableToken);
      const itemLines = items.map(i => `  • ${i.name} × ${i.qty}`).join('\n');

      let dateStr = '', timeStr = '';
      if (dateExe) {
        const dt = new Date(dateExe);
        dateStr = dt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Asia/Almaty' });
        timeStr = dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Almaty' });
      }
      const lines = [
        `🍽️ Новый заказ ${serial}`,
        orderType ? `📋 Тип: ${orderType}` : '',
        (dateStr || timeStr) ? `📅 ${[dateStr, timeStr].filter(Boolean).join(' ')}` : '',
        custName  ? `👤 ${custName}` : '',
        itemLines ? `\nСостав:\n${itemLines}` : '',
        kitNotes  ? `💬 ${kitNotes}` : '',
        status    ? `📌 Статус: ${status}` : '',
      ].filter(Boolean).join('\n');

      // Custom message override (from modal editor, POST body)
      let finalMessage = lines;
      if (req.query.custom === '1' && req.method === 'POST') {
        const customMsg = ((req.body || {}).message || '').trim();
        if (customMsg) finalMessage = customMsg;
      }

      const toId = target === 'chef' ? toWaId(chefPhone) : groupWaId;
      const waUrl = `https://api.green-api.com/waInstance${instance}/sendMessage/${apiToken}`;
      const waR = await fetch(waUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: toId, message: finalMessage }),
      });
      const waD = await waR.json().catch(() => ({}));
      if (waR.ok && waD.idMessage) return res.status(200).json({ ok: true });
      return res.status(200).json({ ok: false, error: waD.message || 'WhatsApp error' });
    }
  }

  // ── POST: create contact ─────────────────────────────────────────────────
  if (req.method === 'POST' && action === 'create_contact') {
    if (role !== 'manager') return res.status(403).json({ error: 'Forbidden' });
    const { phone, first_name, last_name } = req.body || {};
    if (!phone || !first_name) return res.status(400).json({ error: 'phone and first_name required' });
    const airtableToken2 = (process.env.AIRTABLE_TOKEN || '').replace(/^﻿/, '').trim();
    const fields = { [FC_PHONE]: phone, [FC_FNAME]: first_name };
    if (last_name) fields[FC_LNAME] = last_name;
    const r2 = await fetch(`${AT_BASE}/${T_CONTACTS}?returnFieldsByFieldId=true`, {
      method: 'POST', headers: atHeaders(airtableToken2),
      body: JSON.stringify({ fields }),
    });
    if (!r2.ok) { const d2 = await r2.json().catch(()=>({})); return res.status(502).json({ error: 'Airtable error', detail: JSON.stringify(d2).slice(0,200) }); }
    const created = await r2.json();
    return res.status(201).json({ ok: true, id: created.id });
  }

  // ── POST: create payment ──────────────────────────────────────────────────
  if (req.method === 'POST' && action === 'pay') {
    if (role !== 'manager') return res.status(403).json({ error: 'Forbidden' });
    const { order_id, method_id, amount_kzt, is_foreign, foreign_currency, foreign_amount, exchange_rate, notes } = req.body || {};
    if (!order_id || !amount_kzt) return res.status(400).json({ error: 'order_id and amount_kzt required' });
    const today = new Date().toISOString().slice(0, 10);
    const fields = {
      [FP_ORDER]:  [order_id],
      [FP_DATE]:   today,
      [FP_KZT]:    Number(amount_kzt),
      [FP_STATUS]: 'Done',
    };
    if (method_id)       fields[FP_METHOD_LINK] = [method_id];
    if (notes)           fields[FP_NOTES]       = notes;
    if (is_foreign) {
      fields[FP_FOREIGN_CHK] = true;
      if (foreign_currency) fields[FP_CURRENCY]    = foreign_currency;
      if (foreign_amount)   fields[FP_FOREIGN_AMT] = Number(foreign_amount);
      if (exchange_rate)    fields[FP_RATE]         = Number(exchange_rate);
    }
    const r2 = await fetch(`${AT_BASE}/${T_PAYMENTS}?returnFieldsByFieldId=true`, {
      method: 'POST', headers: atHeaders(airtableToken),
      body: JSON.stringify({ fields }),
    });
    if (!r2.ok) { const d2 = await r2.json().catch(()=>({})); return res.status(502).json({ error: 'Airtable error', detail: JSON.stringify(d2).slice(0,200) }); }
    const created = await r2.json();
    return res.status(201).json({ ok: true, id: created.id });
  }

  // baker/chef can mark ready+deliver; manager can do all
  const allowedActions = role === 'manager' ? ['approve','reject','ready','deliver','kaspi_paid','mark_paid'] : ['ready','deliver'];
  if (!role || !allowedActions.includes(action)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(403).send(htmlPage('Ошибка', '<div class="icon">🚫</div><h1>Нет доступа</h1><p>Недействительная ссылка.</p>', '#ef4444'));
  }

  if (!id || !/^rec[A-Za-z0-9]{14}$/.test(id)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(htmlPage('Ошибка', '<div class="icon">⚠️</div><h1>Неверный запрос</h1><p>ID заказа не найден.</p>', '#f59e0b'));
  }

  const newStatus = STATUS_MAP[action];
  if (!newStatus && !['kaspi_paid','mark_paid'].includes(action)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(htmlPage('Ошибка', '<div class="icon">⚠️</div><h1>Неверное действие</h1>', '#f59e0b'));
  }

  if (!airtableToken) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(htmlPage('Ошибка', '<div class="icon">⚙️</div><h1>Ошибка конфигурации</h1>', '#ef4444'));
  }

  const tknEnc = encodeURIComponent(reqToken);

  try {
    // Fetch order — single-record GET returns all fields, no fields[] needed
    const getR = await fetch(`${AT_BASE}/${T_ORDERS}/${id}?returnFieldsByFieldId=true`, { headers: atHeaders(airtableToken) });
    if (!getR.ok) throw new Error(`GET ${getR.status}`);
    const rec = await getR.json();
    const f = rec.fields || {};

    const orderNum  = f[FO_SERIAL]    ? `№${f[FO_SERIAL]}` : '';
    const custName  = f[FO_CUST_NAME] || '';
    const custPhone = f[FO_PHONE]     || '';
    const orderType = f[FO_NAME_RU]   || '';
    const total     = f[FO_PRICE]     || 0;
    const orderDate = f[FO_DATE_EXE]  || '';
    const payment   = typeof f[FO_PAYMENT] === 'object' ? (f[FO_PAYMENT]?.name || '') : (f[FO_PAYMENT] || '');
    const kaspiUrl  = f[FO_KASPI_URL] || '';
    const custLang  = f[FO_LANG]      || 'ru';
    const statusUrl = f[FO_SERIAL] ? `${SITE_URL}/status?num=${f[FO_SERIAL]}` : '';
    const kitNotes  = f[FO_KITCHEN_NOTES] || '';
    const statusBefore = f[FO_STATUS] || '';

    const dateStr = orderDate
      ? new Date(orderDate).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Almaty' })
      : '';

    // ── PREVIEW page (approve/ready/deliver without confirm=1, GET only) ─────
    if (req.method === 'GET' && req.query.confirm !== '1' && action !== 'mark_paid') {
      const items = await fetchItems(id, airtableToken);
      const confirmUrl = `${SITE_URL}/api/manager-action?id=${id}&action=${action}&token=${tknEnc}&confirm=1`;
      const actionLabels = { approve: '✅ Подтвердить заказ', ready: '🍽️ Отметить Готов', deliver: '📦 Отметить Передано' };
      const actionColors = { approve: '#22c55e', ready: '#f59e0b', deliver: '#6366f1' };
      const btn = actionLabels[action] || 'Выполнить';
      const col = actionColors[action] || '#22c55e';
      const paymentFormHtml = (action === 'approve') ? `
        <div class="divider"></div>
        <details style="text-align:left">
          <summary style="cursor:pointer;color:#94a3b8;font-size:13px;padding:6px 0">💳 Зарегистрировать оплату</summary>
          <div style="margin-top:10px">
            <input id="payAmt" type="number" placeholder="Сумма ₸" style="width:100%;padding:10px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;font-size:14px;margin-bottom:8px" value="${total||''}">
            <select id="payMethod" style="width:100%;padding:10px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;font-size:14px;margin-bottom:10px">
              <option value="">-- Способ оплаты --</option>
              <option value="Наличные">💵 Наличные</option>
              <option value="Kaspi">📱 Kaspi</option>
              <option value="Перевод">🏦 Перевод</option>
              <option value="Voucher">🎫 Ваучер</option>
            </select>
            <button class="btn" style="background:#0ea5e9;color:#fff" onclick="recordPay()">💳 Записать оплату</button>
            <p id="payResult" style="margin-top:8px;font-size:13px;display:none"></p>
          </div>
        </details>
        <script>
        async function recordPay(){
          const amt=document.getElementById('payAmt').value;
          const mth=document.getElementById('payMethod').value;
          const res=document.getElementById('payResult');
          if(!amt||!mth){res.style.display='';res.style.color='#f87171';res.textContent='Укажите сумму и способ оплаты';return;}
          res.style.display='';res.style.color='#94a3b8';res.textContent='⏳ Сохраняем…';
          const r=await fetch('/api/manager-action?action=mark_paid&id=${id}&token=${tknEnc}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount:Number(amt),method:mth})});
          const d=await r.json().catch(()=>({}));
          if(d.ok){res.style.color='#86efac';res.textContent='✅ Оплата записана: '+amt+' ₸';}
          else{res.style.color='#f87171';res.textContent='Ошибка: '+(d.error||'unknown');}
        }
        </script>` : '';
      const notifyChefUrl = `${SITE_URL}/api/manager-action?action=notify_staff&target=chef&id=${id}&token=${tknEnc}`;
      const currentStatus = statusBefore;
      const statusColor = {
        'Ожидает подтверждения менеджера': '#f59e0b',
        'Подтверждён': '#22c55e', 'Готов': '#a78bfa', 'Отменён': '#ef4444',
      }[currentStatus] || '#94a3b8';
      // Build default chef message text
      const chefMsgDefault = [
        `🍽️ Новый заказ ${orderNum}`,
        orderType ? `📋 Тип: ${orderType}` : '',
        dateStr   ? `📅 ${dateStr}` : '',
        custName  ? `👤 ${custName}` : '',
        items.length ? `\nСостав:\n${items.map(i=>`  • ${i.name} × ${i.qty}`).join('\n')}` : '',
        kitNotes  ? `💬 ${kitNotes}` : '',
        currentStatus ? `📌 ${currentStatus}` : '',
      ].filter(Boolean).join('\n');

      // No confirm=1 here on purpose — these are convenience links on a page that
      // may get auto-prefetched (data-saver browsers, link scanners); they must
      // land on another preview/confirm step, never execute a side effect via bare GET.
      const readyUrlDirect  = `${SITE_URL}/api/manager-action?id=${id}&action=ready&token=${tknEnc}`;
      const deliverUrlDirect= `${SITE_URL}/api/manager-action?id=${id}&action=deliver&token=${tknEnc}`;

      const pageBody = `
        <div class="icon">📋</div>
        <h1>Заказ ${orderNum}</h1>
        ${currentStatus ? `<div style="display:inline-block;padding:6px 16px;border-radius:99px;font-size:13px;font-weight:700;background:${statusColor}22;color:${statusColor};border:1px solid ${statusColor}55;margin:6px 0 14px">📌 ${currentStatus}</div>` : ''}
        ${custName  ? `<div class="info-row"><span>Клиент</span>${custName}</div>` : ''}
        ${custLang  ? `<div class="info-row"><span>Язык клиента</span>${LANG_LABEL[custLang] || custLang}</div>` : ''}
        ${orderType ? `<div class="info-row"><span>Тип заказа</span>${orderType}</div>` : ''}
        ${dateStr   ? `<div class="info-row"><span>Дата / время</span>${dateStr}</div>` : ''}
        ${payment   ? `<div class="info-row"><span>Оплата</span>${payment}</div>` : ''}
        ${total     ? `<div class="info-row"><span>Сумма</span><strong style="color:#fde047">${total} ₸</strong></div>` : ''}
        ${kitNotes  ? `<div class="info-row" style="background:#2d1f00"><span>💬 Заметки кухни</span>${kitNotes}</div>` : ''}
        ${items.length ? `<div style="margin-top:12px;font-size:12px;color:#94a3b8;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Состав заказа</div>` : '<div style="margin-top:8px;font-size:13px;color:#64748b;text-align:left">Позиции заказа не найдены</div>'}
        ${itemsTable(items)}
        <div class="divider"></div>
        <a class="btn" style="background:${col};color:#fff;display:block;text-decoration:none;margin-bottom:4px" href="${confirmUrl}">${btn}</a>
        <button class="btn btn-secondary" style="margin-top:4px" onclick="openChefModal()">📨 Уведомить шефа</button>
        <div class="divider"></div>
        <div style="display:flex;gap:8px">
          <a class="btn" style="background:#a78bfa;color:#fff;text-decoration:none;flex:1;font-size:14px" href="${readyUrlDirect}">🍽️ Готов</a>
          <a class="btn" style="background:#6366f1;color:#fff;text-decoration:none;flex:1;font-size:14px" href="${deliverUrlDirect}">📦 Передано</a>
        </div>
        ${paymentFormHtml}

        <!-- Chef modal -->
        <div id="chefModal" style="display:none;position:fixed;inset:0;background:#000a;z-index:100;align-items:center;justify-content:center;padding:16px">
          <div style="background:#1e293b;border-radius:16px;padding:24px;max-width:420px;width:100%">
            <h2 style="color:#f1f5f9;font-size:16px;margin:0 0 12px">📨 Сообщение шефу</h2>
            <textarea id="chefMsgTxt" rows="10" style="width:100%;padding:10px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;font-size:13px;line-height:1.5;resize:vertical;box-sizing:border-box"></textarea>
            <div style="display:flex;gap:8px;margin-top:12px">
              <button class="btn btn-secondary" style="flex:1" onclick="closeChefModal()">✕ Отмена</button>
              <button class="btn" style="flex:2;background:#22c55e;color:#fff" onclick="sendChefMsg(this)">✅ Отправить</button>
            </div>
            <p id="chefMsgRes" style="margin-top:8px;font-size:13px;display:none"></p>
          </div>
        </div>

        <script>
        const _defMsg=${JSON.stringify(chefMsgDefault)};
        function openChefModal(){
          document.getElementById('chefMsgTxt').value=_defMsg;
          document.getElementById('chefModal').style.display='flex';
          document.getElementById('chefMsgRes').style.display='none';
        }
        function closeChefModal(){document.getElementById('chefModal').style.display='none';}
        async function sendChefMsg(btn){
          const msg=document.getElementById('chefMsgTxt').value.trim();
          if(!msg)return;
          btn.disabled=true;btn.textContent='⏳…';
          const r=await fetch('/api/manager-action?action=notify_staff&target=chef&id=${id}&token=${tknEnc}&custom=1',{
            method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg})
          }).catch(()=>({ok:false}));
          const d=r.json?await r.json().catch(()=>({})):{};
          const res=document.getElementById('chefMsgRes');
          res.style.display='';
          if(d.ok){res.style.color='#86efac';res.textContent='✅ Отправлено!';setTimeout(closeChefModal,1200);}
          else{res.style.color='#f87171';res.textContent='Ошибка: '+(d.error||'');btn.disabled=false;btn.textContent='✅ Отправить';}
        }
        <\/script>`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(htmlPage(`Заказ ${orderNum}`, pageBody, '#3b82f6'));
    }

    // ── mark_paid: POST from payment form in preview page ───────────────────
    if (action === 'mark_paid') {
      const body = req.body || {};
      const amount = Number(body.amount) || 0;
      const method = String(body.method || '').trim();
      if (!amount || !method) return res.status(400).json({ error: 'amount and method required' });
      const today = new Date().toISOString().slice(0, 10);
      const payR = await fetch(`${AT_BASE}/${T_PAYMENTS}?returnFieldsByFieldId=true`, {
        method: 'POST', headers: atHeaders(airtableToken),
        body: JSON.stringify({ fields: {
          [FP_ORDER]: [id], [FP_DATE]: today, [FP_KZT]: amount,
          [FP_STATUS]: 'Done', [FP_NOTES]: `${method} | Заказ ${orderNum}`,
        }}),
      });
      const payD = await payR.json().catch(() => ({}));
      if (!payR.ok) return res.status(502).json({ error: 'Airtable error', detail: JSON.stringify(payD).slice(0,100) });
      return res.status(200).json({ ok: true });
    }

    // ── deliver: mark delivery_status only ───────────────────────────────────
    if (action === 'deliver') {
      const patchR = await fetch(`${AT_BASE}/${T_ORDERS}/${id}?returnFieldsByFieldId=true`, {
        method: 'PATCH', headers: atHeaders(airtableToken),
        body: JSON.stringify({ fields: { [FO_DELIVERY_STAT]: 'נמסר' } }),
      });
      if (!patchR.ok) throw new Error(`PATCH deliver ${patchR.status}`);
      const pageBody = `
        <div class="icon">📦</div>
        <h1>Передано!</h1>
        <div class="badge">Заказ ${orderNum}</div>
        ${custName ? `<div class="info-row"><span>Клиент</span>${custName}</div>` : ''}
        <p style="margin-top:12px;color:#86efac">✅ Доставка отмечена как выполненная</p>`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(htmlPage('Передано', pageBody, '#22c55e'));
    }

    // ── kaspi_paid: create payment record ───────────────────────────────────
    if (action === 'kaspi_paid') {
      const today = new Date().toISOString().slice(0, 10);
      const payR = await fetch(`${AT_BASE}/${T_PAYMENTS}?returnFieldsByFieldId=true`, {
        method: 'POST', headers: atHeaders(airtableToken),
        body: JSON.stringify({ fields: {
          [FP_ORDER]: [id], [FP_DATE]: today, [FP_KZT]: total,
          [FP_STATUS]: 'Done', [FP_NOTES]: `Kaspi — отмечено менеджером | Заказ ${orderNum}`,
        }}),
      });
      const payD = await payR.json().catch(() => ({}));
      if (!payR.ok) throw new Error(`PAY ${JSON.stringify(payD).slice(0, 100)}`);
      const pageBody = `
        <div class="icon">✅</div><h1>Оплата Kaspi отмечена</h1>
        <div class="badge">Заказ ${orderNum}</div>
        ${total ? `<p><strong>${total} ₸</strong></p>` : ''}
        <p>Запись создана в таблице оплат.</p>`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(htmlPage('Оплата отмечена', pageBody, '#22c55e'));
    }

    // ── approve / ready / reject: update order status ────────────────────────
    const patchR = await fetch(`${AT_BASE}/${T_ORDERS}/${id}?returnFieldsByFieldId=true`, {
      method: 'PATCH', headers: atHeaders(airtableToken),
      body: JSON.stringify({ fields: { [FO_STATUS]: newStatus } }),
    });
    if (!patchR.ok) throw new Error(`PATCH ${patchR.status}`);

    // Send WhatsApp to customer — only on the transition into newStatus, never on a
    // repeat hit (double-tap, page refresh, link-prefetch) that finds it already there.
    const isRepeatHit = statusBefore === newStatus;
    if (custPhone && !isRepeatHit) {
      const isKaspi = payment === 'כספי';
      const cl = CUST_ACTION_TMPL[custLang] || CUST_ACTION_TMPL.ru;
      let header = '', waBody = '', buttons = [];
      if (action === 'approve') {
        header = cl.approveHead.replace('{num}', orderNum);
        waBody = orderType ? `📋 ${orderType}` : '';
        if (statusUrl) buttons.push({ type: 'url', buttonId: '1', buttonText: cl.btnStatus, url: statusUrl });
        if (isKaspi && kaspiUrl) buttons.push({ type: 'url', buttonId: '2', buttonText: cl.btnKaspi, url: kaspiUrl });
      } else if (action === 'ready') {
        header = cl.readyHead.replace('{num}', orderNum);
        waBody = orderType || cl.readyBody;
        if (statusUrl) buttons.push({ type: 'url', buttonId: '1', buttonText: cl.btnStatus, url: statusUrl });
        const managerTgt = managerTarget();
        if (managerTgt) sendWa(managerTgt, `✅ Заказ ${orderNum} готов!\n👤 ${custName}\n📋 ${orderType}`).catch(() => {});
      } else if (action === 'reject') {
        header = cl.rejectHead.replace('{num}', orderNum);
        waBody = cl.rejectBody;
      }
      if (header) sendWaButtons(custPhone, { header, body: waBody, buttons }).catch(() => {});
    }

    const icons  = { approve: '✅', reject: '❌', ready: '🍽️' };
    const colors = { approve: '#22c55e', reject: '#ef4444', ready: '#f59e0b' };

    const readyUrl   = action === 'approve' ? `${SITE_URL}/api/manager-action?id=${id}&action=ready&token=${tknEnc}` : '';
    const deliverUrl = action === 'ready'   ? `${SITE_URL}/api/manager-action?id=${id}&action=deliver&token=${tknEnc}` : '';
    const kaspiPaidUrl = (action === 'approve' && payment === 'כספי')
      ? `${SITE_URL}/api/manager-action?id=${id}&action=kaspi_paid&token=${tknEnc}` : '';
    const notifyChefUrl2 = `${SITE_URL}/api/manager-action?action=notify_staff&target=chef&id=${id}&token=${tknEnc}`;

    const pageBody = `
      <div class="icon">${icons[action] || '✅'}</div>
      <h1>${newStatus}</h1>
      <div class="badge">Заказ ${orderNum}</div>
      ${custName  ? `<div class="info-row"><span>Клиент</span>${custName}</div>` : ''}
      ${orderType ? `<div class="info-row"><span>Тип заказа</span>${orderType}</div>` : ''}
      ${dateStr   ? `<div class="info-row"><span>Дата / время</span>${dateStr}</div>` : ''}
      <div class="divider"></div>
      ${action === 'approve' ? `<button class="btn btn-secondary" onclick="notifyChef(this)">📨 Уведомить шефа</button>` : ''}
      ${kaspiPaidUrl ? `<a class="btn" style="background:#22c55e;color:#fff;display:block;text-decoration:none;margin-top:8px" href="${kaspiPaidUrl}">✅ Kaspi оплачен</a>` : ''}
      ${readyUrl    ? `<a class="btn" style="background:#f59e0b;color:#fff;display:block;text-decoration:none;margin-top:8px" href="${readyUrl}">🍽️ Отметить Готов</a>` : ''}
      ${deliverUrl  ? `<a class="btn" style="background:#6366f1;color:#fff;display:block;text-decoration:none;margin-top:8px" href="${deliverUrl}">📦 Отметить Передано</a>` : ''}
      <script>
      async function notifyChef(btn){
        btn.disabled=true;btn.textContent='⏳ Отправка…';
        const r=await fetch('${notifyChefUrl2}').catch(()=>({ok:false}));
        const d=r.json?await r.json().catch(()=>({})):{};
        btn.textContent=d.ok?'✅ Отправлено шефу':'⚠️ Ошибка — '+(d.error||'');
      }
      <\/script>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(htmlPage(newStatus, pageBody, colors[action] || '#22c55e'));

  } catch (err) {
    console.error('[manager-action]', err.message);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(502).send(htmlPage('Ошибка', '<div class="icon">⚠️</div><h1>Ошибка сервера</h1><p>Попробуйте ещё раз.</p>', '#ef4444'));
  }
}
