'use strict';

/**
 * Idempotency store (contract §4.2). Keyed by Idempotency-Key → { hash, response }.
 * Reusing a key with the SAME canonical request hash is a replay (return the stored
 * 202); a DIFFERENT hash is a 409 IDEMPOTENCY_CONFLICT.
 *
 * Two implementations, one interface (`check`/`put`, both awaitable):
 *   - createIdempotencyStore()          — in-memory (single replica / tests).
 *   - createDurableIdempotencyStore()   — TTL + an injected durable backend, so it
 *     survives restarts and is SHARED across replicas. `k8sConfigMapBackend` persists
 *     it as a namespaced ConfigMap (etcd), the natural durable store in-cluster.
 */

// ── In-memory (unchanged; synchronous, back-compatible) ─────────────────────────
function createIdempotencyStore() {
  const m = new Map();
  return {
    check(key, hash) {
      const e = m.get(key);
      if (!e) return { status: 'new' };
      return e.hash === hash ? { status: 'replay', response: e.response } : { status: 'conflict' };
    },
    put(key, hash, response) { m.set(key, { hash, response }); },
    size() { return m.size; },
  };
}

// ── Durable (TTL + injected backend) ────────────────────────────────────────────
const DAY_MS = 24 * 60 * 60 * 1000;

// A backend is { get(key)->entry|null, set(key,entry), del(key), entries()->[[k,e]] };
// entries()/del() are used for lazy TTL pruning and are optional.
function memoryBackend() {
  const m = new Map();
  return {
    async get(k) { return m.get(k) || null; },
    async set(k, e) { m.set(k, e); },
    async del(k) { m.delete(k); },
    async entries() { return [...m.entries()]; },
  };
}

function createDurableIdempotencyStore({ backend = memoryBackend(), ttlMs = DAY_MS, now = () => Date.now() } = {}) {
  const fresh = (e) => e && (!e.expiresAt || e.expiresAt > now());
  return {
    async check(key, hash) {
      const e = await backend.get(key);
      if (!fresh(e)) { if (e && backend.del) await backend.del(key); return { status: 'new' }; }
      return e.hash === hash ? { status: 'replay', response: e.response } : { status: 'conflict' };
    },
    async put(key, hash, response) {
      await backend.set(key, { hash, response, expiresAt: now() + ttlMs });
      // Opportunistic prune so the backing store can't grow without bound.
      if (backend.entries && backend.del) {
        for (const [k, e] of await backend.entries()) if (e && e.expiresAt && e.expiresAt <= now()) await backend.del(k);
      }
    },
  };
}

/**
 * Durable backend on a single namespaced ConfigMap (data: key → JSON entry). Writes
 * use the read resourceVersion so concurrent replicas don't clobber each other; a
 * 409 conflict retries a few times. Requires the api facade's ServiceAccount to have
 * get/create/update on that one ConfigMap (nothing else).
 */
function k8sConfigMapBackend(coreV1Api, { namespace, name, retries = 5 } = {}) {
  const unwrap = (r) => (r && r.body !== undefined ? r.body : r);
  const enc = (e) => JSON.stringify(e);
  const dec = (s) => { try { return JSON.parse(s); } catch { return null; } };

  async function readCM() {
    try { return unwrap(await coreV1Api.readNamespacedConfigMap(name, namespace)); }
    catch (e) { if ((e.statusCode ?? e.response?.statusCode) === 404) return null; throw e; }
  }

  async function get(key) {
    const cm = await readCM();
    const raw = cm && cm.data ? cm.data[key] : undefined;
    return raw ? dec(raw) : null;
  }

  async function mutate(fn) {
    for (let i = 0; i < retries; i++) {
      const cm = await readCM();
      const data = { ...(cm?.data || {}) };
      fn(data);
      try {
        if (!cm) await coreV1Api.createNamespacedConfigMap(namespace, { metadata: { name, namespace }, data });
        else await coreV1Api.replaceNamespacedConfigMap(name, namespace, { metadata: { name, namespace, resourceVersion: cm.metadata.resourceVersion }, data });
        return;
      } catch (e) {
        if ((e.statusCode ?? e.response?.statusCode) === 409) continue; // lost the race → re-read + retry
        throw e;
      }
    }
    throw new Error('idempotency ConfigMap write: too many conflicts');
  }

  return {
    get,
    async set(key, entry) { await mutate((data) => { data[key] = enc(entry); }); },
    async del(key) { await mutate((data) => { delete data[key]; }); },
    async entries() { const cm = await readCM(); return Object.entries(cm?.data || {}).map(([k, v]) => [k, dec(v)]); },
  };
}

module.exports = { createIdempotencyStore, createDurableIdempotencyStore, memoryBackend, k8sConfigMapBackend };
