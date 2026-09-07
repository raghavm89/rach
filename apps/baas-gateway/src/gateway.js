'use strict';

/**
 * Per-project BaaS gateway core (Phase 3, slice 1). PURE helpers — the HTTP server (index.js)
 * wires them to sockets. One gateway runs per project, configured with that project's `ref` +
 * signing secret (injected as env from the sealed per-project secret).
 *
 * Every request must carry a valid project key or user token for THIS project (verified with
 * the per-project secret); the gateway then proxies to the matching primitive upstream. The
 * ROLE is enforced downstream (Postgres RLS / policy), not here — the gateway only authenticates.
 */

const { verifyToken, apikeys, signing, dbRoleFor, mintInternalToken } = require('@rach/baas');

const PRIMITIVES = ['auth', 'rest', 'storage', 'functions'];

// /rest/v1/todos?x=1 → { primitive: 'rest', upstreamPath: '/v1/todos' }. Null if no primitive.
function matchRoute(pathname) {
  const m = /^\/(auth|rest|storage|functions)(\/.*)?$/.exec(pathname || '');
  if (!m) return null;
  return { primitive: m[1], upstreamPath: m[2] || '/' };
}

// Bearer token, or a Supabase-style `apikey` header (clients often send the anon key there).
function bearer(headers = {}) {
  const auth = headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  return (m && m[1]) || headers.apikey || null;
}

// Is this an opaque API key (rb_publishable_… / rb_secret_…, validated by lookup) or a JWT
// (user session token, self-verifying)? The two auth paths diverge here.
function classifyToken(token) {
  return apikeys.typeOfKey(token) ? 'apikey' : 'jwt';
}

// Authenticate the caller. Two kinds of credential:
//   - opaque API key  → validated via `introspect(ref, key)` against the control-plane store
//     (Supabase's current model: revocable, so it can't be verified by signature alone).
//   - user session JWT → verified locally with the per-project secret (HS256; asymmetric later).
// `publicKey` (ES256 SPKI PEM) verifies asymmetric user session tokens; `secret` is the HS256
// fallback kept during the transition. Returns { ok, claims } or { ok:false, status, error }.
// Async because introspection is I/O.
async function authorizeRequest(headers, { secret, ref, introspect, publicKey }) {
  const token = bearer(headers);
  if (!token) return { ok: false, status: 401, error: 'MISSING_KEY' };

  if (classifyToken(token) === 'apikey') {
    if (typeof introspect !== 'function') return { ok: false, status: 401, error: 'INVALID_KEY' };
    try {
      const r = await introspect(ref, token);
      if (r && r.valid) return { ok: true, claims: { role: r.role, ref } };
      return { ok: false, status: 401, error: 'INVALID_KEY' };
    } catch {
      return { ok: false, status: 503, error: 'INTROSPECTION_UNAVAILABLE' };
    }
  }

  // User session JWT — prefer asymmetric (ES256 public key); fall back to HS256 during transition.
  if (publicKey) {
    try { return { ok: true, claims: signing.verifyTokenAsym(publicKey, token, { ref }) }; }
    catch { /* not an ES256 token (or wrong key) → try the legacy HS256 path */ }
  }
  try {
    return { ok: true, claims: verifyToken(secret, token, { ref }) };
  } catch {
    return { ok: false, status: 401, error: 'INVALID_KEY' };
  }
}

// The gateway is the trust boundary: it authenticates the caller (opaque key or ES256 user token)
// then mints a short-lived INTERNAL token (HS256, project secret) carrying the resolved identity
// as a PER-PROJECT DB role, which it forwards to the upstream. So PostgREST + the primitives verify
// one thing — the gateway's token — and SET ROLE into a role scoped to THIS project's database.
// An authenticated user carries their sub (+ email) for RLS.
function downstreamToken(secret, ref, claims = {}) {
  const role = dbRoleFor(claims.role || (claims.sub ? 'authenticated' : 'anon'), ref);
  return mintInternalToken(secret, ref, {
    role, sub: claims.sub, ttlSec: 120,
    claims: claims.email ? { email: claims.email } : {},
  });
}

// The configured upstream base URL for a primitive, or null when it isn't provisioned yet
// (slices 2–5 light these up; until then the gateway returns 503 for that primitive).
function upstreamFor(primitive, upstreams = {}) {
  return upstreams[primitive] || null;
}

module.exports = { PRIMITIVES, matchRoute, bearer, classifyToken, authorizeRequest, downstreamToken, upstreamFor };
