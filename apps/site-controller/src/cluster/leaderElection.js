'use strict';

/**
 * Leader election over a coordination.k8s.io Lease, so only one replica of a reconciler
 * profile drives convergence (the api facade is stateless and does NOT elect). The pure
 * decision (`evaluate`) is unit-testable; the k8s Lease read/write is a thin adapter.
 *
 * Contract: a candidate acquires an empty/expired Lease, renews its own, and otherwise
 * stands by. Renewal cadence is well under the lease duration so a live leader keeps it.
 */

// Decide what to do with the current Lease (or null if none exists yet).
// Returns { action: 'acquire' | 'renew' | 'standby', reason }.
function evaluate(lease, { now = Date.now(), identity, leaseDurationMs } = {}) {
  if (!lease) return { action: 'acquire', reason: 'no-lease' };
  const holder = lease.holderIdentity;
  const renewTime = new Date(lease.renewTime || 0).getTime();
  const expiresAt = renewTime + (lease.leaseDurationSeconds ? lease.leaseDurationSeconds * 1000 : leaseDurationMs);
  if (holder === identity) return { action: 'renew', reason: 'self' };
  if (now >= expiresAt) return { action: 'acquire', reason: 'expired' };
  return { action: 'standby', reason: 'held-by-other' };
}

// Kubernetes Lease acquireTime/renewTime are `MicroTime` — RFC3339 with EXACTLY 6 fractional
// digits (microseconds). JS toISOString() emits 3 (millis) → the apiserver rejects it as a
// 400 BadRequest ("cannot parse .685Z as .000000"). Pad the 3 ms digits to 6.
function microTime(ms) {
  return new Date(ms).toISOString().replace(/\.(\d{3})Z$/, '.$1000Z');
}

// Build the Lease spec fields for an acquire/renew by `identity`.
function leaseSpec(prev, { now = Date.now(), identity, leaseDurationMs }) {
  const acquireTime = prev && prev.holderIdentity === identity && prev.acquireTime ? prev.acquireTime : microTime(now);
  return {
    holderIdentity: identity,
    leaseDurationSeconds: Math.round(leaseDurationMs / 1000),
    acquireTime,
    renewTime: microTime(now),
    leaseTransitions: (prev && prev.holderIdentity !== identity ? (prev.leaseTransitions || 0) + 1 : (prev?.leaseTransitions || 0)),
  };
}

/**
 * Run the election loop. `read()` → current lease spec (or null); `write(spec, exists)`
 * persists it. Calls `onElected()` on becoming leader and `onDeposed()` on losing it.
 * All I/O injected → the loop is testable without a cluster.
 */
function runLeaderElection({
  read, write, identity,
  leaseDurationMs = 15_000,
  renewMs = 5_000,
  onElected = () => {},
  onDeposed = () => {},
  now = () => Date.now(),
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
} = {}) {
  let stopped = false;
  let leading = false;

  (async function loop() {
    while (!stopped) {
      try {
        const lease = await read();
        const { action } = evaluate(lease, { now: now(), identity, leaseDurationMs });
        if (action === 'acquire' || action === 'renew') {
          await write(leaseSpec(lease, { now: now(), identity, leaseDurationMs }), Boolean(lease));
          if (!leading) { leading = true; await onElected(); }
        } else if (leading) {
          leading = false; await onDeposed();
        }
      } catch (e) {
        const status = e && (e.statusCode ?? e.response?.statusCode ?? e.body?.code);
        const body = e && (e.body ?? e.response?.body);
        const detail = [e && e.message, status && `status=${status}`, body && `body=${typeof body === 'string' ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300)}`, e && e.code && `code=${e.code}`].filter(Boolean).join(' | ');
        console.error('[leader] election tick failed:', detail);
        if (leading) { leading = false; try { await onDeposed(); } catch { /* ignore */ } }
      }
      await sleep(renewMs);
    }
  })();

  return { stop: () => { stopped = true; }, isLeader: () => leading };
}

/**
 * Real adapter: read/write a namespaced Lease via CoordinationV1Api. Returns
 * `{ read, write }` for runLeaderElection. Lease name/namespace scope the election
 * (one per reconciler profile).
 */
function k8sLeaseIO(kc, { namespace, name }) {
  const k8s = require('@kubernetes/client-node');
  const api = kc.makeApiClient(k8s.CoordinationV1Api);
  const unwrap = (r) => (r && r.body !== undefined ? r.body : r);

  async function read() {
    try {
      const lease = unwrap(await api.readNamespacedLease(name, namespace));
      return lease.spec || null;
    } catch (e) {
      if ((e.statusCode ?? e.response?.statusCode) === 404) return null;
      throw e;
    }
  }
  async function write(spec, exists) {
    if (exists) {
      // Updating a Lease requires the current metadata.resourceVersion (optimistic
      // concurrency) — replacing with resourceVersion:0/absent is a 422. Read-modify-replace
      // so the live resourceVersion is preserved; a concurrent update makes replace 409 and
      // the loop simply retries on the next tick.
      const cur = unwrap(await api.readNamespacedLease(name, namespace));
      cur.spec = spec;
      await api.replaceNamespacedLease(name, namespace, cur);
    } else {
      await api.createNamespacedLease(namespace, { metadata: { name, namespace }, spec });
    }
  }
  return { read, write };
}

module.exports = { evaluate, leaseSpec, microTime, runLeaderElection, k8sLeaseIO };
