'use strict';

/**
 * Service-to-service auth for RachBase's internal API.
 *
 * Trusted callers (e.g. rachdev-backend) send a shared secret in the
 * `x-service-token` header. This gates the /internal/* endpoints that let
 * another service request privileged infra operations (deploys, VM commands).
 *
 * Set RACHBASE_SERVICE_TOKEN in both services' environments.
 */
const crypto = require('crypto');

/**
 * Constant-time string comparison. Guards against a timing side channel on the
 * shared secret. Comparing the SHA-256 digests keeps both inputs the same
 * length (timingSafeEqual throws on length mismatch) without leaking the
 * expected token's length.
 */
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function serviceAuth(envVar = 'RACHBASE_SERVICE_TOKEN') {
  return (req, res, next) => {
    const expected = process.env[envVar];
    if (!expected) {
      return res.status(503).json({ error: 'Service auth not configured' });
    }
    const provided = req.headers['x-service-token'];
    if (!provided || !safeEqual(provided, expected)) {
      return res.status(401).json({ error: 'Invalid service token' });
    }
    next();
  };
}

module.exports = serviceAuth;
