'use strict';

/**
 * Partner-JWT verification for the api facade (contract §4.1). Validates RachBase's
 * short-lived client-credentials JWT: RS256, bounded issuer allowlist, audience
 * `spaceark-site-api:<site>`, exp, and replay-resistant jti. The facade authenticates
 * the caller even past SpaceArk's gateway (defence in depth).
 */

const fs = require('fs');
const jwt = require('jsonwebtoken');

function loadPem(name) {
  const inline = process.env[name];
  if (inline) return inline.includes('\\n') ? inline.replace(/\\n/g, '\n') : inline;
  const p = process.env[`${name}_FILE`];
  if (p) return fs.readFileSync(p, 'utf8');
  return undefined;
}

// Verify a token; throws on any failure. `seenJti` (a Set/store) rejects replays.
function verifyPartnerJwt(token, { publicKey, issuers, audience, seenJti } = {}) {
  const key = publicKey || loadPem('OAUTH_PUBLIC_KEY');
  if (!key) throw new Error('OAUTH_PUBLIC_KEY(_FILE) not configured');
  const iss = issuers || (process.env.OAUTH_ISSUER ? [process.env.OAUTH_ISSUER] : undefined);
  const aud = audience || `spaceark-site-api:${process.env.SITE_ID || 'site1'}`;

  const claims = jwt.verify(token, key, { algorithms: ['RS256'], audience: aud, issuer: iss });

  if (seenJti) {
    if (!claims.jti || seenJti.has(claims.jti)) throw new Error('replayed or missing jti');
    seenJti.add(claims.jti);
  }
  return claims;
}

module.exports = { loadPem, verifyPartnerJwt };
