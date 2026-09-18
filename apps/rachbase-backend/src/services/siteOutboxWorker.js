'use strict';

/**
 * Outbox delivery worker. Claims due rows, delivers to the site API, and on ack
 * marks delivered + moves the operation to RECONCILING (the site now converges;
 * the reconcile status arrives via GET /v1/operations or the inventory sweep).
 * On failure it reschedules with backoff. Idempotent + safe under many workers.
 */

const outbox = require('./siteOutbox');
const client = require('./siteClient');
const { reflectToService } = require('./siteStatusWorker');
const { Deployment } = require('../models/project');

// Human-readable failure reason from a non-2xx site response — carries the ACTUAL error
// (e.g. a k8s Status ".message" or the contract's reason), so the outbox row and the
// operation record show WHY a deploy failed instead of a generic "no ack".
function reasonFrom(res) {
  const b = res && res.body;
  const msg = b && (b.message || b.error || b.reason);
  return `HTTP ${res && res.status != null ? res.status : '?'}${msg ? `: ${msg}` : ''}`.slice(0, 500);
}

// Pure decision for a delivery attempt: deliver on ack, fail fast on a permanent (non-retryable)
// error OR once attempts are exhausted, otherwise retry with backoff. Unit-tested.
function classifyDelivery({ ack, status, attempts }) {
  if (ack) return 'delivered';
  if (!outbox.isRetryableStatus(status) || attempts >= outbox.MAX_ATTEMPTS) return 'fail';
  return 'retry';
}

// Terminalize a delivery that will never succeed: dead-letter it (stops the retry loop) and
// mark the operation FAILED, reflecting onto the product service so the dashboard shows the
// failure instead of a stale "online".
async function failPermanently(row, { status, reason }) {
  await outbox.deadLetter(row.id, { status, reason });
  await outbox.setOperationState(row.operation_id, 'FAILED', { reason });
  try {
    await reflectToService({ state: 'FAILED', resource: { type: row.resource_type, id: row.resource_id } });
    await Deployment.setStatusByOperation(row.operation_id, 'failed'); // this op's deploy row → failed
  } catch (e) { console.error(`[site-outbox] reflect FAILED for ${row.operation_id}:`, e.message); }
}

async function drainOnce({ limit = 10 } = {}) {
  const rows = await outbox.claimBatch(limit);
  let delivered = 0;
  for (const row of rows) {
    try {
      const res = await client.deliver(row);
      if (res && res.ack) {
        await outbox.markDelivered(row.id);
        await outbox.setOperationState(row.operation_id, 'RECONCILING');
        delivered += 1;
        continue;
      }
      // Non-2xx: fail fast on a permanent error (4xx), or after exhausting retries; else back off.
      const status = res && res.status != null ? res.status : null;
      const reason = reasonFrom(res);
      if (classifyDelivery({ ack: false, status, attempts: row.attempts }) === 'fail') {
        await failPermanently(row, { status, reason });
      } else {
        await outbox.reschedule(row.id, { status, reason });
      }
    } catch (e) {
      // Network/transport error — retryable (status null), but dead-letter once attempts are exhausted.
      if (classifyDelivery({ ack: false, status: null, attempts: row.attempts }) === 'fail') {
        await failPermanently(row, { status: null, reason: e.message });
      } else {
        await outbox.reschedule(row.id, { status: null, reason: e.message });
      }
    }
  }
  return { claimed: rows.length, delivered };
}

// Simple polling loop for a standalone worker process.
function startWorker({ intervalMs = 2000, limit = 10 } = {}) {
  let stopped = false;
  (async function loop() {
    while (!stopped) {
      try { await drainOnce({ limit }); }
      catch (e) { console.error('[site-outbox] drain failed:', e.message); }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  })();
  return () => { stopped = true; };
}

module.exports = { drainOnce, startWorker, classifyDelivery, reasonFrom };
