'use strict';

/**
 * Operator alerting — email the OPERATORS when the platform itself is in trouble.
 *
 * Everything else in the alerting stack (services/alerting.js, container alerts) emails
 * CUSTOMERS about their own usage; until now nothing told RachBase's operators about
 * backup failures, dead-lettered ops, or prober incidents — outages and silent failure
 * streaks were visible only in process logs (go-live audit F10 / re-audit N3).
 *
 * Config:
 *   OPS_ALERT_EMAIL         comma-separated recipient list. Unset ⇒ alerts are LOGGED
 *                           LOUDLY but not sent (never crashes the caller).
 *   OPS_ALERT_COOLDOWN_MIN  per-key cooldown, default 360 (6h) — a failing hourly worker
 *                           sends one email per window, not one per tick.
 *
 * `sendOpsAlert({ key, subject, text })` — `key` buckets the cooldown (e.g. 'backup-failures').
 * Best-effort by design: an alerting failure must never take down the thing it alerts about.
 */

const { brevo } = require('@rach/core');

const lastSentByKey = new Map(); // key → epoch ms

function recipients() {
  return String(process.env.OPS_ALERT_EMAIL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function cooldownMs() {
  return (Number(process.env.OPS_ALERT_COOLDOWN_MIN) || 360) * 60 * 1000;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * @param {object} opts
 * @param {string} opts.key      cooldown bucket (one email per key per cooldown window)
 * @param {string} opts.subject  email subject ("[RachBase ops] " is prefixed automatically)
 * @param {string} opts.text     plain-text body (rendered into a <pre> for the email)
 * @param {number} [opts.now]    epoch ms (tests)
 * @returns {Promise<{sent:boolean, reason?:string}>}
 */
async function sendOpsAlert({ key, subject, text, now = Date.now() }) {
  try {
    const last = lastSentByKey.get(key) || 0;
    if (now - last < cooldownMs()) return { sent: false, reason: 'cooldown' };

    const to = recipients();
    if (!to.length) {
      // No operator inbox configured — make the failure impossible to miss in logs.
      console.error(`[ops-alert] OPS_ALERT_EMAIL not set — UNDELIVERED operator alert: ${subject}\n${text}`);
      return { sent: false, reason: 'no_recipients' };
    }

    const sent = await brevo.sendAlertEmail({
      recipients: to,
      subject: `[RachBase ops] ${subject}`,
      htmlContent: `<p><strong>${esc(subject)}</strong></p><pre style="font: 12px/1.5 monospace; white-space: pre-wrap;">${esc(text)}</pre>`,
    });
    if (sent) lastSentByKey.set(key, now);
    return { sent: Boolean(sent) };
  } catch (e) {
    console.error(`[ops-alert] failed to send "${subject}":`, e.message);
    return { sent: false, reason: e.message };
  }
}

// Test helper: clear cooldown state.
function _reset() { lastSentByKey.clear(); }

module.exports = { sendOpsAlert, _reset };
