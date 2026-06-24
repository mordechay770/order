/**
 * GET  /api/production?token=&range=week&status=הוזמן,בייצור
 * POST /api/production?token=  body: { recipe_id, requested_qty, date, type, destination, notes, ordered_by }
 * PATCH /api/production?token=&id=recXXX body: { status, actual_qty, notes }
 */

const BASE    = 'appM61hkcOruhdBuv';
const AT_BASE = `https://api.airtable.com/v0/${BASE}`;

const T_PROD     = 'tbl2Wb8lObLNyvv2x';
const T_RECIPES  = 'tbl053nytobUU4ytc';
const T_DELIVERY = 'tblQwkgLFZT9Sz4a0';

// Production table fields
const FP_SERIAL    = 'fldSBSFfKMyZJTbit';
const FP_DATE      = 'fldD8mwckjawrMGqF';
const FP_REPORTER  = 'fld6qugP9zb5mdJyy';
const FP_RECIPE    = 'fld1DD2pKYmVy5yLG';
const FP_NAME_LKP  = 'fldf788ohMIsa2e6H';
const FP_ACTUAL    = 'fldmyYipOdaTcZMlW';
const FP_NOTES     = 'fldWw4sW71qUeF0GS';
const FP_TYPE      = 'fldvQXCzvXzosXLLd'; // מאפיה/מטבח
const FP_DEST      = 'fldoFA1iIQFkOis0W'; // למלאי/לחנות
const FP_STATUS    = 'fldNdYgazUXHHmGeR'; // הוזמן/בייצור/מוכן/הועבר למלאי
const FP_REQUESTED = 'fld47oFYsx2AggJrY'; // כמות מבוקשת
const FP_ORDERED_BY= 'fldkwCNsY87o2deRn'; // מי הזמין

// Recipes table fields
const FR_NAME_RU = 'fldXtH3CltgJys99x';
const FR_NAME_HE = 'fldarNAEQRzJURY5w';
const FR_STATUS  = 'fldYk09K4bn6aJCdA';
const FR_CAT     = 'flddqXsD7nVlRs2tV';
const FR_UNIT    = 'fldgon416A0P43cC9'; // יחידת חישוב למנה
const FR_UNIT_QTY= 'fldZqgFJTvUX6Hrtx'; // כמות ליחידה

// Delivery table fields
const FD_DATE    = 'fldrIvECb7iSLQfy8';
const FD_RECIPE  = 'fldPdMaPBMuhS97T9';
const FD_QTY     = 'flda87qPF1ifw3ltp';
const FD_DEST    = 'fldqblcHRUSi4Mwjk';
const FD_NOTES   = 'fldK6dAmYPygyJzOl';
const FD_REPORTER= 'fldBp7hPYyirezMaG';

function atH(t) { return { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }; }

function getRole(reqToken) {
  const clean = t => (t || '').replace(/^﻿/, '').trim();
  if (reqToken === clean(process.env.MANAGER_TOKEN))   return 'manager';
  if (reqToken === clean(process.env.CHEF_TOKEN))      return 'chef';
  if (reqToken === clean(process.env.BAKER_TOKEN))     return 'baker';
  if (reqToken === clean(process.env.MASHGIACH_TOKEN)) return 'mashgiach';
  return null;
}

function isoDay(offset = 0) {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function selectName(v) {
  if (!v) return '';
  return typeof v === 'object' ? (v.name || '') : v;
}

async function handleGet(req, res, airtableToken) {
  const range  = req.query.range || 'week';
  const statusFilter = req.query.status; // comma-separated status names

  let startISO, endISO;
  if (range === 'week')     { startISO = isoDay(-1); endISO = isoDay(13); }
  else if (range === 'today') { startISO = endISO = isoDay(0); }
  else { startISO = isoDay(-7); endISO = isoDay(30); } // all upcoming

  const datePart = `AND(DATESTR({תאריך})>='${startISO}',DATESTR({תאריך})<='${endISO}')`;

  let formula = datePart;
  if (statusFilter) {
    const statuses = statusFilter.split(',');
    const statusPart = statuses.length === 1
      ? `{סטטוס ייצור}='${statuses[0]}'`
      : `OR(${statuses.map(s => `{סטטוס ייצור}='${s}'`).join(',')})`;
    formula = `AND(${statusPart},${datePart})`;
  }

  const fields = [FP_SERIAL, FP_DATE, FP_REPORTER, FP_RECIPE, FP_ACTUAL,
                  FP_NOTES, FP_TYPE, FP_DEST, FP_STATUS, FP_REQUESTED, FP_ORDERED_BY];
  const qs = `filterByFormula=${encodeURIComponent(formula)}&${fields.map(f=>`fields[]=${f}`).join('&')}&returnFieldsByFieldId=true&sort[0][field]=${FP_DATE}&sort[0][direction]=asc`;

  const r = await fetch(`${AT_BASE}/${T_PROD}?${qs}`, { headers: atH(airtableToken) });
  if (!r.ok) throw new Error(`Airtable production ${r.status}`);
  const data = await r.json();

  const records = (data.records || []).map(rec => {
    const f = rec.fields;
    // multipleRecordLinks always includes {id, name} — primary field of linked table
    const recipeLink = (f[FP_RECIPE] || [])[0] || null;
    const recipeId = recipeLink ? (typeof recipeLink === 'object' ? recipeLink.id : recipeLink) : null;
    const name = recipeLink ? (recipeLink.name || '') : '';
    return {
      id:           rec.id,
      serial:       f[FP_SERIAL]    || null,
      date:         f[FP_DATE]      || null,
      recipe_name:  name,
      recipe_id:    recipeId,
      requested_qty:f[FP_REQUESTED] || 0,
      actual_qty:   f[FP_ACTUAL]    || 0,
      type:         selectName(f[FP_TYPE]),
      destination:  selectName(f[FP_DEST]),
      status:       selectName(f[FP_STATUS]) || 'הוזמן',
      notes:        f[FP_NOTES]     || '',
      ordered_by:   f[FP_ORDERED_BY]|| '',
      reporter:     f[FP_REPORTER]  || '',
    };
  });

  return res.status(200).json({ records });

}

async function handlePost(req, res, airtableToken, role) {
  if (!['manager', 'chef'].includes(role))
    return res.status(403).json({ error: 'Only manager/chef can create production orders' });

  const { recipe_id, requested_qty, date, type, destination, notes, ordered_by } = req.body || {};
  if (!recipe_id || !requested_qty || !date)
    return res.status(400).json({ error: 'recipe_id, requested_qty, date required' });

  const fields = {
    [FP_RECIPE]:    [recipe_id],
    [FP_REQUESTED]: Number(requested_qty),
    [FP_DATE]:      date,
    [FP_STATUS]:    'הוזמן',
  };
  if (type)        fields[FP_TYPE]       = type;
  if (destination) fields[FP_DEST]       = destination;
  if (notes)       fields[FP_NOTES]      = notes;
  if (ordered_by)  fields[FP_ORDERED_BY] = ordered_by;

  const r = await fetch(`${AT_BASE}/${T_PROD}?returnFieldsByFieldId=true`, {
    method: 'POST',
    headers: atH(airtableToken),
    body: JSON.stringify({ fields }),
  });
  if (!r.ok) throw new Error(`Airtable POST ${r.status}`);
  const rec = await r.json();
  return res.status(201).json({ id: rec.id, serial: rec.fields?.[FP_SERIAL] });
}

async function handlePatch(req, res, airtableToken, role) {
  const { id } = req.query;
  if (!id || !/^rec[A-Za-z0-9]{14}$/.test(id))
    return res.status(400).json({ error: 'Invalid id' });

  const { status, actual_qty, notes, reporter } = req.body || {};
  const fields = {};

  if (status) {
    // Baker can only move to specific statuses
    const allowed = role === 'baker'
      ? ['בייצור', 'מוכן', 'הועבר למלאי']
      : ['הוזמן', 'בייצור', 'מוכן', 'הועבר למלאי'];
    if (!allowed.includes(status))
      return res.status(403).json({ error: `Role ${role} cannot set status ${status}` });
    fields[FP_STATUS] = status;
  }
  if (actual_qty !== undefined) fields[FP_ACTUAL]   = Number(actual_qty);
  if (notes !== undefined)      fields[FP_NOTES]    = notes;
  if (reporter)                 fields[FP_REPORTER] = reporter;

  if (!Object.keys(fields).length)
    return res.status(400).json({ error: 'Nothing to update' });

  const r = await fetch(`${AT_BASE}/${T_PROD}/${id}?returnFieldsByFieldId=true`, {
    method: 'PATCH',
    headers: atH(airtableToken),
    body: JSON.stringify({ fields }),
  });
  if (!r.ok) throw new Error(`Airtable PATCH ${r.status}`);
  return res.status(200).json({ ok: true });
}

// GET /api/production?recipes=1 — list all recipes for product picker
async function handleRecipeList(res, airtableToken) {
  const fields = [FR_NAME_RU, FR_NAME_HE, FR_CAT, FR_UNIT, FR_UNIT_QTY];
  const qs = `${fields.map(f=>`fields[]=${f}`).join('&')}&returnFieldsByFieldId=true&sort[0][field]=${FR_NAME_RU}&sort[0][direction]=asc`;
  const r = await fetch(`${AT_BASE}/${T_RECIPES}?${qs}`, { headers: atH(airtableToken) });
  if (!r.ok) throw new Error(`Airtable recipes ${r.status}`);
  const data = await r.json();
  const list = (data.records || []).map(rec => ({
    id:       rec.id,
    name_ru:  rec.fields[FR_NAME_RU] || '',
    name_he:  rec.fields[FR_NAME_HE] || '',
    category: selectName(rec.fields[FR_CAT]),
    unit:     selectName(rec.fields[FR_UNIT]) || '',
    unit_qty: rec.fields[FR_UNIT_QTY] || null,
  })).filter(x => x.name_ru);
  return res.status(200).json({ recipes: list });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const airtableToken = (process.env.AIRTABLE_TOKEN || '').replace(/^﻿/, '').trim();
  const reqToken      = (req.query.token || '').trim();
  const role          = getRole(reqToken);

  if (!role)          return res.status(403).json({ error: 'Forbidden' });
  if (!airtableToken) return res.status(500).json({ error: 'Server misconfigured' });

  // Read-only for mashgiach
  if (role === 'mashgiach' && req.method !== 'GET')
    return res.status(403).json({ error: 'Mashgiach: read only' });

  try {
    if (req.method === 'GET') {
      if (req.query.recipes === '1') return handleRecipeList(res, airtableToken);
      return handleGet(req, res, airtableToken);
    }
    if (req.method === 'POST')  return handlePost(req, res, airtableToken, role);
    if (req.method === 'PATCH') return handlePatch(req, res, airtableToken, role);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[production]', err.message);
    return res.status(502).json({ error: 'Server error', detail: err.message });
  }
}
