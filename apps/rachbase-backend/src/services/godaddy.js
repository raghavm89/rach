'use strict';

/**
 * GoDaddy DNS client for auto domains, on the **v3 Domains API** (Bearer PAT).
 *
 * v3 replaced the old v1 `sso-key` (API key+secret) auth with a Personal Access
 * Token: `Authorization: Bearer <PAT>`. The v3 DNS Records API has only
 * list / create / delete (no replace-by-name), so an upsert = list existing A
 * records for the name, delete them, then create the new one. Changes are
 * synchronous. Server-side only.
 *
 * Env:
 *   GODADDY_PAT             — Personal Access Token, scopes: domains.dns:update
 *                             + domains.domain:read (developer.godaddy.com)
 *   RACHBASE_DOMAIN         — the registered zone (default rachbase.app)
 *   RACHBASE_APP_SUBDOMAIN  — optional namespace so customer apps live under
 *                             e.g. apps.rachbase.com without a separate domain.
 *                             When set to "apps", a sub becomes <sub>.apps.<root>.
 *   GODADDY_API_URL         — default https://api.godaddy.com
 */

const API    = (process.env.GODADDY_API_URL || 'https://api.godaddy.com').replace(/\/$/, '');
const ROOT   = process.env.RACHBASE_DOMAIN || 'rachbase.app';
const PREFIX = String(process.env.RACHBASE_APP_SUBDOMAIN || '').replace(/^\.+|\.+$/g, '');

function isConfigured() { return !!process.env.GODADDY_PAT; }
function domainRoot()   { return PREFIX ? `${PREFIX}.${ROOT}` : ROOT; }
function fqdn(sub)      { return PREFIX ? `${sub}.${PREFIX}.${ROOT}` : `${sub}.${ROOT}`; }
/** The record name relative to the registered zone (ROOT). */
function recordName(sub) { return PREFIX ? `${sub}.${PREFIX}` : sub; }

async function req(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GODADDY_PAT}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    const err = new Error(`GoDaddy ${res.status}: ${txt.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return res;
}

/** Existing A records for `name` in the zone (v3 list). */
async function listA(name) {
  const res  = await req('GET', `/v3/domains/zones/${ROOT}/dns-records?type=A&name=${encodeURIComponent(name)}`);
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data.items) ? data.items : [];
}

/** Create/replace the A record for `sub` → `ip` (list → delete existing → create). */
async function upsertARecord(sub, ip) {
  if (!isConfigured()) { const e = new Error('GoDaddy not configured'); e.status = 503; throw e; }
  const name = recordName(sub);
  for (const rec of await listA(name)) {
    if (rec.recordId) {
      await req('DELETE', `/v3/domains/zones/${ROOT}/dns-records/${encodeURIComponent(rec.recordId)}`).catch(() => {});
    }
  }
  await req('POST', `/v3/domains/zones/${ROOT}/dns-records`, { name, type: 'A', data: ip, ttl: 600 });
}

/** Delete the A record(s) for `sub` (ignores absence). */
async function deleteARecord(sub) {
  if (!isConfigured()) return;
  const name = recordName(sub);
  try {
    for (const rec of await listA(name)) {
      if (rec.recordId) {
        await req('DELETE', `/v3/domains/zones/${ROOT}/dns-records/${encodeURIComponent(rec.recordId)}`);
      }
    }
  } catch (e) {
    if (e.status !== 404) throw e;
  }
}

module.exports = { isConfigured, domainRoot, fqdn, upsertARecord, deleteARecord };
