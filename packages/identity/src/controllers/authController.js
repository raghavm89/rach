const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ms = require('ms');
const { validationResult } = require('express-validator');
const { parsePhoneNumber } = require('libphonenumber-js');
const pool = require('@rach/core').pool;
const { User, ROLES } = require('../models/user');
const VerificationCode = require('../models/verification');
const RefreshToken = require('../models/refreshToken');
const { sendOtp } = require('@rach/core').sms;
const { sendVerificationOtp, sendPasswordResetEmail } = require('@rach/core').brevo;
const asyncHandler = require('@rach/core').asyncHandler;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BCRYPT_COST        = parseInt(process.env.BCRYPT_COST, 10) || 12;
const MAX_RESENDS        = 5;
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds between resends
const MAX_OTP_ATTEMPTS   = 5;         // wrong guesses before the code is burned

// ── Token lifetimes ───────────────────────────────────────────────────────────
// Single source of truth. Previously the access-token TTL was declared in three
// places (15m default here, 8h hardcoded in oauth.js, 8h assumed by the web
// AuthContext's 7h refresh interval), so password sessions died after 15 minutes
// with nothing scheduled to renew them.
const ACCESS_TOKEN_TTL  = process.env.JWT_ACCESS_EXPIRES_IN  || '30m';
const REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

// Refresh cookie is scoped to the auth endpoints only.
// sameSite must be 'lax', not 'strict': the OAuth provider redirects the user
// back via a cross-site top-level navigation, and 'strict' withholds the cookie
// on exactly that request.
const REFRESH_COOKIE_PATH = '/api/auth';
function refreshCookieOptions(expires) {
  return {
    httpOnly: true,
    secure  : process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires,
    path    : REFRESH_COOKIE_PATH,
  };
}

// Pre-computed bcrypt hash of an unguessable string. Used as a dummy comparison
// target so login response time doesn't reveal whether an email exists.
const DUMMY_BCRYPT_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), BCRYPT_COST);

function generateOtp() {
  // crypto.randomInt(min, max) — uniform, cryptographically secure
  return String(crypto.randomInt(100000, 1000000));
}

function otpExpiry() {
  return new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
}

function otpEmailExpiry() {
  return new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// SHA-256, matching how refresh tokens are stored. Reset tokens used to sit in
// the database in plaintext, so a read-only leak handed over every in-flight
// password reset.
function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

// Length-independent constant-time comparison for secrets that arrive as
// user input (OTPs, reset tokens).
function safeEqual(a, b) {
  const ba = Buffer.from(hashToken(a), 'hex');
  const bb = Buffer.from(hashToken(b), 'hex');
  return crypto.timingSafeEqual(ba, bb);
}

// The public shape of a user. Never leak password_hash or reset-token columns.
function publicUser(u) {
  if (!u) return null;
  return {
    id            : u.id,
    name          : u.name,
    email         : u.email,
    phone_number  : u.phone_number,
    address       : u.address,
    role          : u.role,
    tenant_id     : u.tenant_id     ?? null,
    tenant_name   : u.tenant_name   ?? null,
    email_verified: u.email_verified ?? false,
    phone_verified: u.phone_verified ?? false,
  };
}


function toE164(rawPhone) {
  try {
    const parsed = parsePhoneNumber(rawPhone);
    return parsed.isValid() ? parsed.format('E.164') : null;
  } catch {
    return null;
  }
}

// Issues a short-lived access token (JWT) + long-lived refresh token (opaque).
// If `familyId` is provided, the new refresh token continues that family
// (rotation); otherwise a new family is started.
async function issueTokens(user, res, familyId = null) {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role, tenant_id: user.tenant_id ?? null },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );

  const refreshTtlMs = ms(REFRESH_TOKEN_TTL);
  if (typeof refreshTtlMs !== 'number') {
    throw new Error(`Invalid JWT_REFRESH_EXPIRES_IN: ${REFRESH_TOKEN_TTL}`);
  }
  const plainRefresh = crypto.randomBytes(40).toString('hex');
  const refreshExpiresAt = new Date(Date.now() + refreshTtlMs);

  if (familyId) {
    await RefreshToken.rotate(user.id, familyId, plainRefresh, refreshExpiresAt);
  } else {
    await RefreshToken.save(user.id, plainRefresh, refreshExpiresAt);
  }

  // Set refresh token as HttpOnly cookie — JS cannot read it
  res.cookie('refresh_token', plainRefresh, refreshCookieOptions(refreshExpiresAt));

  return accessToken;
}

// Seconds until the access token expires — lets the client schedule a silent
// refresh instead of guessing the lifetime.
function accessTokenExpiresIn() {
  const msValue = ms(ACCESS_TOKEN_TTL);
  return typeof msValue === 'number' ? Math.floor(msValue / 1000) : 1800;
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

// POST /api/auth/register
// Validates the request and stores it in pending_registrations.
// No users row is created until the OTP is confirmed via /verify-email.
async function register(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

  const { name, password, phone_number, address, role = 'tenant_user' } = req.body;
  const email = normalizeEmail(req.body.email);

  // System admin and tenant_admin roles cannot be self-registered
  if (!ROLES.includes(role) || role === 'admin' || role === 'tenant_admin') {
    return res.status(400).json({ error: 'Role must be "tenant_user" or "developer" on self-registration' });
  }

  // Validate phone only when provided
  let e164 = null;
  if (phone_number && phone_number.trim()) {
    e164 = toE164(phone_number);
    if (!e164) {
      return res.status(400).json({ error: 'Invalid phone number. Include country code (e.g. +1 415 555 0100).' });
    }
  }

  // Reject if already a verified user
  const checks = [User.findByEmail(email)];
  if (e164) checks.push(User.findByPhone(e164));
  const [existingEmail, existingPhone] = await Promise.all(checks);
  if (existingEmail) return res.status(409).json({ error: 'Email already registered' });
  if (existingPhone) return res.status(409).json({ error: 'Phone number already registered' });

  const hashed = await bcrypt.hash(password, BCRYPT_COST);
  const otp     = generateOtp();
  const expires = otpEmailExpiry();

  // Upsert into pending_registrations — allows retrying registration with the
  // same email before verification (refreshes OTP and all fields).
  const { rows } = await pool.query(
    `INSERT INTO pending_registrations
       (name, email, password_hash, phone_number, address, role, otp_token, otp_expires_at,
        resend_count, last_resent_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, NOW())
     ON CONFLICT (email) DO UPDATE SET
       attempt_count = 0,
       name          = EXCLUDED.name,
       password_hash = EXCLUDED.password_hash,
       phone_number  = EXCLUDED.phone_number,
       address       = EXCLUDED.address,
       role          = EXCLUDED.role,
       otp_token     = EXCLUDED.otp_token,
       otp_expires_at= EXCLUDED.otp_expires_at,
       resend_count  = 0,
       last_resent_at= NOW(),
       created_at    = NOW()
     RETURNING id, otp_expires_at`,
    [name, email, hashed, e164, address || null, role, otp, expires]
  );
  const pendingId  = rows[0].id;
  const expiresAt  = rows[0].otp_expires_at;

  let emailSent = false;
  try {
    emailSent = await sendVerificationOtp({ toEmail: email, toName: name, otp });
  } catch (e) {
    console.error('[register] Failed to send OTP email:', e.message);
  }

  return res.status(201).json({
    message   : 'We sent a 6-digit code to your email. Enter it to complete registration.',
    email_sent: emailSent,
    pending_id: pendingId,
    expires_at: expiresAt,
  });
}

// POST /api/auth/verify-phone
// Completes signup — issues token pair on success
async function verifyPhone(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

  const { user_id, code } = req.body;

  const record = await VerificationCode.findValid(user_id, code);
  if (!record) return res.status(400).json({ error: 'Invalid or expired verification code' });

  await VerificationCode.markUsed(record.id);
  const user = await User.markPhoneVerified(user_id);

  const access_token = await issueTokens(user, res);

  return res.json({
    message: 'Phone verified successfully',
    access_token,
    expires_in: accessTokenExpiresIn(),
    user: publicUser(user),
  });
}

// POST /api/auth/resend-otp
async function resendOtp(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

  const { user_id } = req.body;

  const user = await User.findById(user_id);

  // Respond identically whether or not the id resolves. The previous
  // 404 "User not found" / 400 "already verified" split let anyone walk the
  // sequential id space and learn which accounts exist and their verification
  // state.
  const GENERIC = { message: 'If that account needs verification, a new code has been sent.' };

  if (!user || user.phone_verified || !user.phone_number) return res.json(GENERIC);

  const code = generateOtp();
  await VerificationCode.create(user.id, code, otpExpiry());
  try {
    await sendOtp(user.phone_number, code);
  } catch (e) {
    console.error('[resendOtp] Failed to send SMS:', e.message);
  }

  return res.json(GENERIC);
}

// POST /api/auth/verify-email  { pending_id, code }
// Validates OTP → creates the real user row → deletes the pending record → issues tokens.
async function verifyEmail(req, res) {
  // The route declares express-validator rules; without this call they were
  // declared and never enforced.
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

  const { pending_id, code } = req.body;

  const { rows: pendingRows } = await pool.query(
    'SELECT * FROM pending_registrations WHERE id = $1',
    [pending_id]
  );
  const pending = pendingRows[0];

  if (!pending) {
    return res.status(404).json({ error: 'Verification request not found or already completed' });
  }

  // Expiry is checked before the code so an expired code reports as expired
  // rather than as wrong, and doesn't burn an attempt.
  if (new Date(pending.otp_expires_at) <= new Date()) {
    return res.status(400).json({ error: 'Code has expired. Request a new one.' });
  }

  if (pending.attempt_count >= MAX_OTP_ATTEMPTS) {
    return res.status(429).json({
      error  : 'Too many incorrect codes',
      message: 'This code has been locked. Request a new one to continue.',
      locked : true,
    });
  }

  if (!pending.otp_token || !safeEqual(pending.otp_token, String(code))) {
    const { rows: bumped } = await pool.query(
      `UPDATE pending_registrations SET attempt_count = attempt_count + 1
        WHERE id = $1 RETURNING attempt_count`,
      [pending_id]
    );
    const used = bumped[0]?.attempt_count ?? 0;
    const left = Math.max(0, MAX_OTP_ATTEMPTS - used);
    return res.status(400).json({
      error           : 'Invalid verification code',
      attempts_left   : left,
      ...(left === 0 ? { locked: true, message: 'Too many incorrect codes. Request a new one.' } : {}),
    });
  }

  // Re-check for conflicts in case someone else registered the same email/phone
  const [existingEmail, existingPhone] = await Promise.all([
    User.findByEmail(pending.email),
    pending.phone_number ? User.findByPhone(pending.phone_number) : Promise.resolve(null),
  ]);
  if (existingEmail) {
    await pool.query('DELETE FROM pending_registrations WHERE id = $1', [pending_id]);
    return res.status(409).json({ error: 'Email already registered' });
  }
  if (existingPhone) {
    await pool.query('DELETE FROM pending_registrations WHERE id = $1', [pending_id]);
    return res.status(409).json({ error: 'Phone number already registered' });
  }

  // Create the real user (password is already hashed in the pending row)
  let user;
  try {
    user = await User.create({
      name        : pending.name,
      email       : pending.email,
      password    : pending.password_hash,
      phone_number: pending.phone_number,
      address     : pending.address,
      role        : pending.role,
      tenant_id   : null,
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email or phone already registered' });
    }
    throw err;
  }

  // Mark verified and clean up
  await Promise.all([
    User.markPhoneVerified(user.id),
    User.markEmailVerified(user.id),
    pool.query('DELETE FROM pending_registrations WHERE id = $1', [pending_id]),
  ]);

  const freshUser    = await User.findById(user.id);
  const access_token = await issueTokens(freshUser, res);

  return res.json({
    message: 'Email verified. Your account is ready.',
    access_token,
    expires_in: accessTokenExpiresIn(),
    user: publicUser(freshUser),
  });
}

// POST /api/auth/resend-verification  { pending_id }
async function resendVerification(req, res) {
  const { pending_id } = req.body;
  if (!pending_id) return res.status(400).json({ error: 'pending_id is required' });

  const { rows } = await pool.query(
    'SELECT * FROM pending_registrations WHERE id = $1',
    [pending_id]
  );
  const pending = rows[0];
  if (!pending) {
    return res.status(404).json({ error: 'Verification request not found or already completed' });
  }

  // Max resend attempts
  if (pending.resend_count >= MAX_RESENDS) {
    return res.status(429).json({
      error            : 'Maximum resend attempts reached. Please register again.',
      resends_remaining: 0,
    });
  }

  // Cooldown — must wait 60 s between resends
  if (pending.last_resent_at) {
    const elapsed = Date.now() - new Date(pending.last_resent_at).getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      return res.status(429).json({
        error      : `Please wait ${waitSec}s before requesting a new code`,
        retry_after: waitSec,
      });
    }
  }

  const otp     = generateOtp();
  const expires = otpEmailExpiry();

  await pool.query(
    `UPDATE pending_registrations
     SET otp_token = $1, otp_expires_at = $2,
         resend_count = resend_count + 1, last_resent_at = NOW(),
         attempt_count = 0
     WHERE id = $3`,
    [otp, expires, pending_id]
  );

  let emailSent = false;
  try {
    emailSent = await sendVerificationOtp({ toEmail: pending.email, toName: pending.name, otp });
  } catch (e) {
    console.error('[resendVerification] Failed to send OTP email:', e.message);
  }

  return res.json({
    message          : 'Verification code resent. Please check your inbox.',
    email_sent       : emailSent,
    resends_remaining: MAX_RESENDS - (pending.resend_count + 1),
    expires_at       : expires.toISOString(),
  });
}

// POST /api/auth/login
async function login(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

  const { password } = req.body;
  const email = normalizeEmail(req.body.email);

  const user = await User.findByEmail(email);
  // Always run bcrypt to keep response time uniform whether the email exists or not.
  const match = await bcrypt.compare(password, user?.password_hash || DUMMY_BCRYPT_HASH);

  if (!user) {
    // This email may belong to a signup that was started but never verified.
    // Previously both branches returned an identical body and never included
    // pending_id, so the client's "resume verification" path was unreachable
    // and the user was told no account existed while their pending row sat in
    // the table blocking re-registration.
    const { rows: pending } = await pool.query(
      'SELECT id, otp_expires_at, resend_count FROM pending_registrations WHERE email = $1',
      [email]
    );

    if (pending.length) {
      return res.status(403).json({
        error     : 'Email not verified',
        message   : 'You started signing up but never confirmed your email. Enter the code we sent you to finish.',
        pending_id: pending[0].id,
        expires_at: pending[0].otp_expires_at,
        resends_remaining: Math.max(0, MAX_RESENDS - (pending[0].resend_count || 0)),
      });
    }

    // NOTE: this response deliberately confirms that no account exists for the
    // address, which is a user-enumeration oracle. It is a product decision —
    // see docs/AUTHENTICATION.md § "Account enumeration". If that tradeoff is
    // ever revisited, return the same 401 as the bad-password branch below.
    return res.status(404).json({
      error      : 'Account not found',
      message    : 'No account exists with this email address. Please create an account to get started.',
      no_account : true,
    });
  }

  if (!match) return res.status(401).json({ error: 'Invalid credentials' });

  // Accounts created through OAuth have no password of their own.
  if (!user.password_hash) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (!user.phone_verified) {
    // Only attempt OTP if the user actually has a phone number
    if (user.phone_number) {
      const code = generateOtp();
      await VerificationCode.create(user.id, code, otpExpiry());
      await sendOtp(user.phone_number, code);
    }
    return res.status(403).json({
      error: 'Phone number not verified',
      message: user.phone_number
        ? 'A new verification code has been sent to your phone.'
        : 'Account not yet verified. Please contact support.',
      user_id: user.id,
    });
  }

  const access_token = await issueTokens(user, res);

  return res.json({
    access_token,
    expires_in: accessTokenExpiresIn(),
    user: publicUser(user),
  });
}

// POST /api/auth/refresh
// Client sends the HttpOnly cookie automatically; returns a new access token.
// Token-reuse detection: if a revoked token is presented, the entire family
// is revoked — this signals a stolen-token replay.
async function refresh(req, res) {
  const plainRefresh = req.cookies?.refresh_token;
  if (!plainRefresh) {
    return res.status(401).json({ error: 'Refresh token missing' });
  }

  const stored = await RefreshToken.findByToken(plainRefresh);
  if (!stored) {
    res.clearCookie('refresh_token', { path: REFRESH_COOKIE_PATH });
    return res.status(401).json({ error: 'Refresh token invalid' });
  }

  // Replay of an already-rotated (revoked) token → kill the whole family.
  if (stored.revoked) {
    await RefreshToken.revokeFamily(stored.family_id);
    res.clearCookie('refresh_token', { path: REFRESH_COOKIE_PATH });
    return res.status(401).json({ error: 'Refresh token reuse detected; session terminated' });
  }

  if (new Date(stored.expires_at) <= new Date()) {
    // Without clearing, the browser keeps replaying a dead cookie on every
    // page load and the client retries forever.
    res.clearCookie('refresh_token', { path: REFRESH_COOKIE_PATH });
    return res.status(401).json({ error: 'Refresh token expired' });
  }

  // Rotate within the same family
  await RefreshToken.revoke(plainRefresh);

  const user = await User.findById(stored.user_id);
  if (!user) {
    res.clearCookie('refresh_token', { path: REFRESH_COOKIE_PATH });
    return res.status(401).json({ error: 'User not found' });
  }

  const access_token = await issueTokens(user, res, stored.family_id);

  // `user` is returned so a freshly-redirected OAuth client can hydrate its
  // session from the cookie alone — no token or profile in the callback URL.
  return res.json({
    access_token,
    expires_in: accessTokenExpiresIn(),
    user: publicUser(user),
  });
}

// POST /api/auth/logout
async function logout(req, res) {
  const plainRefresh = req.cookies?.refresh_token;
  if (plainRefresh) {
    await RefreshToken.revoke(plainRefresh);
  }
  res.clearCookie('refresh_token', { path: REFRESH_COOKIE_PATH });
  return res.json({ message: 'Logged out successfully' });
}

// POST /api/auth/logout-all  — revokes every session for this user
async function logoutAll(req, res) {
  await RefreshToken.revokeAll(req.user.id);
  res.clearCookie('refresh_token', { path: REFRESH_COOKIE_PATH });
  return res.json({ message: 'Logged out from all devices' });
}

// POST /api/auth/forgot-password
// Always responds 200 to prevent email enumeration.
async function forgotPassword(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ error: errors.array()[0].msg });

  const user = await User.findByEmail(normalizeEmail(req.body.email));

  if (user && user.email_verified) {
    const token   = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // Only the hash is persisted; the plaintext exists solely inside the email.
    await pool.query(
      `UPDATE users
         SET password_reset_token = $1, password_reset_expires_at = $2
       WHERE id = $3`,
      [hashToken(token), expires, user.id]
    );

    // Same normalization as oauth.js: a schemeless APP_URL produces a reset
    // link the user's mail client cannot resolve.
    let appUrl = (process.env.APP_URL || 'http://localhost:3002').trim().replace(/\/$/, '');
    if (!/^https?:\/\//i.test(appUrl)) {
      console.warn(`[forgotPassword] APP_URL has no scheme ("${appUrl}") — assuming https://`);
      appUrl = `https://${appUrl}`;
    }
    const resetUrl = `${appUrl}/reset-password?token=${token}`;
    await sendPasswordResetEmail({ toEmail: user.email, toName: user.name, resetUrl });
  }

  // Always return the same message regardless of whether the email exists
  return res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
}

// POST /api/auth/reset-password
async function resetPassword(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ error: errors.array()[0].msg });

  const { token, password } = req.body;

  const { rows } = await pool.query(
    `SELECT id, name, email FROM users
      WHERE password_reset_token = $1
        AND password_reset_expires_at > NOW()`,
    [hashToken(token)]
  );

  if (!rows.length) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });
  }

  const user = rows[0];
  const hashed = await bcrypt.hash(password, BCRYPT_COST);

  await pool.query(
    `UPDATE users
        SET password_hash = $1,
            password_reset_token = NULL,
            password_reset_expires_at = NULL
      WHERE id = $2`,
    [hashed, user.id]
  );

  // Invalidate all existing sessions so old devices are logged out
  await RefreshToken.revokeAll(user.id);

  return res.json({ message: 'Password reset successfully. You can now log in with your new password.' });
}

module.exports = {
  register:            asyncHandler(register),
  verifyEmail:         asyncHandler(verifyEmail),
  resendVerification:  asyncHandler(resendVerification),
  verifyPhone:         asyncHandler(verifyPhone),
  resendOtp:           asyncHandler(resendOtp),
  login:               asyncHandler(login),
  refresh:             asyncHandler(refresh),
  logout:              asyncHandler(logout),
  logoutAll:           asyncHandler(logoutAll),
  forgotPassword:      asyncHandler(forgotPassword),
  resetPassword:       asyncHandler(resetPassword),

  // Shared with the OAuth router so both paths issue identical sessions.
  issueTokens,
  accessTokenExpiresIn,
  publicUser,
  normalizeEmail,
  hashToken,
};
