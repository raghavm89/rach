const twilio = require('twilio');

function isConfigured() {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
}

async function sendOtp(toPhone, code) {
  if (!isConfigured()) {
    console.warn(`[warn] Twilio not configured — skipping SMS OTP for ${toPhone}. Code: ${code}`);
    return;
  }

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  await client.messages.create({
    body: `Your verification code is: ${code}. It expires in 10 minutes.`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: toPhone,
  });
}

module.exports = { sendOtp };
