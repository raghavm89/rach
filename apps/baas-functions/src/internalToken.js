'use strict';

/**
 * Verify the gateway's short-lived INTERNAL token and derive the caller's role from it.
 *
 * The per-project gateway authenticates the real caller (API key / user session), then mints
 * an HS256 token under the project secret and forwards it as `Authorization: Bearer …` —
 * along with an ADVISORY `x-baas-role` header. Trusting the header alone meant anything that
 * could reach this container directly (a same-tenant workload, any future network-policy gap)
 * could claim `service_role` with one spoofed header (go-live audit M3). The token is the
 * only trusted source: no valid token → `anon`, whatever the header says.
 *
 * Dependency-free HS256 verify (these per-project containers ship as minimal standalone
 * images — no jsonwebtoken). An identical copy lives in the other baas-* services that need
 * it; keep them in sync (the duplication is deliberate: separate images, no shared package).
 *
 * Dev/standalone (no PROJECT_JWT_SECRET): falls back to the header, single-tenant only.
 */

const crypto = require('crypto');

const b64urlJson = (s) => {
  try { return JSON.parse(Buffer.from(String(s), 'base64url').toString('utf8')); }
  catch { return null; }
};

/** Verify an HS256 JWT against `secret` (+ issuer `ref` when given). Claims or null. */
function verifyHs256(secret, token, { ref } = {}) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [h64, p64, sig] = parts;
  const header = b64urlJson(h64);
  if (!header || header.alg !== 'HS256') return null; // alg pinned — no `none`, no downgrade
  const expected = crypto.createHmac('sha256', secret).update(`${h64}.${p64}`).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const claims = b64urlJson(p64);
  if (!claims) return null;
  if (claims.exp !== undefined && Date.now() / 1000 >= Number(claims.exp)) return null;
  if (ref && claims.iss !== ref) return null; // a token is only valid for ITS project
  return claims;
}

/**
 * The caller's generic role ('service_role' | 'authenticated' | 'anon'), derived from the
 * verified internal token. The token carries the per-project DB role (`service_<ref>` /
 * `authenticated_<ref>` / `anon_<ref>`); generic spellings are accepted too.
 */
function roleFromRequest(req, { secret, ref }) {
  if (!secret) return String(req.headers['x-baas-role'] || 'anon'); // dev/standalone only
  const m = /^Bearer\s+(.+)$/.exec(req.headers.authorization || '');
  const claims = m ? verifyHs256(secret, m[1], { ref }) : null;
  if (!claims) return 'anon';
  const role = String(claims.role || '');
  if (role === 'service_role' || (ref && role === `service_${ref}`)) return 'service_role';
  if (role === 'authenticated' || (ref && role === `authenticated_${ref}`)) return 'authenticated';
  return 'anon';
}

module.exports = { verifyHs256, roleFromRequest };
