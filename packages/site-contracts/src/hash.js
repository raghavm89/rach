'use strict';

/**
 * Canonical request hashing (SpaceArk contract §4.2 / §5.2). The site API stores a
 * canonical SHA-256 over method, route, site, authenticated partner, tenant and the
 * NORMALIZED body. A reused Idempotency-Key with a different hash → 409
 * IDEMPOTENCY_CONFLICT. The BFF and the site API MUST compute the identical hash.
 */

const crypto = require('crypto');

// Deterministic JSON: object keys sorted recursively (arrays keep order).
function canonicalJson(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  const keys = Object.keys(v).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(v[k])}`).join(',')}}`;
}

function requestHash({ method, route, siteId, partnerId, tenantId, body }) {
  const canonical = [
    String(method).toUpperCase(),
    route,
    siteId,
    partnerId || '',
    tenantId || '',
    canonicalJson(body ?? null),
  ].join('\n');
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

module.exports = { canonicalJson, requestHash };
