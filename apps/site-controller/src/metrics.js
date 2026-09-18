'use strict';

/**
 * Bounded-cardinality OpenMetrics for the site-controller (contract §10). NEVER label with
 * customer email, tenant/app/operation ids — those go in structured logs. The full §10 set:
 *
 *   spaceark_site_api_requests_total{route,method,code}
 *   spaceark_site_operations_total{type,state}
 *   spaceark_site_reconcile_total{controller,result,reason}
 *   spaceark_site_reconcile_duration_seconds{controller}   (summary: _sum + _count)
 *   spaceark_site_queue_depth{controller}
 *   spaceark_site_oldest_pending_seconds{controller}
 *   spaceark_site_drift_total{controller,kind}
 *   spaceark_site_builds{state}
 *
 * Call sites go through the `metrics` recorders below, whose fixed label sets keep
 * cardinality bounded and PII out by construction.
 */

function createRegistry() {
  const counters = new Map();
  const gauges = new Map();
  const meta = new Map(); // metric name → { type, help }
  const keyOf = (name, labels) => `${name}|${Object.keys(labels).sort().map((k) => `${k}=${labels[k]}`).join(',')}`;

  const parse = (k) => {
    const [name, lbl] = k.split('|');
    const labels = lbl
      ? `{${lbl.split(',').filter(Boolean).map((p) => { const i = p.indexOf('='); return `${p.slice(0, i)}="${p.slice(i + 1)}"`; }).join(',')}}`
      : '';
    return `${name}${labels}`;
  };

  return {
    describe(name, type, help) { meta.set(name, { type, help }); return this; },
    inc(name, labels = {}, by = 1) { const k = keyOf(name, labels); counters.set(k, (counters.get(k) || 0) + by); },
    set(name, value, labels = {}) { gauges.set(keyOf(name, labels), value); },
    // Summary-style observation: base_sum accumulates, base_count increments.
    observe(name, value, labels = {}) { this.inc(`${name}_sum`, labels, Number(value) || 0); this.inc(`${name}_count`, labels); },
    render() {
      const lines = [];
      for (const [name, m] of meta) { lines.push(`# HELP ${name} ${m.help}`); lines.push(`# TYPE ${name} ${m.type}`); }
      for (const [k, v] of counters) lines.push(`${parse(k)} ${v}`);
      for (const [k, v] of gauges) lines.push(`${parse(k)} ${v}`);
      return lines.join('\n') + '\n';
    },
    _counters: counters,
    _gauges: gauges,
  };
}

// Templatize a request path so labels stay bounded (no ids in metric labels).
function routeTemplate(path) {
  return path
    .replace(/t-[a-z0-9]{8,32}/g, ':tenant')
    .replace(/a-[a-z0-9]{8,15}/g, ':app')
    .replace(/\/operations\/[^/]+/, '/operations/:op');
}

const registry = createRegistry();
registry
  .describe('spaceark_site_api_requests_total', 'counter', 'Site API requests by templated route, method and code.')
  .describe('spaceark_site_operations_total', 'counter', 'Accepted operations by type and state.')
  .describe('spaceark_site_reconcile_total', 'counter', 'Reconcile outcomes by controller, result and reason.')
  .describe('spaceark_site_reconcile_duration_seconds', 'summary', 'Reconcile duration per controller.')
  .describe('spaceark_site_queue_depth', 'gauge', 'Pending reconcile work per controller.')
  .describe('spaceark_site_oldest_pending_seconds', 'gauge', 'Age of the oldest pending item per controller.')
  .describe('spaceark_site_drift_total', 'counter', 'Drift repairs by controller and kind.')
  .describe('spaceark_site_builds', 'gauge', 'Builds by state.');

// The ONLY way call sites touch metrics — fixed labels keep cardinality bounded + PII-free.
const metrics = {
  apiRequest: (route, method, code) => registry.inc('spaceark_site_api_requests_total', { route, method, code }),
  operation: (type, state) => registry.inc('spaceark_site_operations_total', { type, state }),
  reconcile: (controller, result, reason = 'ok') => registry.inc('spaceark_site_reconcile_total', { controller, result, reason: reason || 'ok' }),
  reconcileDuration: (controller, seconds) => registry.observe('spaceark_site_reconcile_duration_seconds', seconds, { controller }),
  queueDepth: (controller, n) => registry.set('spaceark_site_queue_depth', n, { controller }),
  oldestPending: (controller, seconds) => registry.set('spaceark_site_oldest_pending_seconds', seconds, { controller }),
  drift: (controller, kind) => registry.inc('spaceark_site_drift_total', { controller, kind }),
  builds: (state, n) => registry.set('spaceark_site_builds', n, { state }),
};

module.exports = { createRegistry, registry, routeTemplate, metrics };
