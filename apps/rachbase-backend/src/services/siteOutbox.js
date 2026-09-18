'use strict';

/**
 * BFF transactional outbox for the SpaceArk site API (contract §5.1).
 *
 * enqueue() writes the operation + outbox row inside the caller's transaction, so
 * product desired-state and the outbox commit atomically. Workers claim due rows
 * with FOR UPDATE SKIP LOCKED under a bounded lease, deliver, and only mark
 * delivered once the site acknowledges the same request hash. The HTTP request
 * returns 202 from central state; it does not wait for site reconciliation.
 */

const { pool } = require('@rach/core');

// Exponential backoff (1s → 60s) with 0.5–1.5× jitter. Pure — unit-tested.
function backoffMs(attempts) {
  const base = Math.min(60000, 1000 * 2 ** Math.min(attempts, 6));
  return Math.floor(base * (0.5 + Math.random()));
}

// After this many attempts a still-failing delivery is dead-lettered (stops the retry loop).
const MAX_ATTEMPTS = Number(process.env.SITE_OUTBOX_MAX_ATTEMPTS) || 8;

// Is an HTTP status worth retrying? Network errors (no status) and transient server states
// are; a 4xx (bad request / validation / not-found), e.g. ARKA rejecting an undeclared CRD
// field, is PERMANENT — retrying can never succeed, so fail fast. 408/429 are the retryable 4xx.
function isRetryableStatus(status) {
  if (status == null) return true;                 // network / no response
  if (status === 408 || status === 429) return true;
  return status >= 500;                            // 5xx transient-class; other 4xx = permanent
}

/**
 * Enqueue an operation + its outbox delivery in ONE transaction.
 * @param client a pg client already inside a BEGIN (so it commits with product state)
 */
async function enqueue(client, { operationId, tenantId = null, siteId, opType, resourceType, resourceId, generation = 1, delivery }) {
  await client.query(
    `INSERT INTO site_operations (operation_id, tenant_id, site_id, op_type, resource_type, resource_id, generation, state)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'ACCEPTED')`,
    [operationId, tenantId, siteId, opType, resourceType, resourceId, generation],
  );
  await client.query(
    `INSERT INTO site_outbox (operation_id, site_id, method, route, idempotency_key, request_hash, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [operationId, siteId, delivery.method, delivery.route, delivery.idempotencyKey, delivery.requestHash, JSON.stringify(delivery.payload)],
  );
  return operationId;
}

// Claim due, undelivered rows with a lease. Safe under concurrent workers.
async function claimBatch(limit = 10, leaseMs = 30000) {
  const { rows } = await pool.query(
    `UPDATE site_outbox SET attempts = attempts + 1,
            locked_until = NOW() + ($2 || ' milliseconds')::interval
      WHERE id IN (
        SELECT id FROM site_outbox
         WHERE delivered_at IS NULL AND failed_at IS NULL AND available_at <= NOW()
           AND (locked_until IS NULL OR locked_until < NOW())
         ORDER BY available_at
         FOR UPDATE SKIP LOCKED
         LIMIT $1)
      RETURNING *`,
    [limit, String(leaseMs)],
  );
  return rows;
}

async function markDelivered(id) {
  await pool.query(
    `UPDATE site_outbox SET delivered_at = NOW(), locked_until = NULL, last_error = NULL WHERE id = $1`,
    [id],
  );
}

// Retry later with backoff, recording the real HTTP status + reason (was: a generic string,
// which hid why a delivery kept failing). Accepts a legacy string for back-compat.
async function reschedule(id, info) {
  const { status = null, reason = '' } = typeof info === 'string' ? { reason: info } : (info || {});
  const { rows } = await pool.query('SELECT attempts FROM site_outbox WHERE id = $1', [id]);
  const attempts = rows[0]?.attempts ?? 1;
  await pool.query(
    `UPDATE site_outbox SET available_at = NOW() + ($2 || ' milliseconds')::interval,
            locked_until = NULL, last_error = $3, last_status = $4 WHERE id = $1`,
    [id, String(backoffMs(attempts)), String(reason).slice(0, 500), status],
  );
}

// Dead-letter a delivery: stop retrying (failed_at set → excluded from claimBatch) and keep the
// real status + reason so an operator can see WHY without digging in the cluster logs.
async function deadLetter(id, info) {
  const { status = null, reason = '' } = typeof info === 'string' ? { reason: info } : (info || {});
  await pool.query(
    `UPDATE site_outbox SET failed_at = NOW(), locked_until = NULL,
            last_error = $2, last_status = $3 WHERE id = $1`,
    [id, String(reason).slice(0, 500), status],
  );
}

async function setOperationState(operationId, state, { reason = null, message = null, url = undefined } = {}) {
  // COALESCE keeps a previously-surfaced URL when a later status update omits it.
  await pool.query(
    `UPDATE site_operations
        SET state = $2, reason = $3, message = $4,
            url = COALESCE($5, url), updated_at = NOW()
      WHERE operation_id = $1`,
    [operationId, state, reason, message, url ?? null],
  );
}

async function getOperation(operationId) {
  const { rows } = await pool.query('SELECT * FROM site_operations WHERE operation_id = $1', [operationId]);
  return rows[0] || null;
}

// Non-terminal operations the status-poll worker should refresh from the site.
async function listInFlight(limit = 50) {
  const { rows } = await pool.query(
    `SELECT * FROM site_operations
      WHERE state IN ('ACCEPTED','RECONCILING')
      ORDER BY updated_at ASC
      LIMIT $1`,
    [limit],
  );
  return rows;
}

// Normalize a site_operations row into the contract's GET /operations DTO (§4.3).
// No raw internals leak — only product state.
function normalizeOperation(row) {
  if (!row) return null;
  return {
    operationId: row.operation_id,
    state: row.state,
    resource: { type: row.resource_type, id: row.resource_id },
    observedGeneration: row.generation,
    reason: row.reason ?? null,
    message: row.message ?? null,
    url: row.url ?? null,
    updatedAt: row.updated_at,
  };
}

module.exports = { backoffMs, MAX_ATTEMPTS, isRetryableStatus, enqueue, claimBatch, markDelivered, reschedule, deadLetter, setOperationState, getOperation, listInFlight, normalizeOperation };
