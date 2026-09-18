'use strict';

/**
 * BFF → SpaceArk site API client (contract §4/§5.2), now MULTI-SITE.
 *
 * buildDelivery() computes the canonical request hash + idempotency key (via the
 * shared @rach/site-contracts). The delivery target is resolved per operation from
 * the site registry (`siteRegistry.resolveSite(site_id)`) — there is no global
 * SITE_API_URL. deliver() sends over real mTLS + short-lived OAuth JWT once the
 * shared partner creds are present; otherwise a dry-run transport, so the outbox
 * pipeline is exercisable before SpaceArk's handoff.
 */

const https = require('https');
const http = require('http');

// Plain HTTP to a site (no mTLS) is only for dev/test. It's permitted to a loopback/private
// address, or anywhere when SITE_ALLOW_INSECURE_HTTP=1 is explicitly set — otherwise refused, so
// a production site can never silently run with the partner JWT in cleartext. Fails loud, not soft.
function isPrivateHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (h === 'localhost' || h === '::1' || h === '127.0.0.1') return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)) return true;
  return false;
}
function assertInsecureAllowed(hostname) {
  const allowed = isPrivateHost(hostname) || process.env.SITE_ALLOW_INSECURE_HTTP === '1';
  if (!allowed) {
    throw new Error(
      `refusing plain HTTP to site ${hostname}: set the site's api_url to https:// (mTLS via the edge gateway), ` +
      `or set SITE_ALLOW_INSECURE_HTTP=1 to explicitly allow insecure HTTP (dev/test only)`
    );
  }
}
const _warnedInsecure = new Set();
function warnInsecure(host) {
  if (_warnedInsecure.has(host)) return;
  _warnedInsecure.add(host);
  console.warn(`[site-client] INSECURE: talking to site ${host} over plain HTTP (no TLS/mTLS). Production must use https:// via the edge gateway.`);
}
const crypto = require('crypto');
const { newIdempotencyKey, newRequestId, requestHash, registryImagesRoute } = require('@rach/site-contracts');
const auth = require('./siteAuth');
const registry = require('./siteRegistry');

const siteId = () => process.env.SITE_ID || 'site1';
const partnerId = () => process.env.OAUTH_CLIENT_ID || '';

/** Build the delivery envelope (BFF generates all identifiers; hashes the request). */
function buildDelivery({ operationId, method, route, tenantId = '', body }) {
  const hash = requestHash({ method, route, siteId: siteId(), partnerId: partnerId(), tenantId, body });
  return {
    operationId, method, route, payload: body,
    idempotencyKey: newIdempotencyKey(),
    requestId: newRequestId(),
    requestHash: hash,
  };
}

/**
 * Deliver one outbox row. The row carries `site_id`; we resolve it to a target and
 * pick a transport:
 *   - shared partner creds + a resolved site  → real mTLS+JWT transport
 *   - no partner creds (pre-handoff / local)  → dry-run (logs + acks so the outbox drains)
 *   - creds present but NO site row            → no ack (reschedule; a placed tenant must
 *                                                have a registered site — fix the registry)
 * `opts.site` overrides registry resolution (tests); `opts.transport` overrides everything.
 */
async function deliver(row, { transport, site } = {}) {
  if (transport) return transport(row);
  const s = site !== undefined ? site : await registry.resolveSite(row.site_id);
  if (!auth.hasPartnerCreds()) return dryRunTransport(row, s);
  if (s && s.apiUrl) return httpTransport(row, s);
  return { ack: false, status: 0, reason: 'NO_SITE_REGISTERED', siteId: row.site_id };
}

/**
 * Read a site operation's normalized status (GET /v1/operations/:id) over the same
 * mTLS+JWT transport, addressed to the operation's site. Returns the site's operation
 * DTO or null when there are no creds / no site / the op isn't visible yet.
 */
// Returns the site's operation DTO, or `null` when we can't tell (dry-run / no creds / no
// site), or the sentinel `{ __notFound: true }` when the SITE definitively 404s the op —
// which happens once an operationId is superseded by a newer apply. The status worker uses
// that sentinel to stop polling a dead op instead of 404-ing forever.
async function fetchOperation(operationId, { siteId: sid, transport, site } = {}) {
  const interpret = (res) => {
    if (res && res.ack) return res.body || null;
    if (res && res.status === 404) return { __notFound: true };
    return null;
  };
  if (transport) return interpret(await transport({ method: 'GET', route: `/v1/operations/${operationId}`, payload: null }));
  const s = site !== undefined ? site : await registry.resolveSite(sid);
  if (!auth.hasPartnerCreds() || !s || !s.apiUrl) return null;
  return interpret(await httpTransport({ method: 'GET', route: `/v1/operations/${operationId}`, payload: null, idempotency_key: `op-get-${operationId}` }, s));
}

/**
 * List the tenant's approved registry images (GET /v1/tenants/:ref/registry/images) over
 * the mTLS+JWT transport, addressed to the tenant's site. Empty when no creds / no site.
 */
async function fetchRegistryImages(tenantRef, { siteId: sid, transport, site } = {}) {
  if (transport) { const r = await transport({ method: 'GET', route: registryImagesRoute(tenantRef), payload: null }); return r && r.ack && r.body && Array.isArray(r.body.images) ? r.body : { images: [] }; }
  const s = site !== undefined ? site : await registry.resolveSite(sid);
  if (!auth.hasPartnerCreds() || !s || !s.apiUrl) return { images: [] };
  const res = await httpTransport({ method: 'GET', route: registryImagesRoute(tenantRef), payload: null, idempotency_key: `reg-${tenantRef}` }, s);
  return res && res.ack && res.body && Array.isArray(res.body.images) ? res.body : { images: [] };
}

// Site capabilities (GET /v1/capabilities) — the contract version + the App-spec fields the
// site's CRD supports, so the BFF can PREFLIGHT a deploy and block clearly when the site is
// behind (instead of a 500 at apply). Returns the body, `{ __notFound: true }` when the site
// doesn't implement it yet, or `null` when we can't tell (dry-run / no creds / no site).
async function fetchCapabilities({ siteId: sid, transport, site } = {}) {
  const interpret = (res) => {
    if (res && res.ack) return res.body || {};
    if (res && res.status === 404) return { __notFound: true };
    return null;
  };
  if (transport) return interpret(await transport({ method: 'GET', route: '/v1/capabilities', payload: null }));
  const s = site !== undefined ? site : await registry.resolveSite(sid);
  if (!auth.hasPartnerCreds() || !s || !s.apiUrl) return null;
  return interpret(await httpTransport({ method: 'GET', route: '/v1/capabilities', payload: null, idempotency_key: `caps-${sid || 'default'}` }, s));
}

// Local-dev transport: logs and acks, so the outbox drains without SpaceArk creds.
async function dryRunTransport(row, site) {
  const base = (site && site.apiUrl) || '(no site registered)';
  console.log(`[site-client:dry-run] ${row.method} ${base}${row.route} idem=${row.idempotency_key || row.idempotencyKey}`);
  return { ack: true, status: 202, dryRun: true };
}

// Real transport: mTLS + a fresh short-lived OAuth JWT, over Node's built-in https
// (no extra dep; works on Node 18+). `site.apiUrl` may or may not include `/v1`; routes
// already carry `/v1`, so strip a trailing `/v1` from the base. Trust anchor + JWT
// audience/issuer are the site's (fall back to env inside siteAuth).
function httpTransport(row, site) {
  const token = auth.mintSiteJWT({ audience: auth.audienceFor(site), issuer: site.issuer || undefined });
  const base = String(site.apiUrl || '').replace(/\/$/, '').replace(/\/v1$/, '');
  const url = new URL(`${base}${row.route}`);
  const body = JSON.stringify(row.payload ?? {});
  const traceId = crypto.randomBytes(16).toString('hex');
  const spanId = crypto.randomBytes(8).toString('hex');

  // Honor the site's URL scheme. https:// → real mTLS (production, TLS terminated at the edge
  // gateway). http:// → plain HTTP with NO TLS/mTLS — for a dev/test site or one behind a
  // service mesh that handles TLS. Mutations are still gated by the short-lived RachBase-signed
  // JWT, but the token rides in cleartext, so http:// must NOT be used for production traffic.
  const insecure = url.protocol === 'http:';
  if (insecure) { assertInsecureAllowed(url.hostname); warnInsecure(url.host); }
  const lib = insecure ? http : https;
  const tls = insecure ? {} : auth.tlsOptions({ ca: site.ca });

  return new Promise((resolve, reject) => {
    const req = lib.request({
      method: row.method,
      hostname: url.hostname,
      port: url.port || (insecure ? 80 : 443),
      path: url.pathname + url.search,
      ...(insecure ? {} : { servername: url.hostname, cert: tls.cert, key: tls.key, ca: tls.ca }), // mTLS
      headers: {
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': row.idempotency_key || row.idempotencyKey,
        'X-SpaceArk-Request-ID': crypto.randomUUID(),
        traceparent: `00-${traceId}-${spanId}-01`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = data ? JSON.parse(data) : null; } catch { /* non-JSON body */ }
        resolve({ ack: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('site request timeout')));
    req.write(body);
    req.end();
  });
}

module.exports = { buildDelivery, deliver, fetchOperation, fetchRegistryImages, fetchCapabilities, dryRunTransport, httpTransport, isPrivateHost, assertInsecureAllowed };
