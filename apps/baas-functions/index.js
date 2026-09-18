'use strict';

/**
 * BaaS Functions control plane. Behind the per-project gateway at /functions/v1/*. Stores/serves
 * function code + secrets (project DB); invocation runs in the adopted Deno runner (DENO_RUNNER_URL).
 * We own deploy/list/delete/invoke-dispatch; the isolate sandbox is the runner's.
 *
 * Env: PROJECT_REF, PROJECT_JWT_SECRET, DATABASE_URL, DENO_RUNNER_URL, PORT (8080).
 * Routes (gateway strips /functions):
 *   POST   /v1/deploy {name,code,secrets?}   (service_role)  → deploy
 *   GET    /v1/functions                                     → list (no code/secrets)
 *   DELETE /v1/functions/:name                (service_role) → remove
 *   POST   /v1/:name  {..payload..}                          → invoke (dispatch to the runner)
 */

require('dotenv').config();
const http = require('http');
const https = require('https');
const { makeRegistry } = require('./src/registry');
const { roleFromRequest } = require('./src/internalToken');

const send = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body ?? {})); };
const readJson = (req) => new Promise((r) => { let b = ''; req.on('data', (d) => { b += d; }); req.on('end', () => { try { r(b ? JSON.parse(b) : {}); } catch { r(null); } }); });

// Request handler (standalone OR mounted in the combined baas-services container).
function makeFunctionsHandler({ ref, secret, registry, runnerUrl }) {
  return async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      if (url.pathname === '/' || url.pathname === '/healthz') return send(res, 200, { service: 'baas-functions', ref: ref || null, ready: Boolean(registry) });
      if (!registry) return send(res, 503, { error: 'FUNCTIONS_NOT_CONFIGURED' });
      // Role from the gateway's VERIFIED internal token, never the spoofable x-baas-role
      // header (src/internalToken.js). Functions is the highest-value primitive to protect:
      // service_role here deploys arbitrary code, reads stored source, and — since invoke
      // injects the project's secrets map into the function env — exfiltrates every project
      // secret. The storage/auth conversion (audit M3) had missed this service (audit #3, F2).
      const role = roleFromRequest(req, { secret, ref });
      const isService = role === 'service_role';

      if (req.method === 'POST' && url.pathname === '/v1/deploy') {
        if (!isService) return send(res, 403, { error: 'forbidden' });
        const body = await readJson(req); if (!body) return send(res, 400, { error: 'invalid_json' });
        try { return send(res, 201, { function: await registry.deploy(body) }); }
        catch (e) { return send(res, 400, { error: e.message }); }
      }
      if (req.method === 'GET' && url.pathname === '/v1/functions') {
        return send(res, 200, { functions: await registry.list() });
      }
      // Project-level function secrets (service_role). Values are never returned — only digests.
      if (url.pathname === '/v1/secrets') {
        if (!isService) return send(res, 403, { error: 'forbidden' });
        if (req.method === 'GET') return send(res, 200, { secrets: await registry.listSecrets() });
        if (req.method === 'POST') {
          const body = await readJson(req); if (!body) return send(res, 400, { error: 'invalid_json' });
          try { return send(res, 200, { saved: await registry.setSecrets(body.secrets) }); }
          catch (e) { return send(res, 400, { error: e.message }); }
        }
      }
      const delSecret = /^\/v1\/secrets\/([A-Za-z_][A-Za-z0-9_]{0,127})$/.exec(url.pathname);
      if (req.method === 'DELETE' && delSecret) {
        if (!isService) return send(res, 403, { error: 'forbidden' });
        return send(res, (await registry.deleteSecret(delSecret[1])) ? 200 : 404, { deleted: delSecret[1] });
      }
      const getFn = /^\/v1\/functions\/([a-z0-9][a-z0-9-]{0,61})$/.exec(url.pathname);
      if (req.method === 'GET' && getFn) {
        if (!isService) return send(res, 403, { error: 'forbidden' });
        const fn = await registry.get(getFn[1]);
        return fn ? send(res, 200, { function: { name: fn.name, code: fn.code, version: fn.version } }) : send(res, 404, { error: 'function_not_found' });
      }
      const del = /^\/v1\/functions\/([a-z0-9][a-z0-9-]{0,61})$/.exec(url.pathname);
      if (req.method === 'DELETE' && del) {
        if (!isService) return send(res, 403, { error: 'forbidden' });
        return send(res, (await registry.remove(del[1])) ? 200 : 404, { deleted: del[1] });
      }

      // Invoke: POST /v1/<name>
      const inv = /^\/v1\/([a-z0-9][a-z0-9-]{0,61})$/.exec(url.pathname);
      if (req.method === 'POST' && inv) {
        const fn = await registry.get(inv[1]);
        if (!fn) return send(res, 404, { error: 'function_not_found' });
        if (!runnerUrl) return send(res, 503, { error: 'RUNTIME_NOT_PROVISIONED' });
        const payload = await readJson(req);
        // Env available to the function: reserved defaults + project secrets + per-function secrets.
        const projectSecrets = await registry.secretsMap();
        const secrets = { RACHBASE_URL: process.env.PROJECT_URL || '', RACHBASE_REF: ref, ...projectSecrets, ...fn.secrets };
        const dispatch = JSON.stringify({ code: fn.code, secrets, identity: { role, ref }, request: { body: payload, query: Object.fromEntries(url.searchParams) } });
        const target = new URL('/invoke', runnerUrl);
        const client = target.protocol === 'https:' ? https : http;
        const preq = client.request(target, { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(dispatch) } }, (pr) => { res.writeHead(pr.statusCode, pr.headers); pr.pipe(res); });
        preq.on('error', () => send(res, 502, { error: 'runtime_unreachable' }));
        preq.end(dispatch);
        return;
      }
      return send(res, 404, { error: 'not_found' });
    } catch (e) { return send(res, 500, { error: 'internal', message: e.message }); }
  };
}
function createFunctionsServer(opts) { return http.createServer(makeFunctionsHandler(opts)); }

async function main() {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  // Idle-client errors EMIT on the pool; unhandled they crash the process (audit F14).
  pool.on('error', (err) => console.error('[baas-functions] pg pool error (continuing):', err.message));
  const registry = makeRegistry(pool);
  await registry.ensureSchema();
  const server = createFunctionsServer({ ref: process.env.PROJECT_REF || '', secret: process.env.PROJECT_JWT_SECRET || '', registry, runnerUrl: process.env.DENO_RUNNER_URL || null });
  server.listen(Number(process.env.PORT) || 8080, () => console.log(`[baas-functions] ref=${process.env.PROJECT_REF || '?'} up`));
  // Graceful shutdown so rollouts don't drop in-flight requests (audit F14).
  const shutdown = () => { console.log('[baas-functions] shutting down'); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 8000).unref(); };
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}
if (require.main === module) main().catch((e) => { console.error('[baas-functions] fatal:', e.message); process.exit(1); });

module.exports = { createFunctionsServer, makeFunctionsHandler };
