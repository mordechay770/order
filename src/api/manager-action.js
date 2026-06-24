/**
 * GET /api/manager-action?id=recXXX&action=approve|reject|ready&token=SECRET
 * Updates order status in Airtable. Designed to be called from a link in WhatsApp.
 * Returns HTML page (so manager sees confirmation in browser).
 */

const BASE    = 'appM61hkcOruhdBuv';
const AT_BASE = `https://api.airtable.com/v0/${BASE}`;

const T_ORDERS   = 'tblMnlLwYCD27ou80';
const T_PAYMENTS = 'tblaNK6mYqr20YtT1';

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
  const digits = phone.replace(/\D/g, '');
  const norm = digits.startsWith('8') && digits.length === 11 ? '7' + digits.slice(1) : digits;
  return norm + '@c.us';
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
  body{font-family:system-ui,sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:16px;box-sizing:border-box}
  .card{background:#fff;border-radius:16px;padding:32px 24px;max-width:420px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,.08);text-align:center}
  .icon{font-size:48px;margin-bottom:12px}
  h1{margin:0 0 8px;font-size:22px;color:#0f172a}
  p{color:#64748b;margin:0 0 8px;font-size:15px}
  .badge{display:inline-block;padding:6px 14px;border-radius:99px;font-size:13px;font-weight:700;background:${color}22;color:${color};margin:8px 0 16px}
  a{display:inline-block;margin-top:16px;padding:12px 24px;background:#0f172a;color:#fff;text-decoration:none;border-radius:10px;font-size:15px}
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
    if (delivery_status !== undefined) fields[FO_DELIVERY_STAT] = delivery_status;
    if (delivery_type   !== undefined) fields[FO_DELIVERY_TYPE] = delivery_type;
    if (status          !== undefined) fields[FO_STATUS]        = status;
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
  if (req.method === 'GET' && ['payments','payment_methods','contacts','pay'].includes(action)) {
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
  const allowedActions = role === 'manager' ? ['approve','reject','ready','deliver','kaspi_paid'] : ['ready','deliver'];
  if (!role || !allowedActions.includes(action)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(403).send(htmlPage('Ошибка', '<div class="icon">🚫</div><h1>Нет доступа</h1><p>Недействительная ссылка.</p>', '#ef4444'));
  }

  if (!id || !/^rec[A-Za-z0-9]{14}$/.test(id)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(htmlPage('Ошибка', '<div class="icon">⚠️</div><h1>Неверный запрос</h1><p>ID заказа не найден.</p>', '#f59e0b'));
  }

  const newStatus = STATUS_MAP[action];
  if (!newStatus && action !== 'kaspi_paid') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(htmlPage('Ошибка', '<div class="icon">⚠️</div><h1>Неверное действие</h1>', '#f59e0b'));
  }

  if (!airtableToken) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(htmlPage('Ошибка', '<div class="icon">⚙️</div><h1>Ошибка конфигурации</h1>', '#ef4444'));
  }

  try {
    // Fetch order first — single-record GET does NOT support fields[] filter
    const getR = await fetch(
      `${AT_BASE}/${T_ORDERS}/${id}?returnFieldsByFieldId=true`,
      { headers: atHeaders(airtableToken) }
    );
    if (!getR.ok) throw new Error(`GET ${getR.status}`);
    const rec = await getR.json();
    const f = rec.fields || {};

    // ── deliver: mark delivery_status = נמסר (no order status change) ──────
    if (action === 'deliver') {
      const patchR = await fetch(`${AT_BASE}/${T_ORDERS}/${id}?returnFieldsByFieldId=true`, {
        method: 'PATCH', headers: atHeaders(airtableToken),
        body: JSON.stringify({ fields: { [FO_DELIVERY_STAT]: 'נמסר' } }),
      });
      if (!patchR.ok) throw new Error(`PATCH deliver ${patchR.status}`);
      return res.status(200).json({ ok: true, message: 'Помечено как передано' });
    }

    // ── kaspi_paid: create payment record in Airtable ──────────────────────
    if (action === 'kaspi_paid') {
      const orderNum = f[FO_SERIAL]    ? `№${f[FO_SERIAL]}` : '';
      const total    = f[FO_PRICE]     || 0;
      const today    = new Date().toISOString().slice(0, 10);
      const payR = await fetch(`${AT_BASE}/${T_PAYMENTS}?returnFieldsByFieldId=true`, {
        method:  'POST',
        headers: atHeaders(airtableToken),
        body:    JSON.stringify({ fields: {
          [FP_ORDER]:  [id],
          [FP_DATE]:   today,
          [FP_KZT]:    total,
          [FP_STATUS]: 'Done',
          [FP_NOTES]:  `Kaspi — отмечено менеджером вручную | Заказ ${orderNum}`,
        }}),
      });
      const payD = await payR.json();
      if (!payR.ok) throw new Error(`PAY ${JSON.stringify(payD).slice(0, 100)}`);
      const htmlBody = `
        <div class="icon">✅</div>
        <h1>Оплата Kaspi отмечена</h1>
        <div class="badge">Заказ ${orderNum}</div>
        ${total ? `<p><strong>${total} ₸</strong></p>` : ''}
        <p>Запись создана в таблице оплат.</p>
      `;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(htmlPage('Оплата отмечена', htmlBody, '#22c55e'));
    }

    // Update status
    const patchR = await fetch(
      `${AT_BASE}/${T_ORDERS}/${id}?returnFieldsByFieldId=true`,
      {
        method: 'PATCH',
        headers: atHeaders(airtableToken),
        body: JSON.stringify({ fields: { [FO_STATUS]: newStatus } }),
      }
    );
    if (!patchR.ok) throw new Error(`PATCH ${patchR.status}`);

    const orderNum  = f[FO_SERIAL]    ? `№${f[FO_SERIAL]}` : '';
    const custName  = f[FO_CUST_NAME] || '';
    const custPhone = f[FO_PHONE]     || '';
    const orderType = f[FO_NAME_RU]   || '';
    const total     = f[FO_PRICE]     || 0;
    const payment   = typeof f[FO_PAYMENT] === 'object' ? (f[FO_PAYMENT]?.name || '') : (f[FO_PAYMENT] || '');
    const kaspiUrl  = f[FO_KASPI_URL] || '';
    const statusUrl = f[FO_SERIAL] ? `${SITE_URL}/status?num=${f[FO_SERIAL]}` : '';

    // Send WhatsApp to customer after action
    if (custPhone) {
      const isKaspi = payment === 'כספי';
      let header = '', body = '', buttons = [];

      if (action === 'approve') {
        header = `✅ Заказ ${orderNum} подтверждён!`;
        body   = `${orderType ? '📋 ' + orderType + '\n' : ''}💰 ${total} ₸`;
        if (statusUrl) buttons.push({ type: 'url', buttonId: '1', buttonText: 'Статус заказа', url: statusUrl });
        if (isKaspi && kaspiUrl) buttons.push({ type: 'url', buttonId: '2', buttonText: 'Оплатить Kaspi', url: kaspiUrl });
      } else if (action === 'ready') {
        header = `🍽️ Заказ ${orderNum} готов!`;
        body   = orderType || 'Заберите заказ';
        if (statusUrl) buttons.push({ type: 'url', buttonId: '1', buttonText: 'Статус заказа', url: statusUrl });

        // Notify manager when order is ready
        const managerPhone = (process.env.MANAGER_PHONE || '').trim();
        if (managerPhone) {
          sendWa(managerPhone, `✅ Заказ ${orderNum} готов!\n👤 ${custName}\n📋 ${orderType}`).catch(() => {});
        }
      } else if (action === 'reject') {
        header = `❌ Заказ ${orderNum} отменён`;
        body   = 'Свяжитесь с нами для уточнения деталей.';
      }

      if (header) {
        sendWaButtons(custPhone, { header, body, buttons }).catch(() => {});
      }
    }

    const icons  = { approve: '✅', reject: '❌', ready: '🍽️' };
    const colors = { approve: '#22c55e', reject: '#ef4444', ready: '#f59e0b' };

    // After approve of a Kaspi order — show "mark as paid" button
    const _isKaspi = payment === 'כספי';
    const kaspiPaidUrl = (action === 'approve' && _isKaspi)
      ? `${SITE_URL}/api/manager-action?id=${id}&action=kaspi_paid&token=${encodeURIComponent(reqToken)}`
      : '';

    const htmlBody = `
      <div class="icon">${icons[action]}</div>
      <h1>${newStatus}</h1>
      <div class="badge">Заказ ${orderNum}</div>
      ${custName  ? `<p>${custName}</p>` : ''}
      ${orderType ? `<p>${orderType}</p>` : ''}
      ${total     ? `<p><strong>${total} ₸</strong></p>` : ''}
      ${kaspiPaidUrl ? `<a href="${kaspiPaidUrl}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#16a34a;color:#fff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:700">✅ Отметить Kaspi оплаченным</a>` : ''}
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(htmlPage(newStatus, htmlBody, colors[action]));

  } catch (err) {
    console.error('[manager-action]', err.message);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(502).send(htmlPage('Ошибка', '<div class="icon">⚠️</div><h1>Ошибка сервера</h1><p>Попробуйте ещё раз.</p>', '#ef4444'));
  }
}
