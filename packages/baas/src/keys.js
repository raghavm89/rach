'use strict';

/**
 * Per-project BaaS keys (Phase 3). Every key is a JWT signed (HS256) by the PROJECT's own
 * secret — the load-bearing trick: the key *is* a verifiable token, so the gateway, PostgREST,
 * and Postgres RLS all verify caller identity with the same JWT machinery, no extra lookups.
 *
 *   - anon         → public API key shipped in client apps; policy-gated (role='anon').
 *   - service_role → server-side only; bypasses policy (role='service_role').
 *   - user session → issued by Auth; carries `sub` (user id) + role='authenticated'.
 *
 * All three carry the project `ref` as issuer, so a token can only be used with its project.
 * The secret is symmetric (HS256) so the same secret verifies on the gateway + in Postgres.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const ROLES = Object.freeze({ ANON: 'anon', SERVICE: 'service_role', USER: 'authenticated' });

/** A fresh per-project signing secret (256-bit, base64url). Store SEALED; never log it. */
function generateSecret() {
  return crypto.randomBytes(32).toString('base64url');
}

// anon / service_role are long-lived API keys — no exp (they're revoked by rotating the secret).
function mintProjectKey(secret, ref, role) {
  if (!secret || !ref) throw new Error('mintProjectKey: secret and ref required');
  return jwt.sign({ role, ref }, secret, { algorithm: 'HS256', issuer: ref });
}
const mintAnonKey = (secret, ref) => mintProjectKey(secret, ref, ROLES.ANON);
const mintServiceKey = (secret, ref) => mintProjectKey(secret, ref, ROLES.SERVICE);

// End-user session token (Auth, slice 2). Short-lived; carries the user id in `sub`.
function mintUserToken(secret, ref, { sub, role = ROLES.USER, ttlSec = 3600, claims = {} } = {}) {
  if (!secret || !ref || !sub) throw new Error('mintUserToken: secret, ref, sub required');
  return jwt.sign({ ...claims, role, ref, sub }, secret, { algorithm: 'HS256', issuer: ref, expiresIn: ttlSec });
}

/** Verify + decode a token against a project secret (and, when given, its ref). Throws on failure. */
function verifyToken(secret, token, { ref } = {}) {
  return jwt.verify(token, secret, { algorithms: ['HS256'], ...(ref ? { issuer: ref } : {}) });
}

// The per-project Postgres role for a generic role name. Request roles are namespaced by ref so a
// project's RLS grants target roles scoped to ITS database only — no cluster-global shared roles.
function dbRoleFor(genericRole, ref) {
  if (genericRole === ROLES.SERVICE) return `service_${ref}`;
  if (genericRole === ROLES.USER) return `authenticated_${ref}`;
  return `anon_${ref}`;
}

// Mint a short-lived INTERNAL downstream token (the gateway → upstream token) carrying an explicit
// DB role (per-project) plus optional sub — what PostgREST SET ROLEs into.
function mintInternalToken(secret, ref, { role, sub, ttlSec = 120, claims = {} } = {}) {
  if (!secret || !ref || !role) throw new Error('mintInternalToken: secret, ref, role required');
  const payload = { ...claims, role, ref, ...(sub ? { sub: String(sub) } : {}) };
  return jwt.sign(payload, secret, { algorithm: 'HS256', issuer: ref, expiresIn: ttlSec });
}

module.exports = { ROLES, generateSecret, mintAnonKey, mintServiceKey, mintUserToken, verifyToken, dbRoleFor, mintInternalToken };
