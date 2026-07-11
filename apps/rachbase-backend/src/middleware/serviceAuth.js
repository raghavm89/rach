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
function serviceAuth(envVar = 'RACHBASE_SERVICE_TOKEN') {
  return (req, res, next) => {
    const expected = process.env[envVar];
    if (!expected) {
      return res.status(503).json({ error: 'Service auth not configured' });
    }
    const provided = req.headers['x-service-token'];
    if (!provided || provided !== expected) {
      return res.status(401).json({ error: 'Invalid service token' });
    }
    next();
  };
}

module.exports = serviceAuth;
