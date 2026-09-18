const pool = require('../config/db');

const WebhookEvent = {
  // Returns true if this is the first time we've seen this signature, false
  // if Razorpay is retrying an already-processed event.
  async claim(signature, eventType) {
    const { rowCount } = await pool.query(
      `INSERT INTO webhook_events (signature, event_type)
       VALUES ($1, $2)
       ON CONFLICT (signature) DO NOTHING`,
      [signature, eventType || null]
    );
    return rowCount === 1;
  },

  // Give a claim back after the handler FAILED, so the provider's retry is not
  // treated as a duplicate. Claim-then-process previously meant a crash mid-handler
  // lost the event forever — Razorpay's retry saw `duplicate: true` and a charged/
  // cancelled event silently never took effect (go-live audit M4/N "webhook
  // dedupe-before-process"). Best-effort: if this release itself fails, the event
  // is stuck exactly as before — no worse — and the 500 below still surfaces it.
  async release(signature) {
    try {
      await pool.query(`DELETE FROM webhook_events WHERE signature = $1`, [signature]);
      return true;
    } catch (e) {
      console.error('[webhookEvent] release failed:', e.message);
      return false;
    }
  },
};

module.exports = WebhookEvent;
