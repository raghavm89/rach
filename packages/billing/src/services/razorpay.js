const Razorpay = require('razorpay');

let client;

function getClient() {
  if (!client) {
    const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set');
    }
    client = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
  }
  return client;
}

// Proxy so existing call sites (`razorpay.subscriptions.create(...)`) keep working
// without each lookup re-instantiating the SDK.
module.exports = new Proxy({}, {
  get: (_target, prop) => getClient()[prop],
});
