'use strict';

/** Google OAuth: signed state, authorize URL, and the full callback flow (code → token → userinfo
 *  → find-or-create user → session) against a fake provider. */

const test = require('node:test');
const assert = require('node:assert/strict');
const baas = require('@rach/baas');
const O = require('../src/oauth');
const A = require('../src/auth');
const { makeStore } = require('../src/store');

const HAVE_PGLITE = (() => { try { require.resolve('@electric-sql/pglite'); return true; } catch { return false; } })();
const REF = 'p0123456789abcdef';
const SECRET = baas.generateSecret();
const PROVIDERS = { google: { enabled: true, client_id: 'gid.apps.googleusercontent.com', secret: 'gsecret' } };
const ctx = { ref: REF, secret: SECRET, projectUrl: 'https://p1.rachbase.app', siteUrl: 'https://app.example.com', providers: PROVIDERS };

test('signState/verifyState round-trips and rejects tampering', () => {
  const s = O.signState(SECRET, { provider: 'google', redirect_to: 'https://app' });
  assert.equal(O.verifyState(SECRET, s).provider, 'google');
  assert.equal(O.verifyState('wrong-secret', s), null);
  assert.equal(O.verifyState(SECRET, s.slice(0, -2) + 'xx'), null);   // mutated signature
});

test('authorizeUrl targets Google with the right params', () => {
  const url = O.authorizeUrl('google', { clientId: 'cid', redirectUri: 'https://p1.rachbase.app/auth/v1/callback', state: 'st' });
  assert.ok(url.startsWith('https://accounts.google.com/o/oauth2/v2/auth?'));
  const q = new URL(url).searchParams;
  assert.equal(q.get('client_id'), 'cid');
  assert.equal(q.get('redirect_uri'), 'https://p1.rachbase.app/auth/v1/callback');
  assert.equal(q.get('response_type'), 'code');
  assert.match(q.get('scope'), /email/);
});

test('oauthStart 302s to the provider only when enabled + configured', () => {
  const ok = A.oauthStart(ctx, { provider: 'google', redirect_to: 'https://app.example.com/home' });
  assert.equal(ok.status, 302);
  assert.match(ok.location, /accounts\.google\.com/);
  assert.equal(A.oauthStart(ctx, { provider: 'facebook' }).status, 400);            // not implemented
  assert.equal(A.oauthStart({ ...ctx, providers: {} }, { provider: 'google' }).body.error, 'provider_not_configured');
});

test('oauthCallback exchanges the code, provisions the user, and issues a session', { skip: !HAVE_PGLITE }, async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  const store = makeStore({ query: (t, p) => (p === undefined ? db.query(t) : db.query(t, p)) });
  await store.ensureSchema();

  // fake Google: token endpoint returns an access_token; userinfo returns the profile
  const fetchImpl = async (url) => {
    if (url.includes('/token')) return { ok: true, json: async () => ({ access_token: 'ya29.fake', id_token: 'x' }) };
    if (url.includes('userinfo')) return { ok: true, json: async () => ({ sub: '123', email: 'Person@Gmail.com', email_verified: true, name: 'Person' }) };
    return { ok: false, status: 404, json: async () => ({}) };
  };

  const state = O.signState(SECRET, { provider: 'google', redirect_to: 'https://app.example.com/home', nonce: 'n' });
  const r = await A.oauthCallback(store, ctx, { code: 'auth-code', state }, { fetchImpl });
  assert.equal(r.status, 200);
  assert.equal(r.redirect_to, 'https://app.example.com/home');
  assert.ok(r.body.access_token && r.body.refresh_token);
  assert.equal(r.body.user.email, 'person@gmail.com');           // normalized, provisioned

  // a second sign-in with the same email reuses the existing user (find-or-create)
  const r2 = await A.oauthCallback(store, ctx, { code: 'auth-code-2', state }, { fetchImpl });
  assert.equal(r2.body.user.id, r.body.user.id);

  // an invalid/tampered state is rejected before any network call
  assert.equal((await A.oauthCallback(store, ctx, { code: 'c', state: 'bogus' }, { fetchImpl })).body.error, 'invalid_state');
});

test('oauthCallback surfaces a provider exchange failure as 502', { skip: !HAVE_PGLITE }, async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  const store = makeStore({ query: (t, p) => (p === undefined ? db.query(t) : db.query(t, p)) });
  await store.ensureSchema();
  const fetchImpl = async () => ({ ok: false, status: 400, json: async () => ({ error: 'invalid_grant' }) });
  const state = O.signState(SECRET, { provider: 'google', redirect_to: '', nonce: 'n' });
  const r = await A.oauthCallback(store, ctx, { code: 'bad', state }, { fetchImpl });
  assert.equal(r.status, 502);
  assert.equal(r.body.error, 'oauth_exchange_failed');
});
