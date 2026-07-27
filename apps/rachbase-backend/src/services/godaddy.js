'use strict';

/**
 * GoDaddy DNS client for auto domains `<name>.rachbase.com` (PaaS phase 4).
 *
 * Manages A records in the rachbase.com zone via GoDaddy's Domains API. Used to
 * point an auto-generated subdomain at a VM's IP; Caddy on the VM then issues
 * HTTPS over HTTP-01. Server-side only.
 *
 * Env:
 *   GODADDY_API_KEY, GODADDY_API_SECRET  — production key on the rachbase.com account
 *   RACHBASE_DOMAIN                       — zone root (default rachbase.com)
 *   GODADDY_API_URL                       — default https://api.godaddy.com
 */

const API    = (process.env.GODADDY_API_URL || 'https://api.godaddy.com').replace(/\/$/, '');
const ROOT   = process.env.RACHBASE_DOMAIN || 'rachbase.com';

function isConfigured() { return !!(process.env.GODADDY_API_KEY && process.env.GODADDY_API_SECRET); }
function domainRoot()   { return ROOT; }
function fqdn(sub)      { return `${sub}.${ROOT}`; }

async function req(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `sso-key ${process.env.GODADDY_API_KEY}:${process.env.GODADDY_API_SECRET}`,
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

/** Create/replace the A record for `name` → `ip` in the zone. */
async function upsertARecord(name, ip) {
  if (!isConfigured()) { const e = new Error('GoDaddy not configured'); e.status = 503; throw e; }
  await req('PUT', `/v1/domains/${ROOT}/records/A/${encodeURIComponent(name)}`, [{ data: ip, ttl: 600 }]);
}

/** Delete the A record for `name` (ignores 404). */
async function deleteARecord(name) {
  if (!isConfigured()) return;
  try {
    await req('DELETE', `/v1/domains/${ROOT}/records/A/${encodeURIComponent(name)}`);
  } catch (e) {
    if (e.status !== 404) throw e;
  }
}

module.exports = { isConfigured, domainRoot, fqdn, upsertARecord, deleteARecord };
