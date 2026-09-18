'use strict';

/**
 * Global claimed-hosts registry (go-live audit P0 #7).
 *
 * ONE authority for every public hostname under *.rachbase.app (and custom domains), across all
 * three namespaces — VM auto-domains, shared-container hosts, and BaaS project refs. Every claim
 * path reserves the hostname HERE first, so a claim in one namespace collides with a claim in any
 * other (the old per-namespace unique indexes couldn't see each other, which is what let one
 * tenant claim — and DNS-hijack — another tenant's host).
 *
 * `claim` is idempotent for the SAME owner (re-deploys, retries) and a hard conflict for a
 * different owner. Every function accepts an optional pg client so it can run inside the caller's
 * transaction.
 */

const { pool } = require('@rach/core');

const norm = (h) => String(h || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

/**
 * Reserve `hostname` for (tenantId, kind, ref). Returns:
 *   { claimed:true,  owner }          — newly reserved (or already owned by this same ref)
 *   { claimed:false, owner }          — held by someone else (owner has the current row)
 * `owner` is { tenant_id, kind, ref } (or null on a brand-new claim we just wrote).
 */
async function claim({ hostname, tenantId = null, kind, ref = null }, client = pool) {
  const host = norm(hostname);
  if (!host) throw Object.assign(new Error('hostname required'), { status: 400 });
  const refStr = ref == null ? null : String(ref);

  const ins = await client.query(
    `INSERT INTO claimed_hosts (hostname, tenant_id, kind, ref)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (hostname) DO NOTHING
     RETURNING hostname`,
    [host, tenantId, kind, refStr]
  );
  if (ins.rows.length) return { claimed: true, owner: null };

  // Already present → decide if it's ours (idempotent) or a real conflict.
  const { rows } = await client.query(
    'SELECT tenant_id, kind, ref FROM claimed_hosts WHERE hostname = $1', [host]
  );
  const owner = rows[0] || null;
  const ours = owner && String(owner.kind) === String(kind) && String(owner.ref) === refStr && refStr != null;
  // A legacy backfill row for the same resource may have a NULL tenant_id — adopt it.
  if (ours && owner.tenant_id == null && tenantId != null) {
    await client.query('UPDATE claimed_hosts SET tenant_id = $2 WHERE hostname = $1', [host, tenantId]);
  }
  return { claimed: Boolean(ours), owner };
}

/** Release a hostname outright. */
async function release({ hostname }, client = pool) {
  const host = norm(hostname);
  if (!host) return 0;
  const { rowCount } = await client.query('DELETE FROM claimed_hosts WHERE hostname = $1', [host]);
  return rowCount;
}

/** Release every hostname owned by a (kind, ref) — e.g. when a service is deleted. */
async function releaseByRef({ kind, ref }, client = pool) {
  if (ref == null) return 0;
  const { rowCount } = await client.query(
    'DELETE FROM claimed_hosts WHERE kind = $1 AND ref = $2', [kind, String(ref)]
  );
  return rowCount;
}

/** True when the hostname is unclaimed or already owned by this tenant. */
async function isAvailableFor(hostname, tenantId, client = pool) {
  const host = norm(hostname);
  const { rows } = await client.query('SELECT tenant_id FROM claimed_hosts WHERE hostname = $1', [host]);
  if (!rows.length) return true;
  return rows[0].tenant_id != null && Number(rows[0].tenant_id) === Number(tenantId);
}

module.exports = { claim, release, releaseByRef, isAvailableFor, norm };
