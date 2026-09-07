'use strict';

/**
 * Combined BaaS services (Phase 3): Auth + Storage + Functions in ONE container. The per-project
 * gateway forwards `x-baas-primitive` (auth|storage|functions); this server dispatches to the
 * matching sub-handler. All three share the project database (DATABASE_URL). This cuts a project's
 * container footprint to 3 (gateway + this + PostgREST) so it fits the Pro plan's 3 included.
 *
 * Env (same union the three services read):
 *   PROJECT_REF, PROJECT_JWT_SECRET, DATABASE_URL, PORT (8080)
 *   Auth: PROJECT_SIGN_*, ALLOW_*, CONFIRM_EMAIL, JWT_EXPIRY, REFRESH_*, RATE_*, SITE_URL,
 *         AUTH_PROVIDERS_JSON, OAUTH_*, PROJECT_URL, BREVO_API_KEY/SENDER
 *   Storage:   SEAWEEDFS_FILER_URL
 *   Functions: DENO_RUNNER_URL
 */

require('dotenv').config();
const http = require('http');
const { makeAuthHandler } = require('@rach/baas-auth');
const { makeStorageHandler } = require('@rach/baas-storage');
const { makeStore: makeStorageStore } = require('@rach/baas-storage/src/store');
const { makeFunctionsHandler } = require('@rach/baas-functions');
const { makeRegistry } = require('@rach/baas-functions/src/registry');
const { makeStore: makeAuthStore } = require('@rach/baas-auth/src/store');
const { makeBrevoMailer } = require('@rach/baas-auth/src/mailer');

const send = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body ?? {})); };

// Build the combined server from explicit handlers (testable without env/pg).
function createServicesServer({ handlers }) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/' || url.pathname === '/healthz') return send(res, 200, { service: 'baas-services', primitives: Object.keys(handlers) });
    const primitive = req.headers['x-baas-primitive'];
    const handler = primitive && handlers[primitive];
    if (!handler) return send(res, 404, { error: 'unknown_primitive', primitive: primitive || null });
    return handler(req, res);
  });
}

async function main() {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  // Idle-client errors EMIT on the pool; unhandled they crash the process — a DB blip used
  // to take the whole project's data plane down at once (go-live audit F14).
  pool.on('error', (err) => console.error('[baas-services] pg pool error (continuing):', err.message));
  const ref = process.env.PROJECT_REF || '';
  const secret = process.env.PROJECT_JWT_SECRET || '';

  // Each sub-service gets its own store over the shared project DB.
  const authStore = makeAuthStore(pool);
  const storageStore = makeStorageStore(pool);
  const registry = makeRegistry(pool);
  await authStore.ensureSchema();
  await storageStore.ensureSchema();
  await registry.ensureSchema();

  const signingKey = process.env.PROJECT_SIGN_PRIVATE_KEY
    ? { privatePem: process.env.PROJECT_SIGN_PRIVATE_KEY, publicPem: process.env.PROJECT_SIGN_PUBLIC_KEY || null, kid: process.env.PROJECT_SIGN_KID || null }
    : null;
  let providers = {}; try { providers = process.env.AUTH_PROVIDERS_JSON ? JSON.parse(process.env.AUTH_PROVIDERS_JSON) : {}; } catch { /* ignore */ }
  const mailer = makeBrevoMailer({ apiKey: process.env.BREVO_API_KEY, sender: process.env.BREVO_SENDER });

  const authHandler = makeAuthHandler({
    ref, secret, store: authStore, signingKey, mailer,
    config: {
      allowSignups: process.env.ALLOW_SIGNUPS !== 'false',
      allowAnonymous: process.env.ALLOW_ANONYMOUS === 'true',
      confirmEmail: process.env.CONFIRM_EMAIL === 'true',
      ttlSec: Number(process.env.JWT_EXPIRY) || 0,
      refreshRotation: process.env.REFRESH_ROTATION !== 'false',
      refreshReuseInterval: Number(process.env.REFRESH_REUSE_INTERVAL) || 0,
      rateSigninPer5min: Number(process.env.RATE_SIGNIN_PER_5MIN) || 0,
      rateTokenRefreshPer5min: Number(process.env.RATE_TOKEN_REFRESH_PER_5MIN) || 0,
      rateAnonPerHour: Number(process.env.RATE_ANON_PER_HOUR) || 0,
      projectUrl: process.env.PROJECT_URL || (ref ? `https://${ref}.${process.env.APPS_DOMAIN || 'rachbase.app'}` : ''),
      siteUrl: process.env.SITE_URL || '',
      providers,
      oauthServer: {
        enabled: process.env.OAUTH_SERVER_ENABLED === 'true',
        authorizationPath: process.env.OAUTH_AUTHORIZATION_PATH || '/oauth/consent',
        allowDynamic: process.env.OAUTH_ALLOW_DYNAMIC === 'true',
      },
    },
  });
  const storageHandler = makeStorageHandler({ ref, secret, store: storageStore, filerUrl: process.env.SEAWEEDFS_FILER_URL || null, maxObjectBytes: Number(process.env.FILE_SIZE_LIMIT) || 0 });
  const functionsHandler = makeFunctionsHandler({ ref, secret, registry, runnerUrl: process.env.DENO_RUNNER_URL || null });

  const server = createServicesServer({ handlers: { auth: authHandler, storage: storageHandler, functions: functionsHandler } });
  server.listen(Number(process.env.PORT) || 8080, () => console.log(`[baas-services] ref=${ref || '?'} up (auth+storage+functions)`));
  // Graceful shutdown so rollouts don't drop in-flight requests (audit F14).
  const shutdown = () => { console.log('[baas-services] shutting down'); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 8000).unref(); };
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}

if (require.main === module) main().catch((e) => { console.error('[baas-services] fatal:', e.message); process.exit(1); });

module.exports = { createServicesServer };
