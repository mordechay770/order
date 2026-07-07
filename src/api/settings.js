/**
 * GET  /api/settings          — return admin settings JSON from Airtable
 * POST /api/settings          — save admin settings JSON to Airtable
 *
 * Auth: Authorization: Bearer <ADMIN_PASSWORD>
 *
 * Requires env vars:
 *   ADMIN_PASSWORD       — for auth
 *   AIRTABLE_TOKEN       — Airtable API token
 *   SETTINGS_TABLE_ID    — e.g. tblXXXXXXXXXXXXXX  (table "Settings")
 *   SETTINGS_RECORD_ID   — e.g. recXXXXXXXXXXXXXX  (the single settings record)
 *   SETTINGS_FIELD_ID    — e.g. fldXXXXXXXXXXXXXX  (long-text field "Value")
 *
 * If SETTINGS_TABLE_ID / SETTINGS_RECORD_ID / SETTINGS_FIELD_ID are not set,
 * GET returns 404 and POST returns { ok: true, saved: false } (graceful no-op).
 */

import { getRecord, updateRecord } from '../lib/db.js';

function isAuthorized(req) {
  const auth  = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const adminPwd = (process.env.ADMIN_PASSWORD || '').trim();
  return adminPwd && auth === adminPwd;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });

  const tableId  = (process.env.SETTINGS_TABLE_ID  || '').trim();
  const recordId = (process.env.SETTINGS_RECORD_ID || '').trim();
  const fieldId  = (process.env.SETTINGS_FIELD_ID  || '').trim();

  const configured = tableId && recordId && fieldId;

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    if (!configured) return res.status(404).json({ error: 'Settings storage not configured' });

    const data = await getRecord(tableId, recordId).catch(() => null);

    if (!data) return res.status(502).json({ error: 'Airtable error' });

    const raw  = (data.fields || {})[fieldId] || '';
    if (!raw) return res.status(404).json({ error: 'No settings stored yet' });

    try {
      return res.status(200).json({ ok: true, settings: JSON.parse(raw) });
    } catch {
      return res.status(500).json({ error: 'Settings JSON corrupted' });
    }
  }

  // ── POST ─────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    if (!configured) return res.status(200).json({ ok: true, saved: false, reason: 'not_configured' });

    const body = req.body;
    if (!body || typeof body !== 'object') return res.status(400).json({ error: 'JSON body required' });

    const json = JSON.stringify(body);
    const r = await updateRecord(tableId, recordId, { [fieldId]: json }).catch(() => null);

    if (!r) return res.status(502).json({ error: 'Airtable write error' });

    return res.status(200).json({ ok: true, saved: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
