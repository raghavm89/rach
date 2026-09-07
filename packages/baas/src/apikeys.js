'use strict';

/**
 * Opaque, individually-revocable API keys — Supabase's *current* key model (2025+),
 * superseding the legacy HS256 anon/service_role JWTs in ./keys.js.
 *
 * Unlike the JWT keys, these carry no embedded claims and aren't self-verifying: they're
 * random tokens looked up in a server-side store (baas_api_keys). That indirection is the
 * whole point — each key can be revoked/rotated individually and audited (last_used_at),
 * without rotating the project secret (which would invalidate *every* key at once).
 *
 *   - publishable (rb_publishable_…) → public, ships in client apps; maps to role 'anon'.
 *   - secret      (rb_secret_…)      → server-side only; maps to role 'service_role'.
 *
 * The store keeps a SHA-256 hash for lookup (never the raw secret key). Publishable keys are
 * public, so their plaintext may be stored for redisplay; secret keys are shown once.
 */

const crypto = require('crypto');

const TYPES = Object.freeze({ PUBLISHABLE: 'publishable', SECRET: 'secret' });
const PREFIXES = Object.freeze({ publishable: 'rb_publishable_', secret: 'rb_secret_' });
const ROLE_FOR_TYPE = Object.freeze({ publishable: 'anon', secret: 'service_role' });

function prefixFor(type) {
  const p = PREFIXES[type];
  if (!p) throw new Error(`apikeys: unknown key type "${type}"`);
  return p;
}

/** Generate an opaque key. Returns { key, hash, last4 } — persist hash+last4, show `key` once. */
function generateKey(type) {
  const key = prefixFor(type) + crypto.randomBytes(24).toString('base64url'); // 32 url-safe chars
  return { key, hash: hashKey(key), last4: key.slice(-4) };
}

/** SHA-256 hex of a key — what the store holds and what introspection matches against. */
function hashKey(key) {
  return crypto.createHash('sha256').update(String(key)).digest('hex');
}

/** Infer a key's type from its prefix (publishable | secret), or null if unrecognized. */
function typeOfKey(key) {
  if (typeof key !== 'string') return null;
  if (key.startsWith(PREFIXES.publishable)) return TYPES.PUBLISHABLE;
  if (key.startsWith(PREFIXES.secret)) return TYPES.SECRET;
  return null;
}

/** The Postgres/RLS role a key type grants ('anon' | 'service_role'), or null. */
function roleForType(type) {
  return ROLE_FOR_TYPE[type] || null;
}

/** Constant-time check of a presented key against a stored hash. */
function keyMatchesHash(key, hash) {
  const a = Buffer.from(hashKey(key), 'hex');
  const b = Buffer.from(String(hash || ''), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = {
  TYPES, PREFIXES, ROLE_FOR_TYPE,
  generateKey, hashKey, typeOfKey, roleForType, keyMatchesHash,
};
