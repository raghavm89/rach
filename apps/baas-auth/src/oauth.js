'use strict';

/**
 * OAuth sign-in (Google first). PURE helpers + an injected HTTP client, so the authorize/callback
 * flow is unit-tested against a fake provider — only real client credentials + network are missing
 * at deploy. State is HMAC-signed with the project secret to carry `redirect_to` safely (CSRF).
 *
 * Flow: GET /authorize → 302 to the provider → provider redirects to /callback?code&state →
 * exchange code for tokens → fetch userinfo → find-or-create user → issue a session.
 */

const crypto = require('crypto');

const PROVIDERS = {
  google: {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    userinfo: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile',
  },
};

const isSupported = (p) => Object.prototype.hasOwnProperty.call(PROVIDERS, p);

// Signed, tamper-proof state token carrying the post-login redirect + a nonce.
function signState(secret, payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', String(secret)).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function verifyState(secret, state) {
  const [body, sig] = String(state || '').split('.');
  if (!body || !sig) return null;
  const expect = crypto.createHmac('sha256', String(secret)).update(body).digest('base64url');
  const a = Buffer.from(sig); const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { return null; }
}

// The provider's authorize URL to redirect the user to.
function authorizeUrl(provider, { clientId, redirectUri, state }) {
  const cfg = PROVIDERS[provider];
  const q = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: 'code',
    scope: cfg.scope, state, access_type: 'offline', prompt: 'select_account',
  });
  return `${cfg.authorize}?${q.toString()}`;
}

// Exchange an authorization code for tokens (form-encoded, per OAuth2).
async function exchangeCode(provider, { clientId, clientSecret, code, redirectUri }, { fetchImpl = fetch } = {}) {
  const cfg = PROVIDERS[provider];
  const resp = await fetchImpl(cfg.token, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }).toString(),
  });
  if (!resp.ok) throw new Error(`oauth_token_exchange_failed_${resp.status}`);
  return resp.json();
}

// Fetch the user's profile; returns a normalized { email, sub, email_verified, name }.
async function fetchUserInfo(provider, accessToken, { fetchImpl = fetch } = {}) {
  const cfg = PROVIDERS[provider];
  const resp = await fetchImpl(cfg.userinfo, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!resp.ok) throw new Error(`oauth_userinfo_failed_${resp.status}`);
  const u = await resp.json();
  return { email: (u.email || '').toLowerCase(), sub: u.sub || u.id || '', email_verified: u.email_verified !== false, name: u.name || '' };
}

module.exports = { PROVIDERS, isSupported, signState, verifyState, authorizeUrl, exchangeCode, fetchUserInfo };
