'use strict';

/** OAuth Server (project-as-IdP): client registry + the authorization-code flow (authorize →
 *  consent → token) with confidential-secret and public-PKCE clients, against pglite. */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const baas = require('@rach/baas');
const A = require('../src/auth');
const OS = require('../src/oauthServer');
const { makeStore } = require('../src/store');

const HAVE_PGLITE = (() => { try { require.resolve('@electric-sql/pglite'); return true; } catch { return false; } })();
const REF = 'p0123456789abcdef';
const SECRET = baas.generateSecret();
const baseCtx = { ref: REF, secret: SECRET, siteUrl: 'https://app.example.com', oauthServer: { enabled: true, authorizationPath: '/oauth/consent', allowDynamic: false } };

function codeFromRedirect(redirect) { return new URL(redirect).searchParams.get('code'); }

test('pure: PKCE S256, exact redirect match, secret compare', () => {
  const verifier = 'a'.repeat(43);
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  assert.equal(OS.verifyPkce(verifier, challenge, 'S256'), true);
  assert.equal(OS.verifyPkce('wrong', challenge, 'S256'), false);
  assert.equal(OS.redirectUriAllowed('https://a/cb', ['https://a/cb']), true);
  assert.equal(OS.redirectUriAllowed('https://a/cb2', ['https://a/cb']), false);
  const { secret, hash } = OS.generateClientSecret();
  assert.ok(OS.secretMatches(secret, hash));
  assert.ok(!OS.secretMatches(secret + 'x', hash));
});

async function freshStore() {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  const store = makeStore({ query: (t, p) => (p === undefined ? db.query(t) : db.query(t, p)) });
  await store.ensureSchema();
  return store;
}

test('confidential client: authorize → consent → code → token', { skip: !HAVE_PGLITE }, async () => {
  const store = await freshStore();
  const ctx = { ...baseCtx };

  const reg = await A.oauthRegisterClient(store, ctx, { name: 'My App', redirect_uris: ['https://app.example.com/cb'] });
  assert.equal(reg.status, 201);
  const { client_id, client_secret } = reg.body;
  assert.ok(client_id.startsWith('rbc_') && client_secret.startsWith('rbcs_'));

  // a logged-in end-user
  const user = await A.signup(store, ctx, { email: 'owner@example.com', password: 'hunter2pw' });
  const userToken = user.body.access_token;

  // authorize validates + hands off to the consent UI
  const authz = await A.oauthAuthorize(store, ctx, { client_id, redirect_uri: 'https://app.example.com/cb', response_type: 'code', state: 'xyz' });
  assert.equal(authz.status, 302);
  assert.ok(authz.location.startsWith('https://app.example.com/oauth/consent'));

  // consent (approve) mints a code and returns the app redirect
  const consent = await A.oauthConsent(store, ctx, { client_id, redirect_uri: 'https://app.example.com/cb', state: 'xyz', approved: true }, userToken);
  assert.equal(consent.status, 200);
  const url = new URL(consent.body.redirect);
  assert.equal(url.searchParams.get('state'), 'xyz');
  const code = url.searchParams.get('code');
  assert.ok(code);

  // token exchange with the client secret
  const tok = await A.oauthToken(store, ctx, { grant_type: 'authorization_code', code, client_id, client_secret, redirect_uri: 'https://app.example.com/cb' });
  assert.equal(tok.status, 200);
  assert.ok(tok.body.access_token && tok.body.refresh_token);
  const claims = baas.verifyToken(SECRET, tok.body.access_token, { ref: REF });
  assert.equal(String(claims.sub), String(user.body.user.id));

  // the code is single-use
  assert.equal((await A.oauthToken(store, ctx, { grant_type: 'authorization_code', code, client_id, client_secret, redirect_uri: 'https://app.example.com/cb' })).status, 400);
  // wrong secret → 401
  const c2 = await A.oauthConsent(store, ctx, { client_id, redirect_uri: 'https://app.example.com/cb', approved: true }, userToken);
  const code2 = codeFromRedirect(c2.body.redirect);
  assert.equal((await A.oauthToken(store, ctx, { grant_type: 'authorization_code', code: code2, client_id, client_secret: 'bad', redirect_uri: 'https://app.example.com/cb' })).status, 401);
});

test('public client uses PKCE (no secret); wrong verifier is rejected', { skip: !HAVE_PGLITE }, async () => {
  const store = await freshStore();
  const ctx = { ...baseCtx };
  const reg = await A.oauthRegisterClient(store, ctx, { name: 'SPA', client_type: 'public', redirect_uris: ['https://spa.example.com/cb'] });
  assert.ok(!reg.body.client_secret);                     // public clients get no secret
  const client_id = reg.body.client_id;

  const user = await A.signup(store, ctx, { email: 'spa@example.com', password: 'hunter2pw' });
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

  const consent = await A.oauthConsent(store, ctx, { client_id, redirect_uri: 'https://spa.example.com/cb', code_challenge: challenge, code_challenge_method: 'S256', approved: true }, user.body.access_token);
  const code = codeFromRedirect(consent.body.redirect);

  assert.equal((await A.oauthToken(store, ctx, { grant_type: 'authorization_code', code, client_id, redirect_uri: 'https://spa.example.com/cb', code_verifier: 'wrong' })).status, 400);
  // a fresh code + correct verifier succeeds
  const c2 = await A.oauthConsent(store, ctx, { client_id, redirect_uri: 'https://spa.example.com/cb', code_challenge: challenge, code_challenge_method: 'S256', approved: true }, user.body.access_token);
  const code2 = codeFromRedirect(c2.body.redirect);
  const tok = await A.oauthToken(store, ctx, { grant_type: 'authorization_code', code: code2, client_id, redirect_uri: 'https://spa.example.com/cb', code_verifier: verifier });
  assert.equal(tok.status, 200);
  assert.ok(tok.body.access_token);
});

test('guards: disabled server, bad redirect_uri, denied consent, bad session', { skip: !HAVE_PGLITE }, async () => {
  const store = await freshStore();
  const ctx = { ...baseCtx };
  const reg = await A.oauthRegisterClient(store, ctx, { name: 'App', redirect_uris: ['https://app.example.com/cb'] });
  const client_id = reg.body.client_id;
  const user = await A.signup(store, ctx, { email: 'g@example.com', password: 'hunter2pw' });

  // disabled server
  assert.equal((await A.oauthAuthorize(store, { ...ctx, oauthServer: { ...ctx.oauthServer, enabled: false } }, { client_id, redirect_uri: 'https://app.example.com/cb', response_type: 'code' })).body.error, 'oauth_server_disabled');
  // unregistered redirect_uri (open-redirect guard)
  assert.equal((await A.oauthAuthorize(store, ctx, { client_id, redirect_uri: 'https://evil.example.com', response_type: 'code' })).body.error, 'invalid_redirect_uri');
  // denied consent → error=access_denied on the redirect
  const denied = await A.oauthConsent(store, ctx, { client_id, redirect_uri: 'https://app.example.com/cb', state: 's', approved: false }, user.body.access_token);
  assert.equal(new URL(denied.body.redirect).searchParams.get('error'), 'access_denied');
  // bad user session → 401
  assert.equal((await A.oauthConsent(store, ctx, { client_id, redirect_uri: 'https://app.example.com/cb', approved: true }, 'garbage')).status, 401);
});
