'use strict';

/**
 * BaaS Auth HTTP server. Sits behind the per-project gateway at /auth/v1/*. Stateless service;
 * user data lives in the PROJECT database (DATABASE_URL). Configured per project via env:
 *   PROJECT_REF, PROJECT_JWT_SECRET, DATABASE_URL, PORT (default 8080).
 *
 * Routes (the gateway strips the /auth prefix, so the service sees /v1/*):
 *   POST /v1/signup {email,password}   → 201 session
 *   POST /v1/token  {email,password}   → 200 session   (login)
 *   GET  /v1/user   (Bearer <token>)   → 200 user
 */

require('dotenv').config();
const http = require('http');
const auth = require('./src/auth');
const { makeStore } = require('./src/store');
const { makeBrevoMailer } = require('./src/mailer');
const { makeLimiter, clientIp } = require('./src/rateLimit');
const { roleFromRequest } = require('./src/internalToken');

const send = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body ?? {})); };
const bearer = (h) => { const m = /^Bearer\s+(.+)$/i.exec(h.authorization || ''); return (m && m[1]) || null; };

function readJson(req) {
  return new Promise((resolve) => { let b = ''; req.on('data', (d) => { b += d; }); req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch { resolve(null); } }); });
}

// Accept JSON or application/x-www-form-urlencoded (OAuth token/register clients use the latter).
function readBody(req) {
  return new Promise((resolve) => {
    let b = ''; req.on('data', (d) => { b += d; });
    req.on('end', () => {
      const ct = String(req.headers['content-type'] || '');
      if (ct.includes('application/x-www-form-urlencoded')) return resolve(Object.fromEntries(new URLSearchParams(b)));
      try { resolve(b ? JSON.parse(b) : {}); } catch { resolve(null); }
    });
  });
}

// Build the server from explicit config + store (testable without env/pg).
// `signingKey` = { privatePem, publicPem, kid } enables asymmetric (ES256) session tokens.
// `allowSignups`/`ttlSec` come from the project's control-plane Auth config.
// Request handler (standalone OR mounted in the combined baas-services container).
function makeAuthHandler({ ref, secret, store, signingKey = null, config = {}, mailer = null }) {
  const ctx = {
    ref, secret, signingKey,
    allowSignups: config.allowSignups !== false,
    allowAnonymous: Boolean(config.allowAnonymous),
    confirmEmail: Boolean(config.confirmEmail),
    ttlSec: Number(config.ttlSec) || 0,
    refreshRotation: config.refreshRotation !== false,
    refreshReuseInterval: Number(config.refreshReuseInterval) || 0,
    projectUrl: config.projectUrl || '',    // public gateway URL (for confirm/callback links)
    siteUrl: config.siteUrl || '',          // app URL to redirect to after confirm/OAuth
    redirectAllowList: Array.isArray(config.redirectAllowList) ? config.redirectAllowList : [], // extra allowed return URLs/origins
    providers: config.providers || {},      // per-project provider config (client_id/secret)
    oauthServer: {                           // project-as-IdP settings
      enabled: Boolean(config.oauthServer?.enabled),
      authorizationPath: config.oauthServer?.authorizationPath || '/oauth/consent',
      allowDynamic: Boolean(config.oauthServer?.allowDynamic),
    },
    mailer,                                  // async ({to,subject,htmlContent}) => …  (or null)
    mailerConfigured: Boolean(mailer),
  };

  // Rate limiters (per-IP, sliding window) for the brute-force-prone endpoints. Points come from
  // the project's rate-limit config; windows are 5 minutes (except anon which is hourly).
  const WIN5 = 5 * 60_000;
  const limiters = {
    signin: makeLimiter({ points: Number(config.rateSigninPer5min) || 30, windowMs: WIN5 }),
    refresh: makeLimiter({ points: Number(config.rateTokenRefreshPer5min) || 150, windowMs: WIN5 }),
    anon: makeLimiter({ points: Number(config.rateAnonPerHour) || 30, windowMs: 60 * 60_000 }),
    oauth: makeLimiter({ points: Number(config.rateOauthPer5min) || 60, windowMs: WIN5 }),
  };
  // Returns true (and sends 429) when the caller is over the limit.
  const limited = (req, res, name) => {
    const r = limiters[name].hit(clientIp(req));
    if (r.allowed) return false;
    res.writeHead(429, { 'content-type': 'application/json', 'retry-after': String(Math.ceil(r.retryAfterMs / 1000)) });
    res.end(JSON.stringify({ error: 'rate_limited', message: 'Too many requests. Try again later.' }));
    return true;
  };
  return async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      if (url.pathname === '/' || url.pathname === '/healthz') return send(res, 200, { service: 'baas-auth', ref: ref || null, ready: Boolean(ref && secret && store) });
      if (!ref || !secret || !store) return send(res, 503, { error: 'AUTH_NOT_CONFIGURED' });

      if (req.method === 'POST' && url.pathname === '/v1/signup') {
        if (limited(req, res, 'signin')) return;
        const body = await readJson(req); if (!body) return send(res, 400, { error: 'invalid_json' });
        const r = await auth.signup(store, ctx, body); return send(res, r.status, r.body);
      }
      if (req.method === 'POST' && url.pathname === '/v1/signup/anonymous') {
        if (limited(req, res, 'anon')) return;
        const r = await auth.signupAnonymous(store, ctx); return send(res, r.status, r.body);
      }
      if (req.method === 'POST' && url.pathname === '/v1/verify') {
        const body = await readJson(req); if (!body) return send(res, 400, { error: 'invalid_json' });
        const r = await auth.verifyEmail(store, ctx, body); return send(res, r.status, r.body);
      }
      // Clickable confirmation link (from the email): confirm, then redirect to the app with the
      // session in the URL fragment (Supabase-style), or return JSON when no redirect is given.
      if (req.method === 'GET' && url.pathname === '/v1/verify') {
        const r = await auth.verifyEmail(store, ctx, { token: url.searchParams.get('token') });
        // Only honour an allow-listed redirect; anything else falls back to the project site URL,
        // so a crafted verify link can't leak the session tokens to an attacker origin.
        const redirectTo = auth.safeRedirect(url.searchParams.get('redirect_to') || ctx.siteUrl, ctx);
        if (r.status === 200 && redirectTo) {
          const frag = `access_token=${encodeURIComponent(r.body.access_token)}&refresh_token=${encodeURIComponent(r.body.refresh_token)}&token_type=bearer`;
          res.writeHead(302, { location: `${redirectTo}#${frag}` }); return res.end();
        }
        return send(res, r.status, r.body);
      }
      // /v1/token doubles as login (password) and refresh (grant_type=refresh_token), Supabase-style.
      if (req.method === 'POST' && (url.pathname === '/v1/token' || url.pathname === '/v1/login')) {
        const body = await readJson(req); if (!body) return send(res, 400, { error: 'invalid_json' });
        const grant = url.searchParams.get('grant_type') || body.grant_type;
        if (limited(req, res, grant === 'refresh_token' ? 'refresh' : 'signin')) return;
        const r = grant === 'refresh_token'
          ? await auth.refreshSession(store, ctx, body)
          : await auth.login(store, ctx, body);
        return send(res, r.status, r.body);
      }
      // ── OAuth Server (project-as-IdP) runtime ──
      if (req.method === 'GET' && url.pathname === '/oauth/authorize') {
        const q = Object.fromEntries(url.searchParams);
        const r = await auth.oauthAuthorize(store, ctx, q);
        if (r.status === 302) { res.writeHead(302, { location: r.location }); return res.end(); }
        return send(res, r.status, r.body);
      }
      if (req.method === 'POST' && url.pathname === '/oauth/consent') {
        if (limited(req, res, 'oauth')) return;
        const body = await readBody(req); if (!body) return send(res, 400, { error: 'invalid_body' });
        const r = await auth.oauthConsent(store, ctx, body, bearer(req.headers)); return send(res, r.status, r.body);
      }
      if (req.method === 'POST' && url.pathname === '/oauth/token') {
        if (limited(req, res, 'oauth')) return;
        const body = await readBody(req); if (!body) return send(res, 400, { error: 'invalid_body' });
        const r = await auth.oauthToken(store, ctx, body); return send(res, r.status, r.body);
      }
      if (req.method === 'POST' && url.pathname === '/oauth/register') {
        if (!ctx.oauthServer.allowDynamic) return send(res, 403, { error: 'dynamic_registration_disabled' });
        const body = await readBody(req); if (!body) return send(res, 400, { error: 'invalid_body' });
        const r = await auth.oauthRegisterClient(store, ctx, body); return send(res, r.status, r.body);
      }

      // OAuth: /v1/authorize → 302 to the provider; /v1/callback → exchange + session, redirect back.
      if (req.method === 'GET' && url.pathname === '/v1/authorize') {
        const r = auth.oauthStart(ctx, { provider: url.searchParams.get('provider'), redirect_to: url.searchParams.get('redirect_to') });
        if (r.status === 302) { res.writeHead(302, { location: r.location }); return res.end(); }
        return send(res, r.status, r.body);
      }
      if (req.method === 'GET' && url.pathname === '/v1/callback') {
        const r = await auth.oauthCallback(store, ctx, { code: url.searchParams.get('code'), state: url.searchParams.get('state') });
        // Defence in depth: oauthStart already sanitized redirect_to into the signed state, but
        // re-validate here so the token-bearing 302 can never target a non-allow-listed origin.
        const dest = r.status === 200 ? auth.safeRedirect(r.redirect_to, ctx) : '';
        if (r.status === 200 && dest) {
          const frag = `access_token=${encodeURIComponent(r.body.access_token)}&refresh_token=${encodeURIComponent(r.body.refresh_token)}&token_type=bearer`;
          res.writeHead(302, { location: `${dest}#${frag}` }); return res.end();
        }
        return send(res, r.status, r.body);
      }
      if (req.method === 'GET' && url.pathname === '/v1/user') {
        const token = bearer(req.headers); if (!token) return send(res, 401, { error: 'missing_token' });
        const r = await auth.getUser(store, ctx, token); return send(res, r.status, r.body);
      }
      // Data-principal rights (DPDP): the user acts on their OWN account with their own token.
      if (url.pathname === '/v1/user' && (req.method === 'DELETE' || req.method === 'PATCH')) {
        const token = bearer(req.headers); if (!token) return send(res, 401, { error: 'missing_token' });
        if (req.method === 'DELETE') { const r = await auth.deleteSelf(store, ctx, token); return send(res, r.status, r.body); }
        const body = (await readJson(req)) || {};
        const r = await auth.updateSelf(store, ctx, token, body); return send(res, r.status, r.body);
      }
      if (req.method === 'GET' && url.pathname === '/v1/user/export') {
        const token = bearer(req.headers); if (!token) return send(res, 401, { error: 'missing_token' });
        const r = await auth.exportSelf(store, ctx, token); return send(res, r.status, r.body);
      }

      // ── Admin (service_role only) ── The role comes from the gateway's VERIFIED internal
      // token (src/internalToken.js), never the spoofable x-baas-role header: user deletion
      // and OAuth-client registration live here (go-live audit M3).
      const isService = roleFromRequest(req, ctx) === 'service_role';
      if (url.pathname === '/v1/admin/users') {
        if (!isService) return send(res, 403, { error: 'forbidden' });
        if (req.method === 'GET') {
          const r = await auth.listUsers(store, { limit: Number(url.searchParams.get('limit')) || 50, offset: Number(url.searchParams.get('offset')) || 0 });
          return send(res, r.status, r.body);
        }
        if (req.method === 'POST') {
          const body = await readJson(req); if (!body) return send(res, 400, { error: 'invalid_json' });
          const r = await auth.adminCreateUser(store, ctx, body); return send(res, r.status, r.body);
        }
      }
      const delUser = /^\/v1\/admin\/users\/(\d+)$/.exec(url.pathname);
      if (req.method === 'DELETE' && delUser) {
        if (!isService) return send(res, 403, { error: 'forbidden' });
        const r = await auth.adminDeleteUser(store, delUser[1]); return send(res, r.status, r.body);
      }
      // Admin OAuth apps registry (dashboard proxies here with service_role).
      if (url.pathname === '/v1/admin/oauth/apps') {
        if (!isService) return send(res, 403, { error: 'forbidden' });
        if (req.method === 'GET') { const r = await auth.oauthListClients(store); return send(res, r.status, r.body); }
        if (req.method === 'POST') {
          const body = await readJson(req); if (!body) return send(res, 400, { error: 'invalid_json' });
          const r = await auth.oauthRegisterClient(store, ctx, body); return send(res, r.status, r.body);
        }
      }
      const delApp = /^\/v1\/admin\/oauth\/apps\/([\w-]+)$/.exec(url.pathname);
      if (req.method === 'DELETE' && delApp) {
        if (!isService) return send(res, 403, { error: 'forbidden' });
        const r = await auth.oauthDeleteClient(store, delApp[1]); return send(res, r.status, r.body);
      }
      return send(res, 404, { error: 'not_found' });
    } catch (e) {
      return send(res, 500, { error: 'internal', message: e.message });
    }
  };
}
function createAuthServer(opts) { return http.createServer(makeAuthHandler(opts)); }

async function main() {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  // Idle-client errors EMIT on the pool; unhandled they crash the process — a DB blip used
  // to take every project's auth down at once (go-live audit F14).
  pool.on('error', (err) => console.error('[baas-auth] pg pool error (continuing):', err.message));
  const store = makeStore(pool);
  await store.ensureSchema();
  const signingKey = process.env.PROJECT_SIGN_PRIVATE_KEY
    ? { privatePem: process.env.PROJECT_SIGN_PRIVATE_KEY, publicPem: process.env.PROJECT_SIGN_PUBLIC_KEY || null, kid: process.env.PROJECT_SIGN_KID || null }
    : null;
  let providers = {};
  try { providers = process.env.AUTH_PROVIDERS_JSON ? JSON.parse(process.env.AUTH_PROVIDERS_JSON) : {}; } catch { /* ignore malformed */ }
  const mailer = makeBrevoMailer({ apiKey: process.env.BREVO_API_KEY, sender: process.env.BREVO_SENDER });

  const server = createAuthServer({
    ref: process.env.PROJECT_REF || '', secret: process.env.PROJECT_JWT_SECRET || '', store, signingKey, mailer,
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
      projectUrl: process.env.PROJECT_URL || (process.env.PROJECT_REF ? `https://${process.env.PROJECT_REF}.${process.env.APPS_DOMAIN || 'rachbase.app'}` : ''),
      siteUrl: process.env.SITE_URL || '',
      // Extra allowed post-auth return URLs/origins (besides SITE_URL / the project gateway).
      // JSON array, e.g. ["https://app.example.com","https://*.example.com","myapp://callback*"].
      redirectAllowList: (() => { try { return JSON.parse(process.env.AUTH_REDIRECT_ALLOWLIST_JSON || '[]'); } catch { return []; } })(),
      providers,
      oauthServer: {
        enabled: process.env.OAUTH_SERVER_ENABLED === 'true',
        authorizationPath: process.env.OAUTH_AUTHORIZATION_PATH || '/oauth/consent',
        allowDynamic: process.env.OAUTH_ALLOW_DYNAMIC === 'true',
      },
    },
  });
  const port = Number(process.env.PORT) || 8080;
  server.listen(port, () => console.log(`[baas-auth] ref=${process.env.PROJECT_REF || '?'} on :${port}`));
  // Graceful shutdown so rollouts don't drop in-flight requests (audit F14).
  const shutdown = () => { console.log('[baas-auth] shutting down'); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 8000).unref(); };
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}

if (require.main === module) main().catch((e) => { console.error('[baas-auth] fatal:', e.message); process.exit(1); });

module.exports = { createAuthServer, makeAuthHandler };
