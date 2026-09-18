'use strict';

/**
 * Watch-based reconcile driver — replaces the poll loop with a real Kubernetes watch,
 * plus a periodic **resync** that re-lists everything so a dropped watch or a missed
 * event can't leave state un-reconciled. The watch gives low-latency reactions; the
 * resync is the safety net (informer semantics without depending on the k8s client
 * in tests). `connect`/`listAll` are injected so the driver is unit-testable.
 *
 * `connect(onEvent) → stop` streams `{ type: 'ADDED'|'MODIFIED'|'DELETED', object }`
 * and returns a stop handle; when the stream ends we reconnect with capped backoff.
 */

const { metrics } = require('../metrics');

const RECONCILE_TYPES = new Set(['ADDED', 'MODIFIED']);

function startInformer({
  connect,
  listAll,
  reconcileItem,
  onDelete = () => {},
  controller = null,
  resyncMs = 60_000,
  backoffMs = 1_000,
  maxBackoffMs = 30_000,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  let stopped = false;
  let stopWatch = null;
  let resyncHandle = null;
  let attempt = 0;

  async function reconcileAll() {
    if (stopped) return;
    const items = (await listAll()) || [];
    if (controller) metrics.queueDepth(controller, items.length); // §10 backlog gauge
    for (const object of items) {
      if (stopped) return;
      try { await reconcileItem(object); } catch (e) { console.error('[informer] resync reconcile error:', e.message); }
    }
  }

  async function onEvent(evt) {
    if (stopped || !evt || !evt.object) return;
    try {
      if (RECONCILE_TYPES.has(evt.type)) await reconcileItem(evt.object);
      else if (evt.type === 'DELETED') await onDelete(evt.object);
    } catch (e) { console.error(`[informer] ${evt.type} handler error:`, e.message); }
  }

  function scheduleReconnect() {
    if (stopped) return;
    const delay = Math.min(backoffMs * 2 ** attempt, maxBackoffMs);
    attempt += 1;
    setTimer(connectOnce, delay);
  }

  async function connectOnce() {
    if (stopped) return;
    try {
      await reconcileAll();               // catch up before/alongside the live stream
      stopWatch = await connect(onEvent, () => { if (!stopped) scheduleReconnect(); });
      attempt = 0;                        // connected cleanly → reset backoff
    } catch (e) {
      console.error('[informer] connect failed:', e.message);
      scheduleReconnect();
    }
  }

  function loopResync() {
    if (stopped) return;
    resyncHandle = setTimer(async () => { await reconcileAll(); loopResync(); }, resyncMs);
  }

  connectOnce();
  loopResync();

  return () => {
    stopped = true;
    if (typeof stopWatch === 'function') { try { stopWatch(); } catch { /* ignore */ } }
    if (resyncHandle) clearTimer(resyncHandle);
  };
}

/**
 * Real adapter: a k8s watch on a namespaced custom resource. Returns
 * `connect(onEvent, onEnd)` compatible with startInformer. Uses the pinned
 * @kubernetes/client-node Watch (CommonJS 0.22.x).
 */
function k8sConnect(kc, { group, version, namespace, plural }) {
  const k8s = require('@kubernetes/client-node');
  const watch = new k8s.Watch(kc);
  const path = `/apis/${group}/${version}/namespaces/${namespace}/${plural}`;
  return (onEvent, onEnd) => watch.watch(
    path, {},
    (type, apiObj) => onEvent({ type, object: apiObj }),
    (err) => { if (err) console.error('[informer] watch closed:', err.message); onEnd && onEnd(); },
  ); // resolves to a request handle with .abort()
}

module.exports = { startInformer, k8sConnect, RECONCILE_TYPES };
