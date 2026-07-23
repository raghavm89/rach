'use strict';

/**
 * Prometheus HTTP API client — routed through the Grafana datasource proxy.
 *
 * SpaceArk exposes Prometheus behind Grafana. All queries must go through:
 *   {GRAFANA_BASE_URL}/api/datasources/proxy/uid/{PROM_DS_UID}/api/v1/<endpoint>
 *
 * Required environment variables:
 *   GRAFANA_BASE_URL  — e.g. https://monitor.lab.spaceark.arkamicrostacks.com/grafana
 *   GRAFANA_TOKEN     — Grafana Service Account token (glsa_...)
 *   PROM_DS_UID       — Grafana datasource UID (default: "prometheus")
 *
 * Uses Node's built-in https/http modules — no extra dependencies.
 */

const https   = require('https');
const http    = require('http');
const { URL } = require('url');

// Upstream call guards. A hung Grafana must not hold a Node request open
// indefinitely, and a pathological response must not exhaust memory.
const REQUEST_TIMEOUT_MS = Number(process.env.PROM_TIMEOUT_MS) || 15000;
const MAX_RESPONSE_BYTES = Number(process.env.PROM_MAX_RESPONSE_BYTES) || 8 * 1024 * 1024; // 8 MB

// ---------------------------------------------------------------------------
// Internal HTTP helper
// ---------------------------------------------------------------------------

function httpGet(urlStr, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const lib    = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port    : parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path    : parsed.pathname + parsed.search,
      headers,
      timeout : REQUEST_TIMEOUT_MS,
    };
    const req = lib.get(options, (res) => {
      let raw  = '';
      let size = 0;
      let aborted = false;
      res.on('data', (chunk) => {
        if (aborted) return;
        size += chunk.length;
        if (size > MAX_RESPONSE_BYTES) {
          aborted = true;
          req.destroy();
          const err = new Error('Monitoring backend returned an oversized response');
          err.status = 502;
          reject(err);
          return;
        }
        raw += chunk;
      });
      res.on('end', () => {
        if (aborted) return;
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch {
          // Log the raw payload server-side; never echo it to the client (L3).
          console.error('[prometheus] Non-JSON response (HTTP %s): %s', res.statusCode, raw.slice(0, 500));
          const err = new Error('Monitoring backend returned an unexpected response');
          err.status = 502;
          reject(err);
        }
      });
    });
    req.on('timeout', () => {
      req.destroy();
      const err = new Error('Monitoring backend timed out');
      err.status = 504;
      reject(err);
    });
    req.on('error', (e) => {
      console.error('[prometheus] Request error:', e.message);
      const err = new Error('Monitoring backend is unreachable');
      err.status = 502;
      reject(err);
    });
  });
}

// ---------------------------------------------------------------------------
// Config / guard
// ---------------------------------------------------------------------------

function getConfig() {
  const grafanaBase = process.env.GRAFANA_BASE_URL;
  const token       = process.env.GRAFANA_TOKEN;
  const dsUid       = process.env.PROM_DS_UID || 'prometheus';

  if (!grafanaBase || !token) {
    const err = new Error(
      'Prometheus not configured: set GRAFANA_BASE_URL and GRAFANA_TOKEN in your .env'
    );
    err.status = 503;
    throw err;
  }

  const promBase = grafanaBase.replace(/\/$/, '') + '/api/datasources/proxy/uid/' + dsUid;
  return { promBase, token, grafanaBase };
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

function classifyError(status, body) {
  if (status === 401) {
    const err = new Error('Grafana authentication failed — check GRAFANA_TOKEN');
    err.status = 502;
    return err;
  }
  if (status === 403) {
    const err = new Error('Grafana token lacks Viewer access to the Prometheus datasource — contact SpaceArk');
    err.status = 502;
    return err;
  }
  if (status === 404) {
    const err = new Error('Datasource not found — check PROM_DS_UID matches the Grafana datasource UID');
    err.status = 502;
    return err;
  }
  if (status === 503) {
    const err = new Error('Prometheus unavailable — query timed out or server is overloaded');
    err.status = 503;
    return err;
  }
  // Log the upstream detail server-side; return a generic message so internal
  // query text / infra detail is not echoed to API clients (L3).
  console.error('[prometheus] Upstream error HTTP %s: %s', status, (body && (body.error || body.message)) || '(no body)');
  const err = new Error('Monitoring backend error');
  err.status = 502;
  return err;
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Safely parse a Prometheus value string.
 * Prometheus encodes NaN / +Inf / -Inf as JSON strings.
 */
function safeFloat(s, fallback) {
  if (fallback === undefined) fallback = 0;
  const n = parseFloat(s);
  return isFinite(n) ? n : fallback;
}

/**
 * Verify token validity and Prometheus reachability.
 * Calls GET /grafana/api/user then a lightweight Prometheus instant query.
 */
async function verifyConnection() {
  const grafanaBase = process.env.GRAFANA_BASE_URL;
  const token       = process.env.GRAFANA_TOKEN;

  if (!grafanaBase || !token) {
    throw new Error('GRAFANA_BASE_URL and GRAFANA_TOKEN must be set');
  }

  const userUrl = grafanaBase.replace(/\/$/, '') + '/api/user';
  const userResp = await httpGet(userUrl, { Authorization: 'Bearer ' + token });
  if (userResp.status !== 200) {
    throw classifyError(userResp.status, userResp.body);
  }

  const results = await promInstant('count(pve_guest_info{template="0"})');
  const vmCount = parseInt((results[0] && results[0].value[1]) || '0', 10);

  const login = userResp.body.login || userResp.body.name;
  return { grafanaUser: login, vmCount };
}

/**
 * Instant query — returns a vector of current metric values.
 */
async function promInstant(expr) {
  const { promBase, token } = getConfig();

  const url = new URL(promBase + '/api/v1/query');
  url.searchParams.set('query', expr);

  const { status, body } = await httpGet(url.toString(), {
    Authorization: 'Bearer ' + token,
  });

  if (status !== 200) throw classifyError(status, body);
  if (body.status !== 'success') {
    // body.error typically contains the failing PromQL — log it, don't leak it.
    console.error('[prometheus] Query non-success: %s', body.error || '(no error field)');
    const err = new Error('Monitoring query failed');
    err.status = 502;
    throw err;
  }

  return body.data.result;
}

/**
 * Range query — returns a matrix of time-series values.
 */
async function promRange(expr, startMs, endMs, stepSeconds) {
  const { promBase, token } = getConfig();

  const url = new URL(promBase + '/api/v1/query_range');
  url.searchParams.set('query', expr);
  url.searchParams.set('start', Math.floor(startMs / 1000).toString());
  url.searchParams.set('end',   Math.floor(endMs   / 1000).toString());
  url.searchParams.set('step',  String(stepSeconds));

  const { status, body } = await httpGet(url.toString(), {
    Authorization: 'Bearer ' + token,
  });

  if (status !== 200) throw classifyError(status, body);
  if (body.status !== 'success') {
    // body.error typically contains the failing PromQL — log it, don't leak it.
    console.error('[prometheus] Query non-success: %s', body.error || '(no error field)');
    const err = new Error('Monitoring query failed');
    err.status = 502;
    throw err;
  }

  return body.data.result;
}

module.exports = { promInstant, promRange, safeFloat, verifyConnection };
