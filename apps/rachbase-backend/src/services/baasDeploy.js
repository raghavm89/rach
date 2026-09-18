'use strict';

/**
 * Deploy a project's BaaS bundle (Phase 3). Turns `baasBundle` specs into App upserts on the
 * tenant's SpaceArk site (reusing the normal App/deploy path): the gateway is public at
 * `<ref>.rachbase.app`; the primitives (auth/rest/storage/functions) are internal Services it
 * proxies to. Each App carries its image (deployed directly) + env; env values (incl. the project
 * secret + DB URL) ride the App CRD → per-app Secret + envFrom (the hardening we built).
 *
 * Idempotent (App upsert is create-or-replace). Deploy is DEFERRED when the tenant isn't placed on
 * a site yet or no primitive images are configured — enableBaas reports that; a later POST
 * /baas/deploy fires it once SpaceArk + images are ready. Injectable pool/enqueue for testing.
 */

const { pool } = require('@rach/core');
const { proPricing } = require('@rach/billing');
const { bundleSpecs, imagesFromEnv } = require('./baasBundle');
const { enqueueAppUpsert } = require('./siteApp');

const APPS_DOMAIN = process.env.APPS_DOMAIN || 'rachbase.app';

async function deployBundle({ tenantId, ref, secret, databaseUrl, signing = null, authEnv = {}, storageEnv = {}, computeSize = 'nano', ownerName = null, images = imagesFromEnv() }, deps = {}) {
  const db = deps.pool || pool;
  const enqueue = deps.enqueue || enqueueAppUpsert;

  const specs = bundleSpecs({ ref, secret, databaseUrl, images, signing, authEnv, storageEnv });
  if (!specs.length) return { deployed: 0, deferred: 'no_images_configured' };

  // Every backend container runs at the project's chosen compute size (server-side authority —
  // a container can't request more CPU/RAM than the plan paid for).
  const resources = proPricing.resourcesForSize(computeSize);

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT id, site_id, site_tenant_ref FROM tenants WHERE id = $1 FOR UPDATE', [tenantId]);
    const t = rows[0];
    if (!t || !t.site_tenant_ref) { await client.query('ROLLBACK'); return { deployed: 0, deferred: 'tenant_not_placed' }; }

    const ops = [];
    for (const s of specs) {
      // Host is always sent; the site controller annotates it (schema-safe) and only writes
      // spec.host when its CRD supports it (SITE_APP_SPEC_HOST). Only the gateway is public.
      const host = s.public ? `${ref}.${APPS_DOMAIN}` : null;
      const r = await enqueue(client, {
        tenantRef: t.site_tenant_ref, appId: s.appId, tenantId, siteId: t.site_id,
        image: s.image, port: s.port, env: s.env, host, owner: ownerName, resources,
      });
      ops.push({ role: s.role, appId: s.appId, host, operationId: r && r.operationId });
    }
    await client.query('COMMIT');
    return { deployed: specs.length, gatewayHost: `${ref}.${APPS_DOMAIN}`, ops };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { deployBundle };
