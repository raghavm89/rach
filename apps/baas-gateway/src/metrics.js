'use strict';

/**
 * Gateway request metrics producer. Counts requests per primitive + errors + latency + bytes in
 * memory, and periodically flushes an aggregated batch to the control-plane ingest endpoint
 * (METRICS_URL). Pure counter logic (inc/snapshot/toSamples) is unit-tested; the HTTP flush uses
 * an injected fetch.
 */
function makeReporter({ ref, url, token, fetchImpl = fetch } = {}) {
  const fresh = () => ({ total: 0, byPrimitive: {}, errors: 0, latencyMs: 0, bytes: 0 });
  let counts = fresh();

  function inc({ primitive = 'gateway', status = 200, ms = 0, bytes = 0 } = {}) {
    counts.total += 1;
    counts.byPrimitive[primitive] = (counts.byPrimitive[primitive] || 0) + 1;
    if (Number(status) >= 400) counts.errors += 1;
    counts.latencyMs += Number(ms) || 0;
    counts.bytes += Number(bytes) || 0;
  }
  function snapshot() { const c = counts; counts = fresh(); return c; }
  function toSamples(c) {
    const samples = [
      { metric: 'requests.total', value: c.total },
      { metric: 'response.errors', value: c.errors },
      { metric: 'response.ms', value: c.total ? c.latencyMs / c.total : 0 },
      { metric: 'net.bytes', value: c.bytes },
    ];
    for (const [p, n] of Object.entries(c.byPrimitive)) samples.push({ metric: `requests.${p}`, value: n });
    return samples;
  }
  async function flush() {
    const c = snapshot();
    if (!url || !ref || c.total === 0) return null;
    const samples = toSamples(c);
    try {
      await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(token ? { 'x-service-token': token } : {}) },
        body: JSON.stringify({ ref, samples }),
      });
    } catch { /* metrics are best-effort */ }
    return samples;
  }
  return { inc, snapshot, toSamples, flush };
}

module.exports = { makeReporter };
