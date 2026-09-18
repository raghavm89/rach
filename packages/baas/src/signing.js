'use strict';

/**
 * Asymmetric signing for end-user session tokens — Supabase's current model (2025+), replacing
 * the HS256 shared-secret user tokens in ./keys.js.
 *
 * Auth signs a user's JWT with the project's PRIVATE key (ES256 / P-256). Verifiers — the gateway,
 * PostgREST, Postgres RLS — check it with the matching PUBLIC key, published as a JWKS. The win:
 * a verifier never needs the signing secret, so the private key stays with Auth alone, and the
 * public key can be handed out freely (and rotated by publishing a new `kid`).
 *
 * API keys (anon/service_role) stay opaque + looked up (see ./apikeys.js) — this module is only
 * for the short-lived, per-user session tokens.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/** A fresh ES256 (P-256) signing keypair. Returns PEMs + the public JWK (with a stable kid). */
function generateSigningKeypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' });
  const rawJwk = publicKey.export({ format: 'jwk' });
  const kid = crypto.createHash('sha256').update(JSON.stringify(rawJwk)).digest('base64url').slice(0, 16);
  const jwk = { ...rawJwk, use: 'sig', alg: 'ES256', kid };
  return { privatePem, publicPem, jwk, kid };
}

/** Mint a user session token signed with the project's PRIVATE key (ES256). Short-lived. */
function mintUserTokenAsym(privatePem, ref, { sub, role = 'authenticated', ttlSec = 3600, kid, claims = {} } = {}) {
  if (!privatePem || !ref || !sub) throw new Error('mintUserTokenAsym: privatePem, ref, sub required');
  return jwt.sign({ ...claims, role, ref, sub }, privatePem, {
    algorithm: 'ES256', issuer: ref, expiresIn: ttlSec, ...(kid ? { keyid: kid } : {}),
  });
}

/** Verify a user token with the project's PUBLIC key (SPKI PEM or a JWK object). Throws on failure. */
function verifyTokenAsym(publicKey, token, { ref } = {}) {
  const key = typeof publicKey === 'string'
    ? publicKey
    : crypto.createPublicKey({ key: publicKey, format: 'jwk' });
  return jwt.verify(token, key, { algorithms: ['ES256'], ...(ref ? { issuer: ref } : {}) });
}

/** Rebuild the public JWK (with sig/alg/kid) from a stored SPKI PEM — for serving JWKS. */
function publicJwkFromPem(publicPem, kid) {
  const jwk = crypto.createPublicKey(publicPem).export({ format: 'jwk' });
  return { ...jwk, use: 'sig', alg: 'ES256', ...(kid ? { kid } : {}) };
}

/** Assemble a JWKS document ({ keys: [...] }) from one or more public JWKs. */
function jwks(...jwkList) {
  return { keys: jwkList.filter(Boolean) };
}

module.exports = { generateSigningKeypair, mintUserTokenAsym, verifyTokenAsym, publicJwkFromPem, jwks };
