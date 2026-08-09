const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// ipKeyGenerator (IPv6 normalization helper) exists only in newer express-rate-limit
// versions. Fall back to the raw IP so this works across versions.
const ipKey = typeof ipKeyGenerator === 'function' ? ipKeyGenerator : (ip) => ip || '';

const jsonError = (message) => (req, res) => res.status(429).json({ error: message });

// Login: 5 attempts / 15 min / IP — keyed by IP+email so attackers can't lock a user out.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKey(req.ip)}:${(req.body?.email || '').toLowerCase()}`,
  handler: jsonError('Too many login attempts. Try again in 15 minutes.'),
});

// Register: 5 / hour / IP — protects against signup spam.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonError('Too many accounts created from this IP. Try again later.'),
});

// The OTP endpoints are split across two shapes: the phone flow sends
// `user_id`, the email flow sends `pending_id`. The key generator used to read
// `user_id` only, so every /verify-email and /resend-verification request
// collapsed to the key `<ip>:anon` — simultaneously too loose (no per-account
// bound on brute force) and too strict (everyone behind one NAT shared a single
// bucket). Read whichever identifier the request actually carries.
const otpSubject = (req) =>
  req.body?.user_id ?? req.body?.pending_id ?? 'anon';

// OTP verify: 6 / 10 min / subject — bounds brute-force of the 6-digit code.
// Backed by a per-registration attempt_count in the DB (migration 027), which
// is the authoritative limit; this only bounds request volume.
const otpVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKey(req.ip)}:${otpSubject(req)}`,
  handler: jsonError('Too many verification attempts. Request a new code.'),
});

// OTP resend: 3 / 10 min / subject — discourages SMS and email bombing.
const otpResendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKey(req.ip)}:${otpSubject(req)}`,
  handler: jsonError('Too many resend requests. Try again in 10 minutes.'),
});

// Refresh: 30 / 15 min / IP — generous, but bounds runaway clients.
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonError('Too many token refresh requests.'),
});

// Forgot password: 5 / hour / IP — prevents email bombing.
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonError('Too many password reset requests. Try again in an hour.'),
});

// Reset password: 10 / hour / IP — the only auth route that previously had no
// limiter at all, leaving the reset token open to unbounded guessing.
const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonError('Too many password reset attempts. Try again in an hour.'),
});

// OAuth handshake: 20 / 15 min / IP — bounds state-table growth.
const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonError('Too many sign-in attempts. Try again shortly.'),
});

// Deploy triggers: 20 / 5 min / user — each deploy kicks off SSH + a build, so
// bound how fast a tenant can fire them. Keyed by authenticated user (must run
// after authenticate); falls back to IP.
const deployLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user?.id ? `u:${req.user.id}` : ipKey(req.ip)),
  handler: jsonError('Too many deploys. Please wait a few minutes.'),
});

// Leads / "talk to us": 5 / hour / IP — the public contact endpoint is
// unauthenticated (prospects submit before an account exists), so it's an open
// spam/abuse vector. Bound it per IP the same way registration is.
const leadsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonError('Too many inquiries from this IP. Please try again later or email us directly.'),
});

// Support chat: 30 / min / user — the rule-based bot runs several DB queries per
// call, so bound how fast a single authenticated user can hammer it. Keyed by
// user (must run after authenticate); falls back to IP.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user?.id ? `u:${req.user.id}` : ipKey(req.ip)),
  handler: jsonError('You are sending messages too quickly. Please slow down.'),
});

module.exports = {
  loginLimiter,
  registerLimiter,
  otpVerifyLimiter,
  otpResendLimiter,
  refreshLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  oauthLimiter,
  deployLimiter,
  chatLimiter,
  leadsLimiter,
};
