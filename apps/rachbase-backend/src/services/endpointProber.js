'use strict';

/**
 * Application Workload Monitoring prober.
 *
 * On a fixed tick it finds enabled endpoints whose interval has elapsed, probes
 * each over HTTP, records the result in `endpoint_checks`, and updates the
 * endpoint's rolling status. It emails tenant + platform admins when an endpoint
 * goes down (after ALERT_AFTER consecutive failures, with a cooldown) and again
 * when it recovers.
 */

const pool = require('@rach/core').pool;
const { sendAlertEmail } = require('@rach/core').brevo;

const TICK_MS      = 30 * 1000;        // scan for due endpoints every 30s
const TIMEOUT_MS   = 10 * 1000;        // per-probe timeout
const CONCURRENCY  = 10;               // max simultaneous probes
const ALERT_AFTER  = 2;                // consecutive failures before alerting
const COOLDOWN_MS  = 60 * 60 * 1000;   // re-alert at most hourly while down
const PRUNE_EVERY  = 120;              // prune history every ~120 ticks (~1h)

let timer = null;
let running = false;
let ticks = 0;

async function getAdminEmails() {
  const { rows } = await pool.query("SELECT email FROM users WHERE role = 'admin'");
  return rows.map((r) => r.email).filter(Boolean);
}
async function getTenantAdminEmails(tenantId) {
  const { rows } = await pool.query(
    "SELECT email FROM users WHERE role = 'tenant_admin' AND tenant_id = $1", [tenantId]
  );
  return rows.map((r) => r.email).filter(Boolean);
}

async function probe(ep) {
  const started = Date.now();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(ep.url, {
      method: ep.method || 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'User-Agent': 'RachBase-Monitor/1.0' },
    });
    const latency = Date.now() - started;
    const ok = resp.status === ep.expected_status;
    return { ok, code: resp.status, latency, error: ok ? null : `Expected ${ep.expected_status}, got ${resp.status}` };
  } catch (err) {
    return { ok: false, code: null, latency: Date.now() - started, error: err.name === 'AbortError' ? 'Timeout' : err.message };
  } finally {
    clearTimeout(t);
  }
}

function alertHtml(ep, result, recovered) {
  const color = recovered ? '#059669' : '#dc2626';
  const title = recovered ? 'Endpoint recovered' : 'Endpoint down';
  return `
    <div style="font-family:system-ui,sans-serif;max-width:520px">
      <h2 style="color:${color};margin:0 0 8px">${title}</h2>
      <p style="margin:0 0 12px;color:#374151"><strong>${ep.name}</strong></p>
      <table style="border-collapse:collapse;font-size:13px;color:#374151">
        <tr><td style="padding:2px 12px 2px 0;color:#6b7280">URL</td><td><code>${ep.url}</code></td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#6b7280">Status</td><td>${result.code ?? '—'}${result.error ? ` (${result.error})` : ''}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#6b7280">Latency</td><td>${result.latency} ms</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#6b7280">Checked</td><td>${new Date().toISOString()}</td></tr>
      </table>
    </div>`;
}

async function maybeAlert(ep, result, recovered) {
  let recipients = [];
  try {
    recipients = [...await getTenantAdminEmails(ep.tenant_id), ...await getAdminEmails()];
  } catch (e) { console.error('[endpointProber] recipient lookup:', e.message); }
  recipients = [...new Set(recipients)];
  if (!recipients.length) return;

  const subject = recovered
    ? `✅ Recovered: ${ep.name}`
    : `⚠️ Down: ${ep.name} (${result.code ?? (result.error || 'no response')})`;
  try {
    await sendAlertEmail({ recipients, subject, htmlContent: alertHtml(ep, result, recovered) });
  } catch (e) { console.error('[endpointProber] send failed:', e.message); }
}

async function handle(ep) {
  const result = await probe(ep);
  const wasDown = ep.last_status === 'down';
  const failures = result.ok ? 0 : (ep.consecutive_failures || 0) + 1;
  const status = result.ok ? 'up' : 'down';

  // Decide alerting before writing, using previous state.
  let sendDown = false, sendRecover = false, clearCooldown = false, stampCooldown = false;
  if (!result.ok && failures >= ALERT_AFTER) {
    const last = ep.last_alerted_at ? new Date(ep.last_alerted_at).getTime() : 0;
    if (Date.now() - last >= COOLDOWN_MS) { sendDown = true; stampCooldown = true; }
  } else if (result.ok && wasDown) {
    sendRecover = true; clearCooldown = true;
  }

  await pool.query(
    `UPDATE monitored_endpoints
       SET last_status = $2, last_code = $3, last_latency_ms = $4, last_checked_at = NOW(),
           last_error = $5, consecutive_failures = $6
           ${stampCooldown ? ', last_alerted_at = NOW()' : ''}
           ${clearCooldown ? ', last_alerted_at = NULL' : ''}
     WHERE id = $1`,
    [ep.id, status, result.code, result.latency, result.error, failures]
  );
  await pool.query(
    `INSERT INTO endpoint_checks (endpoint_id, ok, status_code, latency_ms, error)
     VALUES ($1, $2, $3, $4, $5)`,
    [ep.id, result.ok, result.code, result.latency, result.error]
  );

  if (sendDown)    await maybeAlert(ep, result, false);
  if (sendRecover) await maybeAlert(ep, result, true);
}

async function tick() {
  if (running) return;      // never overlap ticks
  running = true;
  try {
    const { rows: due } = await pool.query(
      `SELECT * FROM monitored_endpoints
       WHERE enabled = TRUE
         AND (last_checked_at IS NULL
              OR last_checked_at <= NOW() - (interval_seconds || ' seconds')::interval)
       ORDER BY last_checked_at ASC NULLS FIRST
       LIMIT 200`
    );

    for (let i = 0; i < due.length; i += CONCURRENCY) {
      const batch = due.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map((ep) => handle(ep).catch((e) => console.error(`[endpointProber] ${ep.id}:`, e.message))));
    }

    if (++ticks % PRUNE_EVERY === 0) {
      await pool.query("DELETE FROM endpoint_checks WHERE checked_at < NOW() - INTERVAL '7 days'").catch(() => {});
    }
  } catch (err) {
    console.error('[endpointProber] tick error:', err.message);
  } finally {
    running = false;
  }
}

function start() {
  if (timer) return;
  console.log('[endpointProber] started');
  timer = setInterval(() => { tick().catch(() => {}); }, TICK_MS);
  if (timer.unref) timer.unref();
}
function stop() {
  if (timer) { clearInterval(timer); timer = null; console.log('[endpointProber] stopped'); }
}

module.exports = { start, stop, tick };
