'use strict';

/**
 * BFF → site API credentials (contract §4.1). These are RachBase's PARTNER identity
 * (machine-to-machine), not per-tenant:
 *   - mTLS client cert/key + the CA to trust the site's server cert
 *   - a short-lived OAuth2 client-credentials JWT (RS256), aud=spaceark-site-api:<site>,
 *     exp ≤ 10 min, replay-resistant jti
 *
 * Secrets load from `<NAME>` (inline PEM) or `<NAME>_FILE` (path) so they can come
 * from a secret store as mounted files. Never disable TLS validation.
 */

const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

function loadPem(name) {
  const inline = process.env[name];
  if (inline) return inline.includes('\\n') ? inline.replace(/\\n/g, '\n') : inline;
  const path = process.env[`${name}_FILE`];
  if (path) return fs.readFileSync(path, 'utf8');
  return undefined;
}

// mTLS material. The client cert/key are the SHARED partner identity (env/secret store);
// the trust anchor (`ca`) is per-site — pass the site's `ca` PEM, else fall back to MTLS_CA.
function tlsOptions({ ca } = {}) {
  return { cert: loadPem('MTLS_CERT'), key: loadPem('MTLS_KEY'), ca: ca || loadPem('MTLS_CA') };
}

// JWT audience for a site: the site's explicit audience, else OAUTH_AUDIENCE, else the
// per-site default `spaceark-site-api:<site_id>` (contract §4.1).
function audienceFor(site = null) {
  if (site && site.audience) return site.audience;
  if (process.env.OAUTH_AUDIENCE) return process.env.OAUTH_AUDIENCE;
  const siteId = (site && site.siteId) || process.env.SITE_ID || 'site1';
  return `spaceark-site-api:${siteId}`;
}

// Short-lived client-credentials JWT — the partner identity. Audience/issuer are per-site
// (fall back to env). jsonwebtoken rejects options present with an undefined value, so add
// optional claims only when set.
function mintSiteJWT({ ttlSec = 300, audience, issuer } = {}) {
  const key = loadPem('OAUTH_PRIVATE_KEY');
  if (!key) throw new Error('OAUTH_PRIVATE_KEY(_FILE) not configured');
  const opts = {
    algorithm: 'RS256',
    audience: audience || audienceFor(),
    expiresIn: Math.min(ttlSec, 600),   // exp ≤ 10 minutes (contract §4.1)
    jwtid: crypto.randomUUID(),          // replay-resistant jti
  };
  const iss = issuer || process.env.OAUTH_ISSUER;
  if (iss) opts.issuer = iss;
  if (process.env.OAUTH_CLIENT_ID) opts.subject = process.env.OAUTH_CLIENT_ID;
  if (process.env.OAUTH_KID) opts.keyid = process.env.OAUTH_KID;
  return jwt.sign({}, key, opts);
}

// True once the shared PARTNER identity is configured (mTLS client cert/key + OAuth key).
// The per-site URL/trust anchor comes from the site registry, not env — so this no longer
// checks SITE_API_URL. Until creds are present the client falls back to the dry-run transport.
function hasPartnerCreds() {
  const t = tlsOptions();
  return Boolean(t.cert && t.key && loadPem('OAUTH_PRIVATE_KEY'));
}

module.exports = { loadPem, tlsOptions, audienceFor, mintSiteJWT, hasPartnerCreds };
