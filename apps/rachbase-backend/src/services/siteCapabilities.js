'use strict';

/**
 * Deploy preflight — refuse a deploy that ARKA's site would reject at apply because its `App`
 * CRD is behind the fields we send (the `.spec.host: field not declared in schema` class of
 * 500). rachbase has no cluster access, so it learns the site's schema two ways:
 *
 *   1. AUTHORITATIVE — GET /v1/capabilities (contract): the site reports its contract version
 *      + the App-spec fields its CRD declares. Preferred once ARKA implements it.
 *   2. FALLBACK (works today) — a recent app.upsert that DEAD-LETTERED with a schema error in
 *      the outbox means the CRD is behind; block until the window clears (auto-recovers, since
 *      a blocked deploy can't otherwise prove the fix landed).
 *
 * Fail-OPEN when neither signal is available (can't verify → don't block), so this never
 * wedges deploys on a site that simply hasn't implemented the capabilities endpoint.
 */

const { pool } = require('@rach/core');
const client = require('./siteClient');

// The App-spec fields the deploy path sends that a stale CRD would prune/reject. Keep in sync
// with siteApp.enqueueAppUpsert / the App CRD in apps/site-controller/deploy/crds/app.yaml.
const REQUIRED_APP_FIELDS = ['host', 'desiredState', 'command', 'env', 'resources'];
const REQUIRED_CONTRACT_VERSION = Number(process.env.SITE_CONTRACT_VERSION) || 1;
const FAILURE_WINDOW_MIN = Number(process.env.SITE_SCHEMA_FAILURE_WINDOW_MIN) || 30;

// Pure: given a /v1/capabilities body, is the site's App schema compatible with what we send?
//   { ok: true }                          — verified compatible
//   { ok: false, missing, reason }        — verified behind → block
//   { ok: true, unknown: true }           — can't tell from caps (endpoint missing / no signal)
function checkAppCompat(caps) {
  if (!caps || caps.__notFound) return { ok: true, unknown: true };
  if (Array.isArray(caps.appSpecFields)) {
    const missing = REQUIRED_APP_FIELDS.filter((f) => !caps.appSpecFields.includes(f));
    if (missing.length) return { ok: false, missing, reason: fieldsReason(missing) };
    return { ok: true };
  }
  if (typeof caps.contractVersion === 'number') {
    if (caps.contractVersion < REQUIRED_CONTRACT_VERSION) {
      return { ok: false, missing: [], reason: `SpaceArk site contract v${caps.contractVersion} is behind — v${REQUIRED_CONTRACT_VERSION}+ required. Re-apply the App CRD (apps/site-controller/deploy/crds/app.yaml), then retry.` };
    }
    return { ok: true };
  }
  return { ok: true, unknown: true };
}

function fieldsReason(missing) {
  return `SpaceArk's App CRD is behind — it doesn't support: ${missing.join(', ')}. Ask ops to re-apply apps/site-controller/deploy/crds/app.yaml on the cluster, then retry the deploy.`;
}

// Fallback signal: a recent app.upsert that dead-lettered with a CRD schema rejection.
async function recentSchemaFailure(siteId, { windowMin = FAILURE_WINDOW_MIN } = {}) {
  const { rows } = await pool.query(
    `SELECT o.last_error FROM site_outbox o
       JOIN site_operations op ON op.operation_id = o.operation_id
      WHERE op.op_type = 'app.upsert' AND o.site_id = $1
        AND o.failed_at IS NOT NULL
        AND o.last_error ILIKE '%not declared in schema%'
        AND o.failed_at > NOW() - ($2 || ' minutes')::interval
      ORDER BY o.failed_at DESC LIMIT 1`,
    [siteId, String(windowMin)],
  );
  return rows[0] || null;
}

// Preflight a deploy to `siteId`. { ok } to proceed, { ok:false, reason, missing } to block (412).
async function preflightApp(siteId, { fetch = client.fetchCapabilities, checkFailure = recentSchemaFailure } = {}) {
  let caps = null;
  try { caps = await fetch({ siteId }); } catch { caps = null; }
  const compat = checkAppCompat(caps);
  if (!compat.ok) return compat;              // capabilities say: behind → block
  if (!compat.unknown) return compat;         // capabilities say: compatible → allow

  // Capabilities unavailable → fall back to observed dead-letters.
  try {
    const f = await checkFailure(siteId);
    if (f) return { ok: false, missing: [], reason: `Deploys are paused: a recent deploy to this site was rejected by ARKA — "${f.last_error}". This usually means the App CRD is out of date; re-apply it, then retry.` };
  } catch { /* fallback is best-effort */ }
  return { ok: true, unknown: true };
}

module.exports = { REQUIRED_APP_FIELDS, REQUIRED_CONTRACT_VERSION, checkAppCompat, recentSchemaFailure, preflightApp };
