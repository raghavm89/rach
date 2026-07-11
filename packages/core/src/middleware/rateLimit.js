const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const jsonError = (message) => (req, res) => res.status(429).json({ error: message });

// Login: 5 attempts / 15 min / IP — keyed by IP+email so attackers can't lock a user out.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${(req.body?.email || '').toLowerCase()}`,
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

// OTP verify: 6 / 10 min / user — bounds brute-force of the 6-digit code.
const otpVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${req.body?.user_id || 'anon'}`,
  handler: jsonError('Too many verification attempts. Request a new code.'),
});

// OTP resend: 3 / 10 min / user — discourages SMS bombing.
const otpResendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${req.body?.user_id || 'anon'}`,
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

module.exports = {
  loginLimiter,
  registerLimiter,
  otpVerifyLimiter,
  otpResendLimiter,
  refreshLimiter,
  forgotPasswordLimiter,
};
