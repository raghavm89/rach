'use strict';

/**
 * OAuth 2.0 routes — Google and GitHub.
 *
 * Flow:
 *   1. Browser hits GET /api/auth/google
 *      → we mint a random `state`, persist it, redirect to the provider
 *   2. Provider redirects to /api/auth/google/callback with ?code=xxx&state=yyy
 *   3. We verify `state`, exchange code → provider token → profile
 *   4. Resolve the local user via oauth_identities (never by email alone)
 *   5. Issue the same access + refresh token pair as password login, set the
 *      HttpOnly refresh cookie, and redirect to /auth-callback with NO
 *      credentials in the URL. The client calls /api/auth/refresh to hydrate.
 *
 * Notes on what changed and why:
 *   - `state` was absent entirely, leaving both providers open to login-CSRF.
 *   - The callback redirected to /auth/callback; the Next route is
 *     /auth-callback, so every OAuth sign-in landed on a 404.
 *   - Only an access token was issued (no refresh cookie), so the very next
 *     page load called /api/auth/refresh, got a 401, and signed the user out.
 *   - The access token and the full user object were passed in the query
 *     string, putting credentials in browser history, Referer headers and
 *     every proxy log on the path.
 *   - Users were matched on email alone with no provider record, so anyone
 *     controlling an IdP account bearing a victim's address inherited the
 *     victim's account. Google's `email_verified` was never checked.
 *   - INSERT targeted users.password_hash, which did not exist until
 *     migration 027 — new OAuth users always failed.
 */

const { Router } = require('express');
const crypto = require('crypto');
const pool = require('@rach/core').pool;
const asyncHandler = require('@rach/core').asyncHandler;
const { oauthLimiter } = require('@rach/core').rateLimit;
const { User } = require('../models/user');
const { publicSignupEnabled } = require('../lib/signup');
const { issueTokens, normalizeEmail } = require('../controllers/authController');

const router = Router();

/**
 * Absolute origins, normalized.
 *
 * A schemeless value here is silently destructive: `res.redirect('rachbase.com/x')`
 * is a *relative* redirect, so the user lands on
 * `http://<backend-host>/rachbase.com/x` instead of the frontend. Same class of
 * bug in reset emails. Coerce a bare host to https:// and warn loudly.
 */
function normalizeOrigin(value, fallback, name) {
  let url = (value || fallback).trim().replace(/\/$/, '');
  if (!/^https?:\/\//i.test(url)) {
    console.warn(`[oauth] ${name} has no scheme ("${url}") — assuming https://. Set it explicitly.`);
    url = `https://${url}`;
  }
  return url;
}

const APP_URL     = normalizeOrigin(process.env.APP_URL,     'http://localhost:3002', 'APP_URL');
const BACKEND_URL = normalizeOrigin(process.env.BACKEND_URL, 'http://localhost:3000', 'BACKEND_URL');

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes to complete the handshake

// ── CSRF state ────────────────────────────────────────────────────────────────

async function createState(provider) {
  const state = crypto.randomBytes(32).toString('hex');
  await pool.query(
    `INSERT INTO oauth_states (state, provider, expires_at) VALUES ($1, $2, $3)`,
    [state, provider, new Date(Date.now() + STATE_TTL_MS)]
  );
  return state;
}

// Single-use: the row is deleted as it is read, so a replayed callback fails.
async function consumeState(state, provider) {
  if (!state || typeof state !== 'string') return false;
  const { rows } = await pool.query(
    `DELETE FROM oauth_states
      WHERE state = $1 AND provider = $2 AND expires_at > NOW()
      RETURNING state`,
    [state, provider]
  );
  return rows.length > 0;
}

// Opportunistic cleanup of expired rows.
async function pruneStates() {
  try {
    await pool.query('DELETE FROM oauth_states WHERE expires_at < NOW()');
  } catch (e) {
    console.error('[oauth] state prune failed:', e.message);
  }
}

// ── Redirect helpers ──────────────────────────────────────────────────────────

// No token, no profile — just a signal. The refresh cookie carries the session.
function redirectSuccess(res) {
  res.redirect(`${APP_URL}/auth-callback?status=ok`);
}

// Only ever emit codes from this map. Raw exception text used to be forwarded
// straight into the user-facing URL.
const ERROR_MESSAGES = {
  cancelled:       'Sign-in was cancelled.',
  invalid_state:   'This sign-in link expired or was already used. Please try again.',
  exchange_failed: 'We could not complete sign-in with that provider. Please try again.',
  no_email:        'That account has no verified email address we can use.',
  unverified:      'Your email address is not verified. Verify it first, then try again.',
  no_account:      'No RachDev account exists for this email. Ask your organization admin to add you.',
  server_error:    'Something went wrong during sign-in. Please try again.',
};

function redirectError(res, code) {
  const safe = ERROR_MESSAGES[code] ? code : 'server_error';
  res.redirect(`${APP_URL}/auth-callback?error=${safe}`);
}

// ── Identity resolution ───────────────────────────────────────────────────────

/**
 * Resolve a provider profile to a local user.
 *
 * Precedence:
 *   1. Existing oauth_identities row for (provider, provider_user_id) — the
 *      only truly stable identifier a provider gives us. Emails change; the
 *      subject id does not.
 *   2. An existing local user with the same email, but ONLY when the provider
 *      asserts the email is verified AND the local account is email-verified.
 *      Anything weaker lets an IdP account claim a local one.
 *   3. Otherwise create a fresh, password-less user.
 */
async function resolveOAuthUser({ provider, providerUserId, email, name, emailVerified }) {
  const normalized = normalizeEmail(email);

  const { rows: linked } = await pool.query(
    `SELECT u.*, t.name AS tenant_name
       FROM oauth_identities oi
       JOIN users u ON u.id = oi.user_id
       LEFT JOIN tenants t ON t.id = u.tenant_id
      WHERE oi.provider = $1 AND oi.provider_user_id = $2`,
    [provider, String(providerUserId)]
  );
  if (linked.length) return linked[0];

  if (!emailVerified) {
    throw Object.assign(new Error('provider email unverified'), { code: 'unverified' });
  }

  const existing = await User.findByEmail(normalized);

  if (existing) {
    if (!existing.email_verified) {
      // A local account exists but has never proven ownership of the address.
      // Linking here would let whoever holds the IdP account step into it.
      throw Object.assign(new Error('local email unverified'), { code: 'unverified' });
    }
    await pool.query(
      `INSERT INTO oauth_identities (user_id, provider, provider_user_id, email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (provider, provider_user_id) DO NOTHING`,
      [existing.id, provider, String(providerUserId), normalized]
    );
    return existing;
  }

  // No local account and self-serve signup is off: OAuth may only sign in
  // users an org admin already provisioned — never auto-create one.
  if (!publicSignupEnabled()) {
    throw Object.assign(new Error('no RachDev account for this email'), { code: 'no_account' });
  }

  const created = await User.create({
    name          : name || normalized.split('@')[0],
    email         : normalized,
    password      : null,        // OAuth-only; a password can be set via forgot-password
    phone_number  : null,
    role          : 'tenant_user',
    email_verified: true,
  });

  await pool.query(
    `INSERT INTO oauth_identities (user_id, provider, provider_user_id, email)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (provider, provider_user_id) DO NOTHING`,
    [created.id, provider, String(providerUserId), normalized]
  );

  // OAuth accounts have no phone to verify, and password login gates on
  // phone_verified — mark it so the account isn't stuck in limbo.
  await User.markPhoneVerified(created.id);

  return await User.findById(created.id);
}

// Shared tail: issue the session, then redirect with nothing sensitive in the URL.
async function completeSignIn(res, profile) {
  const user = await resolveOAuthUser(profile);
  await issueTokens(user, res);
  return redirectSuccess(res);
}

// ── Google ────────────────────────────────────────────────────────────────────

router.get('/google', oauthLimiter, asyncHandler(async (req, res) => {
  await pruneStates();
  const state = await createState('google');
  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID,
    redirect_uri:  `${BACKEND_URL}/api/auth/google/callback`,
    response_type: 'code',
    scope:         'openid email profile',
    access_type:   'offline',
    prompt:        'select_account',
    state,
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}));

router.get('/google/callback', asyncHandler(async (req, res) => {
  const { code, state, error } = req.query;
  if (error || !code) return redirectError(res, 'cancelled');
  if (!(await consumeState(state, 'google'))) return redirectError(res, 'invalid_state');

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  `${BACKEND_URL}/api/auth/google/callback`,
        grant_type:    'authorization_code',
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok) {
      throw Object.assign(new Error(tokens.error_description || 'exchange'), { code: 'exchange_failed' });
    }

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json();
    if (!profile.email || !profile.sub) {
      throw Object.assign(new Error('no email'), { code: 'no_email' });
    }

    return await completeSignIn(res, {
      provider      : 'google',
      providerUserId: profile.sub,
      email         : profile.email,
      name          : profile.name,
      // Returned as a boolean or the string "true" depending on endpoint
      // version. This was never checked at all before.
      emailVerified : profile.email_verified === true || profile.email_verified === 'true',
    });
  } catch (err) {
    console.error('[oauth/google]', err.message);
    return redirectError(res, err.code || 'server_error');
  }
}));

// ── GitHub ────────────────────────────────────────────────────────────────────

router.get('/github', oauthLimiter, asyncHandler(async (req, res) => {
  await pruneStates();
  const state = await createState('github');
  const params = new URLSearchParams({
    client_id:    process.env.GITHUB_CLIENT_ID,
    redirect_uri: `${BACKEND_URL}/api/auth/github/callback`,
    scope:        'read:user user:email',
    state,
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
}));

router.get('/github/callback', asyncHandler(async (req, res) => {
  const { code, state, error } = req.query;
  if (error || !code) return redirectError(res, 'cancelled');
  if (!(await consumeState(state, 'github'))) return redirectError(res, 'invalid_state');

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id:     process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri:  `${BACKEND_URL}/api/auth/github/callback`,
      }),
    });
    const tokens = await tokenRes.json();
    if (tokens.error) {
      throw Object.assign(new Error(tokens.error_description || 'exchange'), { code: 'exchange_failed' });
    }

    const ghHeaders = {
      Authorization: `Bearer ${tokens.access_token}`,
      'User-Agent':  'Rachbase',
      Accept:        'application/vnd.github+json',
    };

    const profileRes = await fetch('https://api.github.com/user', { headers: ghHeaders });
    const profile = await profileRes.json();
    if (!profile.id) {
      throw Object.assign(new Error('no profile'), { code: 'exchange_failed' });
    }

    // profile.email is whatever the user made public and is not necessarily
    // verified — always resolve the primary verified address instead.
    const emailsRes = await fetch('https://api.github.com/user/emails', { headers: ghHeaders });
    const emails = await emailsRes.json();
    const primary = Array.isArray(emails)
      ? emails.find((e) => e.primary && e.verified)
      : null;

    if (!primary?.email) {
      throw Object.assign(new Error('no verified email'), { code: 'no_email' });
    }

    return await completeSignIn(res, {
      provider      : 'github',
      providerUserId: profile.id,
      email         : primary.email,
      name          : profile.name || profile.login,
      emailVerified : true,   // guaranteed by the `verified` filter above
    });
  } catch (err) {
    console.error('[oauth/github]', err.message);
    return redirectError(res, err.code || 'server_error');
  }
}));

module.exports = router;
