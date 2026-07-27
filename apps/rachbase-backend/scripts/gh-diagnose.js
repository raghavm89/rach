'use strict';

/**
 * GitHub App connection diagnostic + manual link.
 *
 *   node scripts/gh-diagnose.js                 # report only
 *   node scripts/gh-diagnose.js --link <tenantId>  # link the installation to a tenant
 *
 * Run from apps/rachbase-backend (needs the same .env the backend uses).
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const crypto = require('crypto');

const APP_ID = process.env.GITHUB_APP_ID;
const NAME   = process.env.GITHUB_APP_NAME;
const KEY    = (process.env.GITHUB_APP_PRIVATE_KEY || '').replace(/\\n/g, '\n');

function buildJwt() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const body   = Buffer.from(JSON.stringify({ iat: now - 60, exp: now + 540, iss: APP_ID })).toString('base64url');
  const sig    = crypto.createSign('RSA-SHA256').update(`${header}.${body}`).sign(KEY, 'base64url');
  return `${header}.${body}.${sig}`;
}

async function gh(path, jwt) {
  const r = await fetch(`https://api.github.com${path}`, {
    headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'RachDiag' },
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

(async () => {
  console.log('APP_NAME =', JSON.stringify(NAME));
  console.log('APP_ID   =', JSON.stringify(APP_ID));
  console.log('KEY      =', KEY.includes('BEGIN') ? `PEM ok (${KEY.length} chars)` : `INVALID: ${JSON.stringify(KEY.slice(0, 40))}`);
  if (!APP_ID || !KEY.includes('BEGIN')) { console.log('\n=> Fix GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY in .env first.'); process.exit(1); }

  let jwt;
  try { jwt = buildJwt(); } catch (e) { console.log('\n=> JWT signing failed:', e.message); process.exit(1); }

  const app = await gh('/app', jwt);
  console.log('\nGET /app ->', app.status, app.status === 200 ? `(slug=${app.body.slug}, id=${app.body.id})` : JSON.stringify(app.body).slice(0, 200));
  if (app.status !== 200) { console.log('\n=> GitHub rejected the App JWT. App ID and private key likely belong to different apps.'); process.exit(1); }

  const inst = await gh('/app/installations?per_page=100', jwt);
  console.log('GET /app/installations ->', inst.status);
  const list = Array.isArray(inst.body) ? inst.body : [];
  console.log('  installations:', list.length);
  list.forEach((i) => console.log(`   - id=${i.id}  account=${i.account && i.account.login}  select=${i.repository_selection}  created=${i.created_at}`));

  if (list.length === 0) {
    console.log('\n=> No installations. The app was not actually installed on this account, OR it was installed on a DIFFERENT GitHub App than the one these creds point to. Reinstall from:');
    console.log(`   https://github.com/apps/${NAME}/installations/new`);
    process.exit(0);
  }

  const linkIdx = process.argv.indexOf('--link');
  if (linkIdx === -1) {
    console.log('\n=> Installation(s) visible to the backend. Reconcile WILL work.');
    console.log('   To link one to a tenant now:  node scripts/gh-diagnose.js --link <tenantId>');
    process.exit(0);
  }

  const pool = require('@rach/core').pool;

  const tenantId = Number(process.argv[linkIdx + 1]);
  if (!tenantId) {
    const { rows } = await pool.query('SELECT id, name FROM tenants ORDER BY id');
    console.log('\n=> Pass a tenant id: --link <tenantId>. Available tenants:');
    rows.forEach((t) => console.log(`   ${t.id}  ${t.name}`));
    await pool.end();
    process.exit(1);
  }
  const chosen = list.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

  await pool.query(
    `INSERT INTO deployment_github_installations (tenant_id, installation_id, github_account)
     VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id) DO UPDATE
       SET installation_id = EXCLUDED.installation_id, github_account = EXCLUDED.github_account, installed_at = NOW()`,
    [tenantId, chosen.id, chosen.account && chosen.account.login]
  );
  console.log(`\n=> Linked installation ${chosen.id} (${chosen.account && chosen.account.login}) to tenant ${tenantId}. Reload the deployment page.`);
  await pool.end();
})();
