'use strict';

/**
 * BaaS Auth configuration schema + helpers (Supabase-parity Authentication settings). This is
 * CONTROL-PLANE state: it's editable before the backend deploys and injected into the Auth
 * container's env at deploy time. Stored per project as a JSONB blob (baas_auth_config).
 *
 * Secrets (OAuth client secrets) are masked on read — read returns `secret: ''` with
 * `secret_set: true`; a write that sends an empty secret preserves the stored one.
 */

// OAuth providers we expose toggles for (parity with Supabase's provider list, trimmed).
const OAUTH_PROVIDERS = ['google', 'github', 'apple', 'azure', 'facebook', 'gitlab', 'discord', 'twitter', 'linkedin', 'slack', 'spotify', 'twitch'];

function providerDefaults() {
  const out = { email: { enabled: true }, phone: { enabled: false } };
  // OAuth client secrets are stored SEALED (secret_enc), never plaintext, and never returned to
  // the client. They're unsealed only when building the Auth container's deploy env (toAuthEnv).
  for (const p of OAUTH_PROVIDERS) out[p] = { enabled: false, client_id: '', secret_enc: '' };
  return out;
}
const identity = (x) => x;

const DEFAULTS = Object.freeze({
  signups: { allow_signups: true, confirm_email: true, allow_anonymous: false, allow_manual_linking: false },
  sessions: {
    jwt_expiry: 3600,            // access-token TTL (seconds)
    refresh_rotation: true,      // detect + revoke reused refresh tokens
    refresh_reuse_interval: 10,  // seconds a refresh token may be reused
    single_session: false,       // one active session per user
    timebox_hours: 0,            // force re-login after N hours (0 = never)
    inactivity_timeout_hours: 0, // force re-login after N idle hours (0 = never)
  },
  rate_limits: {
    emails_per_hour: 2, sms_per_hour: 30,
    token_refresh_per_5min: 150, token_verify_per_5min: 30,
    anonymous_per_hour: 30, signin_per_5min: 30,
  },
  url_config: { site_url: '', redirect_urls: [] },
  // Project-as-identity-provider (OAuth Server): let third-party apps sign in with this project.
  oauth_server: { enabled: false, authorization_path: '/oauth/consent', allow_dynamic: false },
});

// A deep clone of DEFAULTS with the providers block (kept separate for readability).
function baseConfig() {
  return {
    signups: { ...DEFAULTS.signups },
    sessions: { ...DEFAULTS.sessions },
    rate_limits: { ...DEFAULTS.rate_limits },
    url_config: { site_url: '', redirect_urls: [] },
    oauth_server: { ...DEFAULTS.oauth_server },
    providers: providerDefaults(),
  };
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

// Merge a stored blob over the defaults (2 levels deep is all the schema needs).
function withDefaults(stored) {
  const base = baseConfig();
  if (!isObj(stored)) return base;
  for (const section of Object.keys(base)) {
    if (!isObj(stored[section])) continue;
    if (section === 'providers') {
      for (const p of Object.keys(base.providers)) {
        if (isObj(stored.providers[p])) base.providers[p] = { ...base.providers[p], ...stored.providers[p] };
      }
    } else if (section === 'url_config') {
      base.url_config = { ...base.url_config, ...stored.url_config, redirect_urls: Array.isArray(stored.url_config?.redirect_urls) ? stored.url_config.redirect_urls : base.url_config.redirect_urls };
    } else {
      base[section] = { ...base[section], ...stored[section] };
    }
  }
  return base;
}

// Redact provider secrets for the client: never echo (or even ship the ciphertext of) a secret;
// expose only whether one is set.
function redactSecrets(config) {
  const c = withDefaults(config);
  for (const p of OAUTH_PROVIDERS) {
    const has = Boolean(c.providers[p]?.secret_enc);
    c.providers[p] = { enabled: Boolean(c.providers[p]?.enabled), client_id: c.providers[p]?.client_id || '', secret: '', secret_set: has };
  }
  return c;
}

// Apply an incoming patch to the stored config. Deep-merges known sections only (ignores junk),
// coerces numbers/bools, and preserves an existing OAuth secret when the patch omits/blank it.
// `seal` (from keyCrypto) encrypts a provider secret before it's stored. Optional — without it
// (unit tests) the secret is stored as-is under secret_enc so the shape stays consistent.
function applyPatch(stored, patch, { seal = identity } = {}) {
  const next = withDefaults(stored);           // full, normalized starting point
  if (!isObj(patch)) return next;

  if (isObj(patch.signups)) next.signups = coerceBools(next.signups, patch.signups, ['allow_signups', 'confirm_email', 'allow_anonymous', 'allow_manual_linking']);
  if (isObj(patch.sessions)) {
    next.sessions = { ...next.sessions,
      ...pickBools(patch.sessions, ['refresh_rotation', 'single_session']),
      ...pickInts(patch.sessions, ['jwt_expiry', 'refresh_reuse_interval', 'timebox_hours', 'inactivity_timeout_hours']) };
  }
  if (isObj(patch.rate_limits)) next.rate_limits = { ...next.rate_limits, ...pickInts(patch.rate_limits, Object.keys(DEFAULTS.rate_limits)) };
  if (isObj(patch.oauth_server)) {
    next.oauth_server = { ...next.oauth_server, ...pickBools(patch.oauth_server, ['enabled', 'allow_dynamic']) };
    if (typeof patch.oauth_server.authorization_path === 'string') {
      const p = patch.oauth_server.authorization_path.trim();
      next.oauth_server.authorization_path = p.startsWith('/') ? p : `/${p || 'oauth/consent'}`;
    }
  }
  if (isObj(patch.url_config)) {
    next.url_config = { ...next.url_config };
    if (typeof patch.url_config.site_url === 'string') next.url_config.site_url = patch.url_config.site_url.trim();
    if (Array.isArray(patch.url_config.redirect_urls)) next.url_config.redirect_urls = patch.url_config.redirect_urls.filter((u) => typeof u === 'string').slice(0, 50);
  }
  if (isObj(patch.providers)) {
    for (const p of Object.keys(next.providers)) {
      const pin = patch.providers[p];
      if (!isObj(pin)) continue;
      const cur = next.providers[p];
      const merged = { ...cur };
      if ('enabled' in pin) merged.enabled = Boolean(pin.enabled);
      if (p !== 'email' && p !== 'phone') {
        if (typeof pin.client_id === 'string') merged.client_id = pin.client_id.trim();
        // empty/absent secret preserves the stored (sealed) one (masking pattern); a new secret
        // is sealed before storage. Any accidental plaintext `secret` is never persisted.
        if (typeof pin.secret === 'string' && pin.secret !== '') merged.secret_enc = seal(pin.secret);
        delete merged.secret;
      }
      next.providers[p] = merged;
    }
  }
  return next;
}

function coerceBools(current, patch, keys) {
  const out = { ...current };
  for (const k of keys) if (k in patch) out[k] = Boolean(patch[k]);
  return out;
}
function pickBools(patch, keys) { const o = {}; for (const k of keys) if (k in patch) o[k] = Boolean(patch[k]); return o; }
function pickInts(patch, keys) { const o = {}; for (const k of keys) if (k in patch && patch[k] !== '' && Number.isFinite(Number(patch[k]))) o[k] = Math.max(0, Math.trunc(Number(patch[k]))); return o; }

// The subset the Auth container needs at runtime (injected as env at deploy). Enabled OAuth
// providers ride along as a JSON blob (with their client_id/secret) — this is real secret
// material, so it's injected via the deploy path's per-app Secret, never returned to clients.
function toAuthEnv(config, { open = identity } = {}) {
  const c = withDefaults(config);
  const providers = {};
  for (const p of Object.keys(c.providers)) {
    const pv = c.providers[p];
    if (!pv?.enabled) continue;
    providers[p] = (p === 'email' || p === 'phone')
      ? { enabled: true }
      : { enabled: true, client_id: pv.client_id || '', secret: pv.secret_enc ? open(pv.secret_enc) : '' };
  }
  return {
    ALLOW_SIGNUPS: String(c.signups.allow_signups),
    CONFIRM_EMAIL: String(c.signups.confirm_email),
    ALLOW_ANONYMOUS: String(c.signups.allow_anonymous),
    JWT_EXPIRY: String(c.sessions.jwt_expiry),
    REFRESH_ROTATION: String(c.sessions.refresh_rotation),
    REFRESH_REUSE_INTERVAL: String(c.sessions.refresh_reuse_interval),
    // Rate limits (enforced per-IP by the Auth service).
    RATE_SIGNIN_PER_5MIN: String(c.rate_limits.signin_per_5min),
    RATE_TOKEN_REFRESH_PER_5MIN: String(c.rate_limits.token_refresh_per_5min),
    RATE_ANON_PER_HOUR: String(c.rate_limits.anonymous_per_hour),
    EMAIL_ENABLED: String(c.providers.email.enabled),
    PHONE_ENABLED: String(c.providers.phone.enabled),
    SITE_URL: c.url_config.site_url || '',
    // Extra allow-listed post-auth return URLs (besides SITE_URL / the project gateway). Guards the
    // email-verify & OAuth-callback token hand-off against open-redirect token theft (audit P0 #8).
    AUTH_REDIRECT_ALLOWLIST_JSON: JSON.stringify(Array.isArray(c.url_config.redirect_urls) ? c.url_config.redirect_urls : []),
    AUTH_PROVIDERS_JSON: JSON.stringify(providers),
    OAUTH_SERVER_ENABLED: String(c.oauth_server.enabled),
    OAUTH_AUTHORIZATION_PATH: c.oauth_server.authorization_path || '/oauth/consent',
    OAUTH_ALLOW_DYNAMIC: String(c.oauth_server.allow_dynamic),
  };
}

module.exports = { OAUTH_PROVIDERS, DEFAULTS, baseConfig, withDefaults, redactSecrets, applyPatch, toAuthEnv };
