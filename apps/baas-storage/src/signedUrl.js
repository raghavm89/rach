'use strict';

/**
 * Time-limited signed URLs for direct object access (Phase 3). The signature is HMAC-SHA256 over
 * method + object + expiry, keyed by the PROJECT secret — so a signed link grants scoped, expiring
 * access without a JWT (e.g. a browser <img src>). Verify is constant-time + expiry-checked.
 */

const crypto = require('crypto');

const payload = (method, bucket, key, exp) => `${String(method).toUpperCase()}:${bucket}/${key}:${exp}`;
const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('base64url');

// Returns { exp, sig } for `?exp=..&sig=..`. ttlSec default 5 min.
function sign(secret, { bucket, key, method = 'GET', ttlSec = 300, now = Date.now() }) {
  const exp = Math.floor(now / 1000) + ttlSec;
  return { exp, sig: hmac(secret, payload(method, bucket, key, exp)) };
}

function verify(secret, { bucket, key, method = 'GET', exp, sig }, now = Date.now()) {
  if (!exp || !sig) return false;
  if (Number(exp) * 1000 < now) return false;                 // expired
  const expected = hmac(secret, payload(method, bucket, key, Number(exp)));
  const a = Buffer.from(expected); const b = Buffer.from(String(sig));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { sign, verify };
