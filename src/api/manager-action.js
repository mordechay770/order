/**
 * GET /api/manager-action?id=recXXX&action=approve|reject|ready&token=SECRET
 * Updates order status in Airtable. Designed to be called from a link in WhatsApp.
 * Returns HTML page (so manager sees confirmation in browser).
 */

const BASE    = 'appM61hkcOruhdBuv';
const AT_BASE = `https://api.airtable.com/v0/${BASE}`;

const T_ORDERS = 'tblMnlLwYCD27ou80';

const FO_STATUS   = 'fldcekWvpJwdVVMK6';
const FO_SERIAL   = 'fldlJLSKuSB5zvmGt';
const FO_NAME_RU  = 'flddCvqJiwEsg9pr1';
const FO_CUST_NAME= 'fld1FKztthSOvgJhJ';
const FO_PHONE    = 'fldMPQfkQATfg6j0t';
const FO_DATE_EXE = 'fldF8G3nQ7FU7GAqS';
const FO_PRICE    = 'fldJA6xBGacdetQjI';

const STATUS_MAP = {
  approve: 'Подтверждён',
  reject:  'Отменён',
  ready:   'Готов к выдаче',
};

function atHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
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

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();

  const { id, action, token: reqToken } = req.query;

  const managerToken = (process.env.MANAGER_TOKEN || '').trim();
  const airtableToken = (process.env.AIRTABLE_TOKEN || '').replace(/^﻿/, '').trim();

  if (!managerToken || reqToken !== managerToken) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(403).send(htmlPage('Ошибка', '<div class="icon">🚫</div><h1>Нет доступа</h1><p>Недействительная ссылка.</p>', '#ef4444'));
  }

  if (!id || !/^rec[A-Za-z0-9]{14}$/.test(id)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(htmlPage('Ошибка', '<div class="icon">⚠️</div><h1>Неверный запрос</h1><p>ID заказа не найден.</p>', '#f59e0b'));
  }

  const newStatus = STATUS_MAP[action];
  if (!newStatus) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(htmlPage('Ошибка', '<div class="icon">⚠️</div><h1>Неверное действие</h1>', '#f59e0b'));
  }

  if (!airtableToken) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(htmlPage('Ошибка', '<div class="icon">⚙️</div><h1>Ошибка конфигурации</h1>', '#ef4444'));
  }

  try {
    // Fetch order first to show details
    const getR = await fetch(
      `${AT_BASE}/${T_ORDERS}/${id}?returnFieldsByFieldId=true`,
      { headers: atHeaders(airtableToken) }
    );
    if (!getR.ok) throw new Error(`GET ${getR.status}`);
    const rec = await getR.json();
    const f = rec.fields || {};

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

    const orderNum = f[FO_SERIAL] ? `№${f[FO_SERIAL]}` : id;
    const custName = f[FO_CUST_NAME] || '';
    const orderType = f[FO_NAME_RU] || '';
    const total = f[FO_PRICE] ? `${f[FO_PRICE]} ₸` : '';

    const icons = { approve: '✅', reject: '❌', ready: '🍽️' };
    const colors = { approve: '#22c55e', reject: '#ef4444', ready: '#f59e0b' };

    const body = `
      <div class="icon">${icons[action]}</div>
      <h1>${newStatus}</h1>
      <div class="badge">Заказ ${orderNum}</div>
      ${custName ? `<p>${custName}</p>` : ''}
      ${orderType ? `<p>${orderType}</p>` : ''}
      ${total ? `<p><strong>${total}</strong></p>` : ''}
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(htmlPage(newStatus, body, colors[action]));

  } catch (err) {
    console.error('[manager-action]', err.message);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(502).send(htmlPage('Ошибка', '<div class="icon">⚠️</div><h1>Ошибка сервера</h1><p>Попробуйте ещё раз.</p>', '#ef4444'));
  }
}
