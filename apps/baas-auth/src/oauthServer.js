'use strict';

/**
 * OAuth2 authorization-server primitives — the project acting as an identity provider so
 * third-party apps can "Sign in with <this project>". PURE helpers (client/secret/code
 * generation, PKCE, redirect-uri validation); the stateful flow (authorize → consent → token)
 * lives in auth.js, which has the session machinery. Authorization-code grant with PKCE (S256).
 */

const crypto = require('crypto');

const CLIENT_ID_PREFIX = 'rbc_';
const CLIENT_SECRET_PREFIX = 'rbcs_';

const b64url = (n) => crypto.randomBytes(n).toString('base64url');
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest();

function generateClientId() { return CLIENT_ID_PREFIX + b64url(18); }
function generateClientSecret() {
  const secret = CLIENT_SECRET_PREFIX + b64url(24);
  return { secret, hash: hashSecret(secret) };
}
function hashSecret(secret) { return sha256(secret).toString('hex'); }
function secretMatches(secret, hash) {
  const a = sha256(secret); const b = Buffer.from(String(hash || ''), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Authorization codes are opaque + stored hashed (single-use, short-lived).
function generateAuthCode() { const code = b64url(32); return { code, hash: hashCode(code) }; }
function hashCode(code) { return sha256(code).toString('hex'); }

// PKCE (RFC 7636): S256 → base64url(sha256(verifier)) === challenge; plain → equal.
function verifyPkce(verifier, challenge, method = 'S256') {
  if (!challenge) return true; // no PKCE requested
  if (!verifier) return false;
  if (method === 'plain') return verifier === challenge;
  return crypto.createHash('sha256').update(verifier).digest('base64url') === challenge;
}

// A redirect_uri must EXACTLY match one the client registered (no substring/prefix matching).
function redirectUriAllowed(redirectUri, registered = []) {
  return Array.isArray(registered) && registered.includes(redirectUri);
}

// Build a redirect back to the app with query params (code+state, or error+state).
function buildRedirect(redirectUri, params) {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') u.searchParams.set(k, v);
  return u.toString();
}

module.exports = {
  CLIENT_ID_PREFIX, CLIENT_SECRET_PREFIX,
  generateClientId, generateClientSecret, hashSecret, secretMatches,
  generateAuthCode, hashCode, verifyPkce, redirectUriAllowed, buildRedirect,
};
