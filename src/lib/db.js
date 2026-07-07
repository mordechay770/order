/**
 * lib/db.js — Data Access Layer
 *
 * כל גישה ל-database עוברת דרך כאן.
 * כשנעבור מ-Airtable ל-Supabase — משנים רק קובץ זה.
 * שאר ה-API routes לא יודעים מה יש בפנים.
 */

const AIRTABLE_BASE = 'appM61hkcOruhdBuv';
const AT_API        = `https://api.airtable.com/v0/${AIRTABLE_BASE}`;

// ── Airtable helpers (פנימי — לא לייצא) ─────────────────────────────────────

function atHeaders() {
  const token = (process.env.AIRTABLE_TOKEN || '').replace(/^﻿/, '').trim();
  if (!token) throw new Error('AIRTABLE_TOKEN missing');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function buildQS(params, offset) {
  const parts = [];
  for (const [k, v] of Object.entries(params)) {
    if (k === 'sort' && Array.isArray(v)) {
      v.forEach((s, i) => {
        parts.push(`sort[${i}][field]=${encodeURIComponent(s.field)}`);
        parts.push(`sort[${i}][direction]=${encodeURIComponent(s.direction)}`);
      });
    } else if (k === 'fields' && Array.isArray(v)) {
      v.forEach(f => parts.push(`fields[]=${encodeURIComponent(f)}`));
    } else {
      parts.push(`${k}=${encodeURIComponent(v)}`);
    }
  }
  if (offset) parts.push(`offset=${encodeURIComponent(offset)}`);
  return parts.join('&');
}

async function atGet(path) {
  const sep     = path.includes('?') ? '&' : '?';
  const fullUrl = `${AT_API}/${path}${sep}returnFieldsByFieldId=true`;
  const r       = await fetch(fullUrl, { headers: atHeaders() });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`Airtable ${r.status}: ${txt.slice(0, 200)}`);
  }
  return r.json();
}

// ── ממשק ציבורי — פונקציות שה-API routes קוראים ─────────────────────────────

/**
 * שליפת כל הרשומות מטבלה עם pagination אוטומטי.
 * @param {string} tableId  — מזהה טבלת Airtable
 * @param {object} params   — filterByFormula, fields[], sort[], וכו׳
 * @returns {Promise<object[]>} מערך רשומות
 */
export async function listRecords(tableId, params = {}) {
  const records = [];
  let offset    = '';
  do {
    const data = await atGet(`${tableId}?${buildQS(params, offset)}`);
    records.push(...(data.records || []));
    offset = data.offset || '';
  } while (offset);
  return records;
}

/**
 * שליפת רשומה בודדת לפי ID.
 * @param {string} tableId
 * @param {string} recordId
 * @returns {Promise<object>} רשומה
 */
export async function getRecord(tableId, recordId) {
  return atGet(`${tableId}/${recordId}`);
}

/**
 * יצירת רשומה חדשה.
 * @param {string} tableId
 * @param {object} fields
 * @returns {Promise<object>} רשומה שנוצרה
 */
export async function createRecord(tableId, fields) {
  const r = await fetch(`${AT_API}/${tableId}?returnFieldsByFieldId=true`, {
    method:  'POST',
    headers: atHeaders(),
    body:    JSON.stringify({ fields }),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`Airtable create ${r.status}: ${txt.slice(0, 200)}`);
  }
  return r.json();
}

/**
 * עדכון רשומה קיימת (PATCH — רק שדות שמועברים).
 * @param {string} tableId
 * @param {string} recordId
 * @param {object} fields
 * @returns {Promise<object>} רשומה מעודכנת
 */
export async function updateRecord(tableId, recordId, fields) {
  const r = await fetch(`${AT_API}/${tableId}/${recordId}?returnFieldsByFieldId=true`, {
    method:  'PATCH',
    headers: atHeaders(),
    body:    JSON.stringify({ fields }),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`Airtable update ${r.status}: ${txt.slice(0, 200)}`);
  }
  return r.json();
}
