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

function validateEnv() {
  const missing = REQUIRED.filter((k) => !process.env[k] || process.env[k].trim() === '');
  if (missing.length) {
    console.error('Missing required environment variables:');
    for (const key of missing) console.error(`  - ${key}`);
    console.error('\nSee .env.example for the full list.');
    process.exit(1);
  }

  // Reject the obviously-insecure default secrets from .env.example
  const placeholders = ['your_access_token_secret', 'your_refresh_token_secret', 'your_razorpay_key_secret', 'your_razorpay_webhook_secret', 'your_twilio_auth_token', 'your_password'];
  for (const key of REQUIRED) {
    if (placeholders.includes(process.env[key])) {
      console.error(`Refusing to start: ${key} still set to a placeholder value.`);
      process.exit(1);
    }
  }

  const twilioConfigured = OPTIONAL_TWILIO.every((k) => process.env[k] && process.env[k].trim());
  if (!twilioConfigured) {
    console.warn('[warn] Twilio not configured — phone OTP will be skipped. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER to enable.');
  }
}

module.exports = validateEnv;
