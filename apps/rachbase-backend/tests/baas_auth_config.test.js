'use strict';

/** BaaS Auth config: defaults, deep-merge patching, secret masking, and the derived Auth env. */

const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/lib/baasAuthConfig');

test('withDefaults yields a full config from empty/garbage input', () => {
  const c = C.withDefaults({});
  assert.equal(c.signups.allow_signups, true);
  assert.equal(c.sessions.jwt_expiry, 3600);
  assert.equal(c.providers.email.enabled, true);
  assert.equal(c.providers.google.enabled, false);
  assert.deepEqual(C.withDefaults(null).rate_limits, C.DEFAULTS.rate_limits);
});

test('applyPatch deep-merges known sections and coerces types', () => {
  let cfg = {};
  cfg = C.applyPatch(cfg, { signups: { allow_signups: false, confirm_email: 0 } });
  assert.equal(cfg.signups.allow_signups, false);
  assert.equal(cfg.signups.confirm_email, false);          // coerced to bool
  assert.equal(cfg.signups.allow_anonymous, false);        // untouched default retained

  cfg = C.applyPatch(cfg, { sessions: { jwt_expiry: '900', single_session: true, timebox_hours: -5 } });
  assert.equal(cfg.sessions.jwt_expiry, 900);              // coerced to int
  assert.equal(cfg.sessions.single_session, true);
  assert.equal(cfg.sessions.timebox_hours, 0);            // clamped to >= 0
  assert.equal(cfg.signups.allow_signups, false);          // earlier patch persisted
});

test('OAuth secrets are sealed on write, preserved on blank write, masked on read, unsealed for deploy', () => {
  const seal = (s) => `SEALED(${s})`;
  const open = (s) => String(s).replace(/^SEALED\(|\)$/g, '');

  let cfg = C.applyPatch({}, { providers: { google: { enabled: true, client_id: 'gid', secret: 'topsecret' } } }, { seal });
  assert.equal(cfg.providers.google.secret_enc, 'SEALED(topsecret)');   // sealed, not plaintext
  assert.equal(cfg.providers.google.secret, undefined);                 // no plaintext persisted

  // a later patch that toggles without resending the secret keeps the sealed one
  cfg = C.applyPatch(cfg, { providers: { google: { enabled: false, secret: '' } } }, { seal });
  assert.equal(cfg.providers.google.secret_enc, 'SEALED(topsecret)');
  assert.equal(cfg.providers.google.enabled, false);

  // read redacts the secret and never ships the ciphertext, but flags that one is set
  const red = C.redactSecrets(cfg);
  assert.equal(red.providers.google.secret, '');
  assert.equal(red.providers.google.secret_set, true);
  assert.equal('secret_enc' in red.providers.google, false);           // ciphertext not leaked
  assert.equal(red.providers.github.secret_set, false);

  // the deploy env unseals the secret for the Auth container (enabled providers only)
  cfg = C.applyPatch(cfg, { providers: { google: { enabled: true } } }, { seal });
  const env = C.toAuthEnv(cfg, { open });
  const provs = JSON.parse(env.AUTH_PROVIDERS_JSON);
  assert.equal(provs.google.secret, 'topsecret');
});

test('toAuthEnv exposes the runtime subset the Auth container reads', () => {
  const cfg = C.applyPatch({}, { signups: { allow_signups: false }, sessions: { jwt_expiry: 1200 } });
  const env = C.toAuthEnv(cfg);
  assert.equal(env.ALLOW_SIGNUPS, 'false');
  assert.equal(env.JWT_EXPIRY, '1200');
  assert.equal(env.EMAIL_ENABLED, 'true');
});

test('toAuthEnv ships the redirect allow-list to the Auth container (open-redirect guard)', () => {
  const cfg = C.applyPatch({}, { url_config: { site_url: 'https://app.example.com', redirect_urls: ['https://app.example.com/cb', 'https://*.example.com'] } });
  const env = C.toAuthEnv(cfg);
  assert.equal(env.SITE_URL, 'https://app.example.com');
  assert.deepEqual(JSON.parse(env.AUTH_REDIRECT_ALLOWLIST_JSON), ['https://app.example.com/cb', 'https://*.example.com']);
});

test('oauth_server section: defaults, patching, path normalization, and env', () => {
  assert.deepEqual(C.withDefaults({}).oauth_server, { enabled: false, authorization_path: '/oauth/consent', allow_dynamic: false });
  const cfg = C.applyPatch({}, { oauth_server: { enabled: true, authorization_path: 'consent/screen', allow_dynamic: true } });
  assert.equal(cfg.oauth_server.enabled, true);
  assert.equal(cfg.oauth_server.authorization_path, '/consent/screen');   // leading slash added
  const env = C.toAuthEnv(cfg);
  assert.equal(env.OAUTH_SERVER_ENABLED, 'true');
  assert.equal(env.OAUTH_ALLOW_DYNAMIC, 'true');
  assert.equal(env.OAUTH_AUTHORIZATION_PATH, '/consent/screen');
});
