'use strict';

/**
 * Per-project BaaS gateway HTTP server. Verifies the project key/token, then proxies to the
 * matching primitive upstream. Stateless — deployed via the SpaceArk App path (one per project).
 *
 * Env: PROJECT_REF, PROJECT_JWT_SECRET (the project signing secret, injected from the sealed
 * per-project secret), PORT (default 8080), and per-primitive upstreams:
 *   AUTH_UPSTREAM / REST_UPSTREAM / STORAGE_UPSTREAM / FUNCTIONS_UPSTREAM (e.g. http://rest:3000).
 *
 * Opaque API keys (rb_publishable_… / rb_secret_…) are validated against the control plane:
 *   INTROSPECT_URL (e.g. https://api.rachbase.app/internal/baas/introspect), INTROSPECT_TOKEN
 *   (the RACHBASE_SERVICE_TOKEN). Results are cached briefly (INTROSPECT_TTL_MS, default 30s) so
 *   validation isn't a per-request round-trip; revocation takes effect within that window.
 */

require('dotenv').config();
const http = require('http');
const https = require('https');
const { matchRoute, classifyToken, authorizeRequest, downstreamToken, upstreamFor } = require('./src/gateway');
const { makeReporter } = require('./src/metrics');
const { signing } = require('@rach/baas');

const send = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };

// CORS — browser apps call the project backend cross-origin (the app + the OAuth consent page),
// authenticating via the Authorization/apikey headers, not cookies, so `*` is safe. An explicit
// allow-list (BAAS_CORS_ORIGINS, comma-separated) narrows it and echoes the matching origin.
function resolveCorsOrigin(reqOrigin, allowed) {
  if (!allowed || allowed === '*') return '*';
  const list = String(allowed).split(',').map((s) => s.trim()).filter(Boolean);
  if (reqOrigin && list.includes(reqOrigin)) return reqOrigin;
  return list[0] || '*';
}
function applyCors(req, res, allowed) {
  const origin = resolveCorsOrigin(req.headers.origin, allowed);
  res.setHeader('access-control-allow-origin', origin);
  if (origin !== '*') res.setHeader('vary', 'Origin');
  res.setHeader('access-control-allow-methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('access-control-allow-headers', 'authorization, apikey, content-type, x-client-info, x-baas-role, x-baas-ref');
  res.setHeader('access-control-expose-headers', 'content-type');
  res.setHeader('access-control-max-age', '86400');
}

// Control-plane key introspection with a small TTL cache. Returns async (ref, key) => {valid, role}.
// Negative results are cached briefly too, so a bad key can't hammer the control plane.
function makeIntrospector({ url, token, ttlMs = 30_000, fetchImpl = fetch } = {}) {
  if (!url) return null;
  const cache = new Map(); // key → { at, result }
  return async (ref, key) => {
    const ck = `${ref}\n${key}`;
    const hit = cache.get(ck);
    if (hit && Date.now() - hit.at < ttlMs) return hit.result;
    const resp = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { 'x-service-token': token } : {}) },
      body: JSON.stringify({ ref, key }),
    });
    if (!resp.ok) throw new Error(`introspect_http_${resp.status}`);
    const result = await resp.json();
    cache.set(ck, { at: Date.now(), result });
    if (cache.size > 5000) cache.clear(); // bound memory (crude; TTL does the real work)
    return result;
  };
}

// Build the server from an explicit config (so it's testable without env/sockets).
function createGatewayServer({ ref, secret, upstreams = {}, introspect = null, publicKey = null, kid = null, corsOrigins = '*', reporter = null } = {}) {
  // Public JWKS built once from the project's public key (for external token verifiers).
  let jwksDoc = { keys: [] };
  if (publicKey) { try { jwksDoc = signing.jwks(signing.publicJwkFromPem(publicKey, kid)); } catch { /* leave empty */ } }

  return http.createServer(async (req, res) => {
    // Observability: count every request (primitive + status + latency) for the metrics pipeline.
    const t0 = Date.now();
    let primitive = 'gateway';
    if (reporter) res.on('finish', () => reporter.inc({ primitive, status: res.statusCode, ms: Date.now() - t0 }));

    applyCors(req, res, corsOrigins);
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }  // CORS preflight

    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/' || url.pathname === '/healthz') {
      return send(res, 200, { service: 'baas-gateway', ref: ref || null, ready: Boolean(ref && secret) });
    }
    // JWKS discovery — public keys for verifying this project's user session tokens.
    if (url.pathname === '/.well-known/jwks.json' || url.pathname === '/auth/v1/.well-known/jwks.json') {
      return send(res, 200, jwksDoc);
    }
    const route = matchRoute(url.pathname);
    if (!route) return send(res, 404, { error: 'NOT_FOUND' });
    primitive = route.primitive;
    if (!ref || !secret) return send(res, 503, { error: 'GATEWAY_NOT_CONFIGURED' });

    // Signed storage URLs are credential-less BY DESIGN — a browser <img src>/<a href> cannot
    // send Authorization headers, which is the entire point of the feature. The gateway used to
    // 401 these (MISSING_KEY), leaving signed URLs verifiable in the storage service but
    // unreachable end-to-end (go-live audit #3, low-severity list). A GET for an object that
    // carries BOTH ?sig= and ?exp= passes through as `anon`; the storage service itself does the
    // real check (constant-time HMAC under the project secret over method+object+expiry, plus
    // expiry) and 403s anything invalid — the gateway grants nothing but passage. Narrowly
    // scoped: storage primitive, GET only, /v1/object/* path only.
    const isSignedObjectGet = route.primitive === 'storage' && req.method === 'GET'
      && /^\/v1\/object\//.test(route.upstreamPath)
      && Boolean(url.searchParams.get('sig')) && Boolean(url.searchParams.get('exp'));

    const auth = isSignedObjectGet
      ? { ok: true, claims: { role: 'anon', ref } } // no privilege: the signature is the grant
      : await authorizeRequest(req.headers, { secret, ref, introspect, publicKey });
    if (!auth.ok) return send(res, auth.status, { error: auth.error });

    const base = upstreamFor(route.primitive, upstreams);
    if (!base) return send(res, 503, { error: 'PRIMITIVE_NOT_PROVISIONED', primitive: route.primitive });

    // Proxy to the upstream. Replace the caller's credential (opaque key / ES256 token) with a
    // short-lived INTERNAL token the upstream trusts (HS256, project secret), and forward the
    // verified role/ref. `apikey` is dropped so PostgREST only sees the minted token.
    const internal = downstreamToken(secret, ref, auth.claims);
    const target = new URL(route.upstreamPath + url.search, base);
    const client = target.protocol === 'https:' ? https : http;
    const headers = { ...req.headers, host: target.host, authorization: `Bearer ${internal}`, 'x-baas-ref': ref, 'x-baas-role': String(auth.claims.role || ''), 'x-baas-primitive': route.primitive };
    delete headers.apikey;
    const preq = client.request(target, { method: req.method, headers }, (pres) => { res.writeHead(pres.statusCode, pres.headers); pres.pipe(res); });
    preq.on('error', () => send(res, 502, { error: 'UPSTREAM_UNREACHABLE', primitive: route.primitive }));
    req.pipe(preq);
  });
}

function configFromEnv() {
  return {
    ref: process.env.PROJECT_REF || '',
    secret: process.env.PROJECT_JWT_SECRET || '',
    publicKey: process.env.PROJECT_SIGN_PUBLIC_KEY || null,   // ES256 public key (verifies user tokens)
    kid: process.env.PROJECT_SIGN_KID || null,
    upstreams: {
      auth: process.env.AUTH_UPSTREAM || null,
      rest: process.env.REST_UPSTREAM || null,
      storage: process.env.STORAGE_UPSTREAM || null,
      functions: process.env.FUNCTIONS_UPSTREAM || null,
    },
    introspect: makeIntrospector({
      url: process.env.INTROSPECT_URL || '',
      token: process.env.INTROSPECT_TOKEN || '',
      ttlMs: Number(process.env.INTROSPECT_TTL_MS) || 30_000,
    }),
    corsOrigins: process.env.BAAS_CORS_ORIGINS || '*',
    reporter: process.env.BAAS_METRICS_URL ? makeReporter({
      ref: process.env.PROJECT_REF || '',
      url: process.env.BAAS_METRICS_URL,
      token: process.env.INTROSPECT_TOKEN || '',
    }) : null,
  };
}

if (require.main === module) {
  const cfg = configFromEnv();
  const port = Number(process.env.PORT) || 8080;
  // Flush request metrics to the control plane on an interval (best-effort).
  if (cfg.reporter) setInterval(() => cfg.reporter.flush(), Number(process.env.BAAS_METRICS_FLUSH_MS) || 30_000).unref();
  const server = createGatewayServer(cfg);
  server.listen(port, () => console.log(`[baas-gateway] ref=${cfg.ref || '?'} on :${port} → ${JSON.stringify(cfg.upstreams)} introspect=${cfg.introspect ? 'on' : 'off'} metrics=${cfg.reporter ? 'on' : 'off'}`));
  // Graceful shutdown — the gateway fronts every request to the project; with replicas:1 a
  // hard kill on rollout was a per-project outage with dropped in-flight requests (audit F14).
  const shutdown = () => { console.log('[baas-gateway] shutting down'); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 8000).unref(); };
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}

module.exports = { createGatewayServer, configFromEnv, makeIntrospector };
