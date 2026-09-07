'use strict';

/**
 * Open-redirect / token-leak guard (go-live audit P0 #8). The email-verify and OAuth-callback
 * flows 302 the freshly-minted session to `redirect_to` with the tokens in the URL fragment, so a
 * `redirect_to` is only honoured when it is same-site or on the project's allow-list.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../src/auth');

const ctx = {
  secret: 'x'.repeat(40),
  siteUrl: 'https://app.myproject.com',
  projectUrl: 'https://p0123.rachbase.app',
  redirectAllowList: ['https://staging.myproject.com', 'https://*.trusted.dev', 'myapp://auth*'],
  providers: { google: { enabled: true, client_id: 'gid', secret: 'gsec' } },
};

test('same-site (siteUrl / projectUrl origin) redirects are allowed', () => {
  assert.equal(A.isRedirectAllowed('https://app.myproject.com/welcome', ctx), true);
  assert.equal(A.isRedirectAllowed('https://p0123.rachbase.app/cb', ctx), true);
});

test('attacker origins are rejected', () => {
  assert.equal(A.isRedirectAllowed('https://evil.example', ctx), false);
  assert.equal(A.isRedirectAllowed('https://app.myproject.com.evil.com', ctx), false); // suffix trick
  assert.equal(A.isRedirectAllowed('//evil.example', ctx), false);                     // protocol-relative
  assert.equal(A.isRedirectAllowed('https:evil.example', ctx), false);
});

test('allow-list: exact origin, wildcard subdomain, and custom-scheme prefix', () => {
  assert.equal(A.isRedirectAllowed('https://staging.myproject.com/x', ctx), true); // bare origin listed
  assert.equal(A.isRedirectAllowed('https://a.trusted.dev/cb', ctx), true);        // *.trusted.dev
  assert.equal(A.isRedirectAllowed('myapp://auth/callback', ctx), true);           // myapp://auth*
  assert.equal(A.isRedirectAllowed('https://other.dev', ctx), false);
});

test('safe relative paths ok; empty rejected', () => {
  assert.equal(A.isRedirectAllowed('/dashboard', ctx), true);
  assert.equal(A.isRedirectAllowed('//evil', ctx), false);
  assert.equal(A.isRedirectAllowed('', ctx), false);
  assert.equal(A.isRedirectAllowed(undefined, ctx), false);
});

test('safeRedirect falls back to siteUrl when the target is not allowed', () => {
  assert.equal(A.safeRedirect('https://evil.example', ctx), ctx.siteUrl);
  assert.equal(A.safeRedirect('https://app.myproject.com/ok', ctx), 'https://app.myproject.com/ok');
});

test('oauthStart never carries a disallowed redirect_to into the signed state', () => {
  const oauth = require('../src/oauth');
  const r = A.oauthStart(ctx, { provider: 'google', redirect_to: 'https://evil.example' });
  assert.equal(r.status, 302);
  const stateParam = new URL(r.location).searchParams.get('state');
  const st = oauth.verifyState(ctx.secret, stateParam);
  assert.equal(st.redirect_to, ctx.siteUrl); // rewritten to the safe default
});
