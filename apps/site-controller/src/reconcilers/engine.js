'use strict';

/**
 * Shared reconcile engine: converge (apply) → verify → normalized state. Pure —
 * `apply`/`verify` injected, so every reconciler's state machine is unit-testable.
 * ACTIVE when verify.present; permanent apply error → FAILED; else RECONCILING.
 */

const status = (state, reason = null, message = null) => ({ state, reason, message });

// k8s admission/validation/authz errors are permanent; everything else transient.
function isPermanentK8sError(e) {
  const s = e?.statusCode ?? e?.response?.statusCode ?? e?.body?.code;
  return s === 400 || s === 403 || s === 422;
}

// Extract a diagnosable detail from a k8s-client error (the wrappers hide it behind
// a terse "HTTP request failed"). Surfaced in the reconcile status message + logs.
function errDetail(e) {
  const s = e?.statusCode ?? e?.response?.statusCode ?? e?.body?.code;
  const body = e?.body ?? e?.response?.body;
  return [e?.message, s && `status=${s}`, body && (typeof body === 'string' ? body.slice(0, 220) : JSON.stringify(body).slice(0, 220))].filter(Boolean).join(' | ');
}

async function reconcileClaim(claim, { apply, verify }) {
  try {
    await apply(claim);
  } catch (e) {
    if (e && e.permanent) return status('FAILED', 'ADMISSION_REJECTED', errDetail(e));
    return status('RECONCILING', 'APPLY_RETRY', errDetail(e));
  }
  const v = await verify(claim);
  // `present` → ACTIVE, but verify may still attach a reason/message (e.g. the service is serving
  // the PREVIOUS version because a redeploy failed readiness). Not present → RECONCILING.
  if (v && v.present) return status('ACTIVE', v.reason || null, v.message || null);
  return status('RECONCILING', (v && v.reason) || 'VERIFY_PENDING', (v && v.message) || null);
}

// Generic poll loop: list items → reconcile each → persist status. `list`,
// `reconcile`, `onStatus` injected (a real informer/watch replaces the poll later).
function startLoop({ list, reconcile, onStatus = () => {}, intervalMs = 5000 } = {}) {
  let stopped = false;
  (async function loop() {
    while (!stopped) {
      try { for (const item of (await list()) || []) await onStatus(item, await reconcile(item)); }
      catch (e) { console.error('[reconciler] loop error:', e.message); }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  })();
  return () => { stopped = true; };
}

module.exports = { status, isPermanentK8sError, errDetail, reconcileClaim, startLoop };
