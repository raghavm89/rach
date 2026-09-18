'use strict';

/**
 * BaaS per-project deployment topology (Phase 3). Given a project's runtime facts, produce the
 * set of container App specs that make up its backend: a PUBLIC gateway (<ref>.rachbase.app) that
 * proxies to INTERNAL primitive Services in the tenant namespace.
 *
 *   gateway  → verifies keys, routes /auth,/rest,/storage,/functions   (public)
 *   auth     → native Auth service over the project DB                  (internal)
 *   rest     → PostgREST over the project DB, JWT secret = project secret (internal, ADOPTED)
 *   storage/functions → added by their slices once their images exist.
 *
 * PURE — no cluster calls. The caller enqueues these via the normal App/deploy path; the gateway's
 * upstream env is wired only for primitives actually included (unset → the gateway 503s that path).
 * This module defines the shape; deploying it needs the SpaceArk platform, and a project DB URL.
 */

const GW_PORT = 8080;
const AUTH_PORT = 8080;
const REST_PORT = 3000;
const APPS_DOMAIN = process.env.APPS_DOMAIN || 'rachbase.app';

// appId must match a-[a-z0-9]{8,15}. Derive a stable per-role id from the project ref (p + 16 hex).
const ROLE_PREFIX = { gateway: 'gw', services: 'sv', rest: 'rs' };
const appIdFor = (role, ref) => `a-${ROLE_PREFIX[role]}${String(ref || '').replace(/^p/, '').slice(0, 10)}`;

const env = (o) => Object.entries(o).filter(([, v]) => v != null && v !== '').map(([name, value]) => ({ name, value: String(value) }));

/**
 * Per-project topology (3 containers, to fit the Pro plan's 3 included):
 *   gateway  → public (<ref>.rachbase.app); verifies keys/tokens, routes.
 *   services → ONE internal container running auth + storage + functions (dispatched by the
 *              x-baas-primitive header the gateway forwards).
 *   rest     → PostgREST (Data API), its own container (third-party engine).
 *
 * @param images { gateway, services, rest } — image refs (only configured ones deploy)
 * @returns [{ role, appId, image, port, public, env }] — gateway first
 */
function bundleSpecs({ ref, secret, databaseUrl, images = {}, signing = null, authEnv = {}, storageEnv = {} }) {
  if (!ref || !secret) throw new Error('bundleSpecs: ref and secret required');

  const primitives = [];
  const upstreamEnv = {};

  // Combined services container: auth + storage + functions share one process + the project DB.
  if (images.services) {
    const appId = appIdFor('services', ref);
    primitives.push({ role: 'services', appId, image: images.services, port: GW_PORT,
      env: env({
        PROJECT_REF: ref, PROJECT_JWT_SECRET: secret, DATABASE_URL: databaseUrl,
        // Asymmetric session-token signing (ES256): private key here, public key on the gateway.
        PROJECT_SIGN_PRIVATE_KEY: signing?.privatePem, PROJECT_SIGN_PUBLIC_KEY: signing?.publicPem, PROJECT_SIGN_KID: signing?.kid,
        PROJECT_URL: `https://${ref}.${APPS_DOMAIN}`,                 // confirmation/OAuth-callback links
        BREVO_API_KEY: process.env.BAAS_BREVO_API_KEY, BREVO_SENDER: process.env.BAAS_BREVO_SENDER,
        SEAWEEDFS_FILER_URL: process.env.BAAS_SEAWEEDFS_FILER_URL,   // storage object bytes
        DENO_RUNNER_URL: process.env.BAAS_DENO_RUNNER_URL,           // function execution
        ...authEnv, ...storageEnv,                                   // control-plane config for auth + storage
      }) });
    const base = `http://${appId}:${GW_PORT}`;
    upstreamEnv.AUTH_UPSTREAM = base; upstreamEnv.STORAGE_UPSTREAM = base; upstreamEnv.FUNCTIONS_UPSTREAM = base;
  }

  // PostgREST (Data API) stays its own container.
  if (images.rest) {
    const appId = appIdFor('rest', ref);
    primitives.push({ role: 'rest', appId, image: images.rest, port: REST_PORT,
      env: env({ PGRST_DB_URI: databaseUrl, PGRST_JWT_SECRET: secret, PGRST_DB_ANON_ROLE: `anon_${ref}`, PGRST_SERVER_PORT: REST_PORT }) });
    upstreamEnv.REST_UPSTREAM = `http://${appId}:${REST_PORT}`;
  }

  const gateway = images.gateway ? [{
    role: 'gateway', appId: appIdFor('gateway', ref), image: images.gateway, port: GW_PORT, public: true,
    env: env({
      PROJECT_REF: ref, PROJECT_JWT_SECRET: secret, ...upstreamEnv,
      // Opaque API keys (rb_publishable_/rb_secret_) are validated against the control plane.
      INTROSPECT_URL: process.env.BAAS_INTROSPECT_URL, INTROSPECT_TOKEN: process.env.RACHBASE_SERVICE_TOKEN,
      // Observability: flush request metrics to the control-plane ingest endpoint.
      BAAS_METRICS_URL: process.env.BAAS_METRICS_URL,
      // Public key (+ kid) to verify ES256 user session tokens and serve JWKS.
      PROJECT_SIGN_PUBLIC_KEY: signing?.publicPem, PROJECT_SIGN_KID: signing?.kid,
      // CORS for browser apps + the OAuth consent page ('*' or a comma-separated allow-list).
      BAAS_CORS_ORIGINS: process.env.BAAS_CORS_ORIGINS || '*',
    }),
  }] : [];

  return [...gateway, ...primitives];
}

// Image refs come from config (set once the images are built + pushed). Missing → that primitive
// isn't deployed yet (its route 503s). This is the seam where the SpaceArk deploy + real images land.
function imagesFromEnv() {
  return {
    gateway: process.env.BAAS_GATEWAY_IMAGE || null,
    services: process.env.BAAS_SERVICES_IMAGE || null, // combined auth+storage+functions
    rest: process.env.BAAS_REST_IMAGE || null,         // stock PostgREST (e.g. postgrest/postgrest)
  };
}

module.exports = { bundleSpecs, appIdFor, imagesFromEnv, ROLE_PREFIX };
