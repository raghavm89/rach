'use strict';

/**
 * Site registry (multi-site routing). Maps a `site_id` → the site-controller's base URL
 * + per-site trust/JWT hints (`sites` table, migration 108). This replaces the single
 * global `SITE_API_URL`: every tenant carries `tenants.site_id`, every outbox/operation
 * row is stamped with it, and `resolveSite(siteId)` turns it into a delivery target.
 *
 * The PARTNER identity (mTLS client cert/key + OAuth private key) is shared across sites
 * and stays in the secret store (see `siteAuth`); only the address + public trust anchor
 * + audience/issuer are per-site here.
 */

const { pool } = require('@rach/core');

// Small in-process cache so the hot delivery path doesn't hit the DB per row. Short TTL;
// upsert clears it. Value `null` is NOT cached (missing rows should re-check promptly).
const TTL_MS = Number(process.env.SITE_REGISTRY_TTL_MS) || 30000;
const cache = new Map(); // siteId → { site, expires }

function shape(row) {
  if (!row) return null;
  return {
    siteId: row.site_id,
    apiUrl: row.api_url,
    audience: row.audience || null,
    issuer: row.issuer || null,
    ca: row.ca_pem || null,
    ingressIp: row.ingress_ip || null, // per-site public ingress IP (auto-DNS target)
    enabled: row.enabled !== false,
  };
}

/**
 * Resolve a site to `{ siteId, apiUrl, audience, issuer, ca, enabled }` or `null` when no
 * enabled row exists. Throws only on a DB error (so the caller can retry rather than treat
 * a transient outage as "no site"). A falsy `siteId` returns `null` (unplaced tenant).
 */
async function resolveSite(siteId) {
  if (!siteId) return null;
  const hit = cache.get(siteId);
  if (hit && hit.expires > Date.now()) return hit.site;
  const { rows } = await pool.query('SELECT * FROM sites WHERE site_id = $1 AND enabled = TRUE', [siteId]);
  const site = shape(rows[0]);
  if (site) cache.set(siteId, { site, expires: Date.now() + TTL_MS });
  else cache.delete(siteId);
  return site;
}

/** Create or update a site row (idempotent). Clears the cache entry. */
async function upsertSite({ siteId, apiUrl, audience = null, issuer = null, caPem = null, ingressIp = null, enabled = true }) {
  if (!siteId || !apiUrl) throw new Error('upsertSite: siteId and apiUrl are required');
  const { rows } = await pool.query(
    `INSERT INTO sites (site_id, api_url, audience, issuer, ca_pem, ingress_ip, enabled)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (site_id) DO UPDATE
        SET api_url = EXCLUDED.api_url, audience = EXCLUDED.audience, issuer = EXCLUDED.issuer,
            ca_pem = EXCLUDED.ca_pem, ingress_ip = EXCLUDED.ingress_ip, enabled = EXCLUDED.enabled, updated_at = NOW()
     RETURNING *`,
    [siteId, apiUrl, audience, issuer, caPem, ingressIp, enabled],
  );
  cache.delete(siteId);
  return shape(rows[0]);
}

async function listSites() {
  const { rows } = await pool.query('SELECT * FROM sites ORDER BY site_id');
  return rows.map(shape);
}

/** Test/ops hook to drop the cache (e.g. after a direct DB change). */
function clearCache() { cache.clear(); }

module.exports = { resolveSite, upsertSite, listSites, clearCache, shape };
