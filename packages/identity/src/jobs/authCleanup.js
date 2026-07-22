'use strict';

/**
 * Periodic cleanup for the auth tables.
 *
 * Migration 016 noted that stale pending_registrations rows "can be purged by a
 * periodic job or cron" — no such job existed, so bcrypt hashes for every
 * abandoned signup accumulated indefinitely. Same story for expired OAuth state
 * and long-dead refresh tokens.
 *
 * Usage (from the app entrypoint):
 *   const { startAuthCleanup } = require('@rach/identity');
 *   startAuthCleanup();
 *
 * Or as a one-shot from cron:
 *   node -e "require('@rach/identity').runAuthCleanup().then(()=>process.exit(0))"
 */

const pool = require('@rach/core').pool;

// Pending registrations live only as long as the OTP can plausibly be used:
// 10 min expiry + up to 5 resends. 24h is a generous ceiling.
const PENDING_MAX_AGE_HOURS = 24;

// Revoked/expired refresh tokens are kept briefly for reuse-detection forensics,
// then dropped.
const REFRESH_GRACE_DAYS = 30;

const INTERVAL_MS = 60 * 60 * 1000; // hourly

async function runAuthCleanup() {
  const results = {};

  try {
    const { rowCount } = await pool.query(
      `DELETE FROM pending_registrations
        WHERE created_at < NOW() - INTERVAL '${PENDING_MAX_AGE_HOURS} hours'`
    );
    results.pending_registrations = rowCount;
  } catch (e) {
    console.error('[authCleanup] pending_registrations:', e.message);
  }

  try {
    const { rowCount } = await pool.query('DELETE FROM oauth_states WHERE expires_at < NOW()');
    results.oauth_states = rowCount;
  } catch (e) {
    console.error('[authCleanup] oauth_states:', e.message);
  }

  try {
    const { rowCount } = await pool.query(
      `DELETE FROM refresh_tokens
        WHERE expires_at < NOW() - INTERVAL '${REFRESH_GRACE_DAYS} days'`
    );
    results.refresh_tokens = rowCount;
  } catch (e) {
    console.error('[authCleanup] refresh_tokens:', e.message);
  }

  // Clear reset tokens that can no longer be redeemed.
  try {
    const { rowCount } = await pool.query(
      `UPDATE users
          SET password_reset_token = NULL, password_reset_expires_at = NULL
        WHERE password_reset_expires_at IS NOT NULL
          AND password_reset_expires_at < NOW()`
    );
    results.expired_reset_tokens = rowCount;
  } catch (e) {
    console.error('[authCleanup] reset tokens:', e.message);
  }

  // Abandoned subscription checkouts. Required lazily so @rach/identity does
  // not take a hard dependency on @rach/billing — this is a no-op if billing
  // is not installed alongside (e.g. in RachDev).
  try {
    const { cancelAbandonedSubscriptions } = require('@rach/billing').purchase;
    const { cancelled } = await cancelAbandonedSubscriptions({ olderThanMinutes: 60 });
    if (cancelled) results.abandoned_subscriptions = cancelled;
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') console.error('[authCleanup] abandoned subscriptions:', e.message);
  }

  const summary = Object.entries(results)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k}=${n}`)
    .join(' ');
  if (summary) console.log(`[authCleanup] purged ${summary}`);

  return results;
}

let timer = null;

function startAuthCleanup({ intervalMs = INTERVAL_MS, runImmediately = true } = {}) {
  if (timer) return timer;
  if (runImmediately) runAuthCleanup().catch(() => {});
  timer = setInterval(() => runAuthCleanup().catch(() => {}), intervalMs);
  if (typeof timer.unref === 'function') timer.unref(); // don't hold the process open
  return timer;
}

function stopAuthCleanup() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { runAuthCleanup, startAuthCleanup, stopAuthCleanup };
