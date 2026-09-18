'use strict';

/**
 * Site registry CLI — register / list / disable the site-controllers the BFF can address.
 * This replaced the global SITE_API_URL: a tenant's `tenants.site_id` selects a row here.
 *
 * Usage (run from apps/rachbase-backend):
 *   node scripts/site-upsert.js list
 *   node scripts/site-upsert.js upsert --site-id site1 --api-url https://api.site1.example/v1 \
 *        [--audience spaceark-site-api:site1] [--issuer https://issuer...] [--ca-file ./ca.crt] [--disabled]
 *   node scripts/site-upsert.js disable --site-id site1
 *
 * The PARTNER identity (mTLS client cert/key + OAuth key) is NOT set here — it stays in the
 * secret store / env (MTLS_CERT(_FILE), MTLS_KEY(_FILE), MTLS_CA(_FILE), OAUTH_PRIVATE_KEY(_FILE)).
 */

const fs = require('fs');
const path = require('path');
// Load the backend's own .env (DB_HOST/DB_NAME/…) no matter the current working directory,
// so `node apps/rachbase-backend/scripts/site-upsert.js …` works from the repo root too.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const reg = require('../src/services/siteRegistry');

// Minimal --flag value parser.
function parseFlags(argv) {
  const f = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) { f[key] = true; }
    else { f[key] = next; i++; }
  }
  return f;
}

function pretty(sites) {
  if (!sites.length) { console.log('(no sites registered)'); return; }
  for (const s of sites) {
    console.log(`- ${s.siteId}${s.enabled ? '' : ' [disabled]'}  →  ${s.apiUrl}` +
      `${s.audience ? `  aud=${s.audience}` : ''}${s.issuer ? `  iss=${s.issuer}` : ''}${s.ca ? '  (per-site CA)' : ''}`);
  }
}

(async () => {
  const [cmd, ...rest] = process.argv.slice(2);
  const f = parseFlags(rest);

  if (cmd === 'list') {
    pretty(await reg.listSites());
    return;
  }

  if (cmd === 'upsert') {
    if (!f['site-id'] || !f['api-url']) {
      console.error('upsert needs --site-id and --api-url'); process.exitCode = 1; return;
    }
    const caPem = f['ca-file'] ? fs.readFileSync(f['ca-file'], 'utf8') : null;
    const site = await reg.upsertSite({
      siteId: String(f['site-id']),
      apiUrl: String(f['api-url']),
      audience: f.audience ? String(f.audience) : null,
      issuer: f.issuer ? String(f.issuer) : null,
      caPem,
      enabled: !f.disabled,
    });
    console.log('upserted:'); pretty([site]);
    return;
  }

  if (cmd === 'disable') {
    if (!f['site-id']) { console.error('disable needs --site-id'); process.exitCode = 1; return; }
    const [existing] = (await reg.listSites()).filter((s) => s.siteId === String(f['site-id']));
    if (!existing) { console.error(`site "${f['site-id']}" not found`); process.exitCode = 1; return; }
    const site = await reg.upsertSite({ siteId: existing.siteId, apiUrl: existing.apiUrl, audience: existing.audience, issuer: existing.issuer, caPem: existing.ca, enabled: false });
    console.log('disabled:'); pretty([site]);
    return;
  }

  console.error('Usage: site-upsert.js <list|upsert|disable> [--flags]  (see file header)');
  process.exitCode = 1;
})().then(() => process.exit()).catch((e) => { console.error(e.message); process.exit(1); });
