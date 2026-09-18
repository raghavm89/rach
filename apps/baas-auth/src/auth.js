'use strict';

/**
 * BaaS Auth (Phase 3, slice 2) — native, project-scoped. PURE handlers over an injected
 * `db` (store.js), so the flows are unit-tested without a live Postgres. Sessions are
 * end-user JWTs (sub = user id, role = 'authenticated').
 *
 * Signing (Supabase's current model): when a per-project ES256 signing key is present in the
 * context, tokens are signed ASYMMETRICALLY — verifiers use the public key (JWKS), never the
 * signing secret. Absent a signing key it falls back to the legacy HS256 project secret.
 *
 * Passwords are hashed with scrypt (Node core — no native build in alpine).
 */

const crypto = require('crypto');
const { mintUserToken, verifyToken, signing } = require('@rach/baas');
const { confirmationEmail } = require('./mailer');
const oauth = require('./oauth');
const oauthServer = require('./oauthServer');

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MIN_PW = 8;
const TTL_SEC = 3600;

// Access-token TTL for a request context — from the project's Auth config, else the default.
const ttlFor = (ctx) => (Number(ctx?.ttlSec) > 0 ? Number(ctx.ttlSec) : TTL_SEC);

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

// Opaque refresh tokens are stored hashed (like API keys) — the raw token is shown once.
const newRefreshToken = () => crypto.randomBytes(32).toString('base64url');
const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
// Migrated Supabase users carry a BCRYPT hash ($2a/$2b/$2y). Verify those with bcryptjs so their
// passwords keep working after a Supabase→RachBase migration; native users use scrypt.
const isBcryptHash = (h) => /^\$2[aby]\$/.test(String(h || ''));
function verifyPassword(pw, stored) {
  const s = String(stored || '');
  if (isBcryptHash(s)) { try { return require('bcryptjs').compareSync(pw, s); } catch { return false; } }
  const [scheme, salt, hash] = s.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const calc = crypto.scryptSync(pw, salt, 64).toString('hex');
  const a = Buffer.from(calc, 'hex'); const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Mint the access token. Prefer the project's ES256 signing key (asymmetric); else HS256.
// TTL comes from the project's Auth config (Sessions → access-token expiry).
function accessToken(ctx, user) {
  const { ref, secret, signingKey } = ctx;
  const ttlSec = ttlFor(ctx);
  const claims = { email: user.email, ...(user.is_anonymous ? { is_anonymous: true } : {}) };
  const token = signingKey?.privatePem
    ? signing.mintUserTokenAsym(signingKey.privatePem, ref, { sub: String(user.id), ttlSec, kid: signingKey.kid, claims })
    : mintUserToken(secret, ref, { sub: String(user.id), ttlSec, claims });
  return { token, ttlSec };
}

// Full session: access token + a fresh refresh token (persisted, hashed). The refresh token's
// family_id is the raw refresh token's hash at issue time — a stable id for the whole lineage.
async function session(db, ctx, user) {
  const { token, ttlSec } = accessToken(ctx, user);
  const refresh = newRefreshToken();
  const familyId = hashToken(refresh);
  await db.insertRefresh({ userId: user.id, tokenHash: hashToken(refresh), familyId });
  return {
    access_token: token, refresh_token: refresh, token_type: 'bearer', expires_in: ttlSec,
    user: { id: user.id, email: user.email, is_anonymous: Boolean(user.is_anonymous) },
  };
}

// Verify a session token: asymmetric (public key) first, HS256 fallback during transition.
function verifySession(ctx, token) {
  const { ref, secret, signingKey } = ctx;
  if (signingKey?.publicPem) {
    try { return signing.verifyTokenAsym(signingKey.publicPem, token, { ref }); } catch { /* try HS256 */ }
  }
  return verifyToken(secret, token, { ref });
}

async function signup(db, ctx, { email, password } = {}) {
  if (ctx?.allowSignups === false) return { status: 403, body: { error: 'signups_disabled', message: 'New sign-ups are disabled for this project.' } };
  email = String(email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { status: 400, body: { error: 'invalid_email' } };
  if (String(password || '').length < MIN_PW) return { status: 400, body: { error: 'weak_password', message: `min ${MIN_PW} chars` } };
  if (await db.findUserByEmail(email)) return { status: 409, body: { error: 'user_exists' } };

  // Email-confirmation gate: create the user UNCONFIRMED and withhold a session until they verify.
  if (ctx?.confirmEmail) {
    const confirm_token = newRefreshToken();
    const user = await db.createUser({ email, password_hash: hashPassword(password), email_confirmed: false, confirm_token });
    const body = { user: { id: user.id, email: user.email }, confirmation_required: true };
    // Until an email provider is wired, surface the token so local/dev flows can complete.
    if (!ctx.mailerConfigured) body.confirmation_token = confirm_token;
    await sendConfirmationEmail(ctx, user, confirm_token);
    return { status: 200, body };
  }

  const user = await db.createUser({ email, password_hash: hashPassword(password) });
  return { status: 201, body: await session(db, ctx, user) };
}

// Anonymous sign-in: a userless session (no email/password), gated by Auth config.
async function signupAnonymous(db, ctx) {
  if (!ctx?.allowAnonymous) return { status: 403, body: { error: 'anonymous_disabled', message: 'Anonymous sign-ins are disabled for this project.' } };
  const user = await db.createUser({ is_anonymous: true });
  return { status: 201, body: await session(db, ctx, user) };
}

// Confirm an email via its one-time token, then hand back a session (auto-login on confirm).
async function verifyEmail(db, ctx, { token } = {}) {
  if (!token) return { status: 400, body: { error: 'missing_token' } };
  const user = await db.confirmUserByToken(String(token));
  if (!user) return { status: 400, body: { error: 'invalid_token' } };
  return { status: 200, body: await session(db, ctx, user) };
}

async function login(db, ctx, { email, password } = {}) {
  email = String(email || '').trim().toLowerCase();
  const user = await db.findUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) return { status: 400, body: { error: 'invalid_credentials' } };
  if (!user.email_confirmed) return { status: 400, body: { error: 'email_not_confirmed', message: 'Confirm your email before signing in.' } };
  // Upgrade a migrated bcrypt hash to native scrypt on successful login (best-effort — never
  // block the login on the rehash). Over time every migrated user moves off bcrypt.
  if (isBcryptHash(user.password_hash) && typeof db.setPasswordHash === 'function') {
    try { await db.setPasswordHash(user.id, hashPassword(password)); } catch { /* best-effort */ }
  }
  return { status: 200, body: await session(db, ctx, user) };
}

// Exchange a refresh token for a new session. Honors the project's rotation settings:
//   - rotation ON  → issue a new refresh token, spend the old one (parent→child link).
//   - reuse of a SPENT token within `refreshReuseInterval` seconds → tolerated (network retry).
//   - reuse of a SPENT token after the interval → treated as theft: revoke the whole family.
//   - rotation OFF → new access token, same refresh token.
async function refreshSession(db, ctx, { refresh_token } = {}) {
  if (!refresh_token) return { status: 400, body: { error: 'missing_refresh_token' } };
  const row = await db.findRefresh(hashToken(refresh_token));
  if (!row || row.revoked_at) return { status: 401, body: { error: 'invalid_grant' } };

  const user = await db.findUserById(row.user_id);
  if (!user) return { status: 401, body: { error: 'invalid_grant' } };

  if (row.used_at) {
    const ageSec = (Date.now() - new Date(row.used_at).getTime()) / 1000;
    const interval = Number(ctx?.refreshReuseInterval) || 0;
    if (ageSec > interval) {                       // reuse after the grace window → compromise
      await db.revokeFamily(row.family_id);
      return { status: 401, body: { error: 'refresh_token_reused' } };
    }
    // within the grace window: mint a fresh access token, keep the same refresh token
    const { token, ttlSec } = accessToken(ctx, user);
    return { status: 200, body: { access_token: token, refresh_token, token_type: 'bearer', expires_in: ttlSec, user: { id: user.id, email: user.email } } };
  }

  if (ctx?.refreshRotation === false) {            // rotation disabled → same refresh token
    const { token, ttlSec } = accessToken(ctx, user);
    return { status: 200, body: { access_token: token, refresh_token, token_type: 'bearer', expires_in: ttlSec, user: { id: user.id, email: user.email } } };
  }

  // rotate: new refresh token in the same family, old one spent + linked to the new one
  const next = newRefreshToken();
  await db.insertRefresh({ userId: user.id, tokenHash: hashToken(next), familyId: row.family_id });
  await db.markRefreshUsed(row.token_hash, hashToken(next));
  const { token, ttlSec } = accessToken(ctx, user);
  return { status: 200, body: { access_token: token, refresh_token: next, token_type: 'bearer', expires_in: ttlSec, user: { id: user.id, email: user.email } } };
}

// ── Redirect allow-list (open-redirect / token-leak guard) ────────────────────
// The email-verify and OAuth-callback flows hand the freshly-minted session to the app by
// 302-ing to `redirect_to` with the tokens in the URL fragment. If `redirect_to` were honoured
// unchecked, an attacker could send a victim a link to the *legitimate* project that returns the
// victim's tokens to an attacker origin. So a `redirect_to` is only honoured when it is same-site
// or on the project's configured allow-list — mirroring Supabase's additional-redirect-URLs.
function _origin(u) { try { return new URL(u).origin; } catch { return null; } }

// Pure: is `redirectTo` a safe destination for this project's session hand-off?
// Accepts either `allowList` or a ctx's `redirectAllowList` so a ctx object can be passed directly.
function isRedirectAllowed(redirectTo, { siteUrl = '', projectUrl = '', allowList, redirectAllowList } = {}) {
  allowList = allowList ?? redirectAllowList ?? [];
  if (!redirectTo) return false;
  const rt = String(redirectTo).trim();
  if (!rt) return false;
  // Same-site relative path is safe; a protocol-relative `//host` is NOT (browsers treat it as absolute).
  if (rt.startsWith('/')) return !rt.startsWith('//');
  const rtOrigin = _origin(rt);
  if (!rtOrigin) return false; // not a valid absolute URL and not a safe relative path
  // Always trust the app's own site and the project gateway origin.
  for (const base of [siteUrl, projectUrl]) { if (_origin(base) === rtOrigin) return true; }
  for (const entry of Array.isArray(allowList) ? allowList : []) {
    const e = String(entry || '').trim();
    if (!e) continue;
    if (e === rt) return true;                                   // exact URL
    // Subdomain wildcard: scheme://*.domain[/path] — matches domain and any subdomain of it (only),
    // never a look-alike like domain.evil.com.
    const sub = /^([a-z][a-z0-9+.-]*:\/\/)\*\.([^/*]+)(\/.*)?$/i.exec(e);
    if (sub) {
      const [, scheme, baseHost, pathPart] = sub;
      try {
        const u = new URL(rt);
        const schemeOk = `${u.protocol}//`.toLowerCase() === scheme.toLowerCase();
        const hostOk = u.host === baseHost || u.host.endsWith(`.${baseHost}`);
        const pathOk = !pathPart || pathPart === '/' || u.pathname.startsWith(pathPart);
        if (schemeOk && hostOk && pathOk) return true;
      } catch { /* not a parseable URL → no match */ }
      continue;
    }
    if (e.endsWith('*') && rt.startsWith(e.slice(0, -1))) return true; // explicit prefix wildcard
    // A bare-origin entry (no path beyond '/') trusts the whole origin.
    const eo = _origin(e);
    if (eo && eo === rtOrigin) { let p = '/'; try { p = new URL(e).pathname || '/'; } catch { /* */ } if (p === '/') return true; }
  }
  return false;
}

// Return `redirectTo` when allowed, else fall back to the project's own site URL ('' if unset).
function safeRedirect(redirectTo, ctx = {}) {
  return isRedirectAllowed(redirectTo, { siteUrl: ctx.siteUrl, projectUrl: ctx.projectUrl, allowList: ctx.redirectAllowList })
    ? redirectTo
    : (ctx.siteUrl || '');
}

// ── OAuth sign-in (Google) ────────────────────────────────────────────────────
const oauthRedirectUri = (ctx) => `${String(ctx.projectUrl || '').replace(/\/$/, '')}/auth/v1/callback`;

// Begin an OAuth flow: build the redirect to the provider's consent screen.
function oauthStart(ctx, { provider, redirect_to } = {}) {
  provider = String(provider || '').toLowerCase();
  if (!oauth.isSupported(provider)) return { status: 400, body: { error: 'unsupported_provider' } };
  const pcfg = ctx.providers?.[provider];
  if (!pcfg?.enabled || !pcfg.client_id) return { status: 400, body: { error: 'provider_not_configured', message: `${provider} sign-in is not enabled/configured.` } };
  // Sanitize the return URL BEFORE it is signed into the state, so a rejected `redirect_to` can
  // never reach the callback's token-emitting 302 (falls back to the project site URL).
  const dest = safeRedirect(redirect_to || ctx.siteUrl || '', ctx);
  const state = oauth.signState(ctx.secret, { provider, redirect_to: dest, nonce: crypto.randomBytes(8).toString('hex') });
  return { status: 302, location: oauth.authorizeUrl(provider, { clientId: pcfg.client_id, redirectUri: oauthRedirectUri(ctx), state }) };
}

// Handle the provider callback: verify state, exchange the code, load the profile, find-or-create
// the user, and issue a session. `deps.fetchImpl` is injected for tests.
async function oauthCallback(db, ctx, { code, state } = {}, deps = {}) {
  if (!code || !state) return { status: 400, body: { error: 'missing_code_or_state' } };
  const st = oauth.verifyState(ctx.secret, state);
  if (!st) return { status: 400, body: { error: 'invalid_state' } };
  const provider = st.provider;
  const pcfg = ctx.providers?.[provider];
  if (!pcfg?.enabled || !pcfg.client_id || !pcfg.secret) return { status: 400, body: { error: 'provider_not_configured' } };

  let profile;
  try {
    const tokens = await oauth.exchangeCode(provider, { clientId: pcfg.client_id, clientSecret: pcfg.secret, code, redirectUri: oauthRedirectUri(ctx) }, deps);
    profile = await oauth.fetchUserInfo(provider, tokens.access_token, deps);
  } catch (e) {
    return { status: 502, body: { error: 'oauth_exchange_failed', message: e.message } };
  }
  if (!profile.email) return { status: 400, body: { error: 'no_email_from_provider' } };

  let user = await db.findUserByEmail(profile.email);
  if (!user) user = await db.createUser({ email: profile.email, email_confirmed: true }); // OAuth = verified, no password
  return { status: 200, body: await session(db, ctx, user), redirect_to: st.redirect_to };
}

// ── OAuth Server (project acts as an identity provider for third-party apps) ──────
const clientRedirectUris = (client) => (Array.isArray(client?.redirect_uris) ? client.redirect_uris : (() => { try { return JSON.parse(client?.redirect_uris || '[]'); } catch { return []; } })());

// Register a client app (admin console, or dynamic registration). Confidential clients get a
// secret returned ONCE; public clients use PKCE instead.
async function oauthRegisterClient(db, ctx, { name, redirect_uris, client_type = 'confidential' } = {}) {
  if (!ctx?.oauthServer?.enabled) return { status: 400, body: { error: 'oauth_server_disabled' } };
  name = String(name || '').trim();
  if (!name) return { status: 400, body: { error: 'name_required' } };
  const uris = (Array.isArray(redirect_uris) ? redirect_uris : []).filter((u) => typeof u === 'string' && /^https?:\/\//.test(u)).slice(0, 20);
  if (!uris.length) return { status: 400, body: { error: 'redirect_uris_required', message: 'At least one http(s) redirect URI is required.' } };
  const type = client_type === 'public' ? 'public' : 'confidential';
  const clientId = oauthServer.generateClientId();
  let secret = null, hash = null;
  if (type === 'confidential') { const s = oauthServer.generateClientSecret(); secret = s.secret; hash = s.hash; }
  const client = await db.createOAuthClient({ clientId, clientSecretHash: hash, clientType: type, name, redirectUris: uris });
  return { status: 201, body: { ...client, ...(secret ? { client_secret: secret } : {}) } }; // secret shown once
}
async function oauthListClients(db) { return { status: 200, body: { apps: await db.listOAuthClients() } }; }
async function oauthDeleteClient(db, clientId) { return { status: (await db.deleteOAuthClient(clientId)) ? 200 : 404, body: { deleted: clientId } }; }

// GET /oauth/authorize — validate the request + client, then hand off to the developer-hosted
// consent UI (site_url + authorization_path), preserving the OAuth params. No open redirect: the
// redirect_uri must be one the client registered.
async function oauthAuthorize(db, ctx, q = {}) {
  if (!ctx?.oauthServer?.enabled) return { status: 400, body: { error: 'oauth_server_disabled' } };
  const { client_id, redirect_uri, response_type } = q;
  if (response_type !== 'code') return { status: 400, body: { error: 'unsupported_response_type' } };
  if (!client_id || !redirect_uri) return { status: 400, body: { error: 'invalid_request' } };
  const client = await db.findOAuthClient(client_id);
  if (!client) return { status: 400, body: { error: 'invalid_client' } };
  if (!oauthServer.redirectUriAllowed(redirect_uri, clientRedirectUris(client))) return { status: 400, body: { error: 'invalid_redirect_uri' } };

  const base = `${String(ctx.siteUrl || '').replace(/\/$/, '')}${ctx.oauthServer.authorizationPath || '/oauth/consent'}`;
  const u = new URL(base);
  for (const k of ['client_id', 'redirect_uri', 'response_type', 'scope', 'state', 'code_challenge', 'code_challenge_method']) if (q[k]) u.searchParams.set(k, q[k]);
  if (ctx.projectUrl) u.searchParams.set('issuer', ctx.projectUrl); // so the consent UI knows which backend to call
  return { status: 302, location: u.toString() };
}

// POST /oauth/consent — the consent UI calls this with the logged-in user's session (Bearer) and
// the user's decision. Approval mints a single-use authorization code bound to {client,user,uri}.
async function oauthConsent(db, ctx, body = {}, userToken) {
  if (!ctx?.oauthServer?.enabled) return { status: 400, body: { error: 'oauth_server_disabled' } };
  let claims;
  try { claims = verifySession(ctx, userToken); } catch { return { status: 401, body: { error: 'invalid_session' } }; }

  const { client_id, redirect_uri, scope = null, state = null, code_challenge = null, code_challenge_method = null, approved } = body;
  const client = await db.findOAuthClient(client_id);
  if (!client) return { status: 400, body: { error: 'invalid_client' } };
  if (!oauthServer.redirectUriAllowed(redirect_uri, clientRedirectUris(client))) return { status: 400, body: { error: 'invalid_redirect_uri' } };

  if (!approved) return { status: 200, body: { redirect: oauthServer.buildRedirect(redirect_uri, { error: 'access_denied', state }) } };

  const { code, hash } = oauthServer.generateAuthCode();
  await db.insertAuthCode({
    codeHash: hash, clientId: client_id, userId: claims.sub, redirectUri: redirect_uri, scope,
    codeChallenge: code_challenge, codeChallengeMethod: code_challenge_method,
    expiresAt: new Date(Date.now() + 600_000), // 10 min
  });
  return { status: 200, body: { redirect: oauthServer.buildRedirect(redirect_uri, { code, state }) } };
}

// POST /oauth/token — exchange an authorization code (confidential secret OR public PKCE) for a
// session, or refresh a session. Returns the same token shape as password login.
async function oauthToken(db, ctx, body = {}) {
  const grant = body.grant_type;
  if (grant === 'refresh_token') return refreshSession(db, ctx, body);
  if (grant !== 'authorization_code') return { status: 400, body: { error: 'unsupported_grant_type' } };

  const { code, client_id, client_secret, redirect_uri, code_verifier } = body;
  if (!code || !client_id || !redirect_uri) return { status: 400, body: { error: 'invalid_request' } };
  const row = await db.findAuthCode(oauthServer.hashCode(code));
  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) return { status: 400, body: { error: 'invalid_grant' } };
  if (row.client_id !== client_id || row.redirect_uri !== redirect_uri) return { status: 400, body: { error: 'invalid_grant' } };

  const client = await db.findOAuthClient(client_id);
  if (!client) return { status: 400, body: { error: 'invalid_client' } };
  if (client.client_type === 'confidential') {
    if (!oauthServer.secretMatches(client_secret || '', client.client_secret_hash)) return { status: 401, body: { error: 'invalid_client' } };
  } else if (!oauthServer.verifyPkce(code_verifier, row.code_challenge, row.code_challenge_method || 'S256')) {
    return { status: 400, body: { error: 'invalid_grant', message: 'PKCE verification failed' } };
  }

  await db.markAuthCodeUsed(row.code_hash);
  const user = await db.findUserById(row.user_id);
  if (!user) return { status: 400, body: { error: 'invalid_grant' } };
  const sess = await session(db, ctx, user);
  return { status: 200, body: { ...sess, ...(row.scope ? { scope: row.scope } : {}) } };
}

// Send the confirmation email via the configured mailer (Brevo). The link hits the public
// GET /auth/v1/verify?token=… (clickable), which confirms + redirects to the site URL. When no
// mailer is configured this is a no-op and the token is surfaced in the signup response instead.
async function sendConfirmationEmail(ctx, user, token) {
  if (typeof ctx?.mailer !== 'function' || !user?.email) return null;
  const base = `${String(ctx.projectUrl || '').replace(/\/$/, '')}/auth/v1/verify`;
  const link = `${base}?token=${encodeURIComponent(token)}${ctx.siteUrl ? `&redirect_to=${encodeURIComponent(ctx.siteUrl)}` : ''}`;
  try { return await ctx.mailer({ to: user.email, ...confirmationEmail({ link }) }); }
  catch { return null; } // don't fail signup if the email provider hiccups
}

async function getUser(db, ctx, token) {
  let claims;
  try { claims = verifySession(ctx, token); } catch { return { status: 401, body: { error: 'invalid_token' } }; }
  const user = await db.findUserById(claims.sub);
  if (!user) return { status: 404, body: { error: 'user_not_found' } };
  return { status: 200, body: { id: user.id, email: user.email, created_at: user.created_at } };
}

// ── Data-principal rights (DPDP) — self-service, authenticated as the user's own token ─────────
const authed = (ctx, token, fn) => {
  let claims; try { claims = verifySession(ctx, token); } catch { return { status: 401, body: { error: 'invalid_token' } }; }
  return fn(claims);
};

// Right to erasure (DPDP §12): the user deletes their OWN account. refresh tokens + oauth codes
// cascade via FK. Application-table rows are the developer's to delete (per their retention policy).
async function deleteSelf(db, ctx, token) {
  return authed(ctx, token, async (claims) => {
    const ok = await db.deleteUser(claims.sub);
    return ok ? { status: 200, body: { deleted: Number(claims.sub) } } : { status: 404, body: { error: 'user_not_found' } };
  });
}

// Right to access (DPDP §11): export the personal data Auth holds about the user.
async function exportSelf(db, ctx, token) {
  return authed(ctx, token, async (claims) => {
    const user = await db.findUserById(claims.sub);
    if (!user) return { status: 404, body: { error: 'user_not_found' } };
    return { status: 200, body: {
      exported_at: new Date().toISOString(),
      user: { id: user.id, email: user.email, email_confirmed: Boolean(user.email_confirmed), is_anonymous: Boolean(user.is_anonymous), created_at: user.created_at },
      note: 'Personal data held by Auth. Data in your application tables is retrievable via the API under your own row-level access.',
    } };
  });
}

// Right to correction (DPDP §12): the user updates their own email.
async function updateSelf(db, ctx, token, { email } = {}) {
  return authed(ctx, token, async (claims) => {
    if (email != null && !EMAIL_RE.test(String(email))) return { status: 400, body: { error: 'invalid_email' } };
    const updated = await db.updateUser(claims.sub, { email });
    if (!updated) return { status: 404, body: { error: 'user_not_found' } };
    return { status: 200, body: { id: updated.id, email: updated.email, created_at: updated.created_at } };
  });
}

// ── Admin (service_role) — powers the dashboard Users screen ─────────────────────
async function listUsers(db, { limit, offset } = {}) {
  return { status: 200, body: await db.listUsers({ limit, offset }) };
}
async function adminCreateUser(db, _ctx, { email, password, auto_confirm = true } = {}) {
  email = String(email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { status: 400, body: { error: 'invalid_email' } };
  if (String(password || '').length < MIN_PW) return { status: 400, body: { error: 'weak_password', message: `min ${MIN_PW} chars` } };
  if (await db.findUserByEmail(email)) return { status: 409, body: { error: 'user_exists' } };
  // Admin-created users are confirmed by default (no email sent); uncheck auto-confirm to require it.
  const user = await db.createUser({ email, password_hash: hashPassword(password), email_confirmed: auto_confirm !== false });
  return { status: 201, body: { id: user.id, email: user.email, created_at: user.created_at, email_confirmed: user.email_confirmed } };
}
async function adminDeleteUser(db, id) {
  return { status: (await db.deleteUser(id)) ? 200 : 404, body: { deleted: Number(id) } };
}

module.exports = {
  signup, signupAnonymous, verifyEmail, login, refreshSession, getUser,
  deleteSelf, exportSelf, updateSelf,
  oauthStart, oauthCallback,
  oauthRegisterClient, oauthListClients, oauthDeleteClient, oauthAuthorize, oauthConsent, oauthToken,
  listUsers, adminCreateUser, adminDeleteUser,
  hashPassword, verifyPassword, isBcryptHash, EMAIL_RE, MIN_PW,
  isRedirectAllowed, safeRedirect,
};
