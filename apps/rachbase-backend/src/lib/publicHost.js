'use strict';

/**
 * Public-host safety for per-app ingress (security prerequisite). On a shared cluster with
 * `*.rachbase.app` wildcard DNS, an app's public host must be:
 *   - GLOBALLY UNIQUE (claimed in the DB; see Service.ensurePublicHost) so two tenants can't
 *     both route the same host — this module supplies the derivation + validation, the model
 *     enforces uniqueness,
 *   - NOT a RESERVED platform subdomain (api/app/dashboard/…), so a tenant can't shadow a
 *     platform endpoint,
 *   - a VALID DNS label under the platform domain, or a VALID external custom domain that is
 *     not itself a platform/reserved host.
 *
 * Pure + unit-tested; the DB claim + ownership verification live in the model/flows.
 */

const APPS_DOMAIN = (process.env.APPS_DOMAIN || 'rachbase.app').toLowerCase();

// Subdomains a tenant must never be able to claim (platform + infra). `test` is intentionally
// NOT reserved — it's a legitimate app name.
const RESERVED_SUBDOMAINS = new Set([
  'api', 'app', 'apps', 'www', 'dashboard', 'admin', 'console', 'account', 'accounts',
  'auth', 'login', 'id', 'billing', 'pay', 'payments', 'status', 'docs', 'help', 'support',
  'blog', 'mail', 'smtp', 'imap', 'ftp', 'ns', 'ns1', 'ns2', 'dns', 'cdn', 'static', 'assets',
  'edge', 'gateway', 'proxy', 'internal', 'infra', 'k8s', 'cluster', 'metrics', 'grafana',
  'prometheus', 'root', 'master', 'staging', 'prod', 'production', 'dev', 'test-edge',
]);

const LABEL_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;      // one DNS label (RFC 1123)
const FQDN_RE = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/; // a dotted domain

const stripScheme = (s) => String(s || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');

// Is `label` a reserved platform subdomain?
function isReservedLabel(label) {
  return RESERVED_SUBDOMAINS.has(String(label || '').toLowerCase());
}

// The platform host for a slug: `<slug>.rachbase.app`. Returns null if the slug isn't a valid,
// non-reserved DNS label (caller then falls back to a suffixed/derived slug).
function platformHostForSlug(slug) {
  const s = String(slug || '').toLowerCase();
  if (!LABEL_RE.test(s) || isReservedLabel(s)) return null;
  return `${s}.${APPS_DOMAIN}`;
}

// True if `host` is a well-formed platform host (`<label>.rachbase.app`, label not reserved).
function isValidPlatformHost(host) {
  const h = stripScheme(host);
  if (!h.endsWith(`.${APPS_DOMAIN}`)) return false;
  const label = h.slice(0, -1 * (`.${APPS_DOMAIN}`).length);
  return LABEL_RE.test(label) && !isReservedLabel(label);
}

/**
 * Validate a user-supplied CUSTOM domain. It must be a real external FQDN, NOT a
 * `*.rachbase.app` host (those are platform-managed) and not otherwise reserved. Ownership is
 * verified separately (DNS challenge) before it's actually routed — this only blocks the
 * obviously-unsafe values. Returns the normalized host or throws.
 */
function assertSafeCustomDomain(domain) {
  const h = stripScheme(domain);
  if (!h) throw new Error('custom domain is empty');
  if (!FQDN_RE.test(h)) throw new Error('custom domain is not a valid hostname');
  if (h === APPS_DOMAIN || h.endsWith(`.${APPS_DOMAIN}`)) {
    throw new Error(`custom domain cannot be a ${APPS_DOMAIN} subdomain (those are platform-managed)`);
  }
  return h;
}

module.exports = {
  APPS_DOMAIN, RESERVED_SUBDOMAINS,
  stripScheme, isReservedLabel, platformHostForSlug, isValidPlatformHost, assertSafeCustomDomain,
};
