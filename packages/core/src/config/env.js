// Validates required environment variables once, at startup, so the process
// fails fast instead of crashing on the first relevant request.

// When DATABASE_URL is set (Railway, etc.) individual DB vars are not needed.
const DB_VARS = process.env.DATABASE_URL
  ? []
  : ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];

const REQUIRED = [
  ...DB_VARS,
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
];

// Twilio is optional — if not configured, phone OTP is skipped gracefully
const OPTIONAL_TWILIO = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'];

// Secrets that must be real (not a .env.example placeholder / truncated stub). Scanned beyond
// REQUIRED because some of these guard internal command exec and webhooks.
const SECRET_KEYS = [
  'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET',
  'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET',
  'GOOGLE_CLIENT_SECRET', 'GITHUB_CLIENT_SECRET',
  'RACHBASE_SERVICE_TOKEN', 'RACHBASE_KEY_ENC_SECRET', 'GITHUB_APP_WEBHOOK_SECRET',
];
const PLACEHOLDER_RE = /^(your_|change[_-]?me|changeme|placeholder|example|sample|dummy|test[_-]?secret|secret$|password$)/i;

// Why a secret value is unacceptable, or null if it looks real. Pure — unit-tested.
function secretProblem(v) {
  if (v == null) return null; // absence handled by the REQUIRED check
  const s = String(v).trim();
  if (s === '') return null;
  if (PLACEHOLDER_RE.test(s)) return 'placeholder';
  if (s.length < 16) return 'too_short';
  return null;
}

function validateEnv() {
  const missing = REQUIRED.filter((k) => !process.env[k] || process.env[k].trim() === '');
  if (missing.length) {
    console.error('Missing required environment variables:');
    for (const key of missing) console.error(`  - ${key}`);
    console.error('\nSee .env.example for the full list.');
    process.exit(1);
  }

  // Reject obviously-insecure default / placeholder / truncated secrets. The old check listed only a
  // handful of exact `your_*` strings, so `change_me_shared_secret` (and the truncated `chan` a
  // duplicate .env.example line left behind) passed straight through — detect the whole family here.
  //
  // FATAL in production; a WARNING elsewhere. Local dev routinely uses short/dummy secrets (Razorpay
  // etc. aren't really called), and hard-failing `npm run dev` on them is pure friction — but the
  // same value must never reach prod, so production still refuses to boot.
  const strictSecrets = process.env.NODE_ENV === 'production';
  for (const key of SECRET_KEYS) {
    const problem = secretProblem(process.env[key]);
    if (!problem) continue;
    const reason = problem === 'placeholder'
      ? 'is set to a placeholder/default value'
      : 'is too short (<16 chars) to be a real secret';
    if (strictSecrets) {
      console.error(`Refusing to start: ${key} ${reason}. Set a real secret.`);
      process.exit(1);
    }
    console.warn(`[warn] ${key} ${reason}. This is REFUSED in production — set a real secret before deploying.`);
  }

  const twilioConfigured = OPTIONAL_TWILIO.every((k) => process.env[k] && process.env[k].trim());
  if (!twilioConfigured) {
    console.warn('[warn] Twilio not configured — phone OTP will be skipped. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER to enable.');
  }
}

module.exports = validateEnv;
module.exports.secretProblem = secretProblem;
module.exports.SECRET_KEYS = SECRET_KEYS;
