'use strict';

/**
 * VM Alert Monitor
 *
 * Polls Prometheus every CHECK_INTERVAL_MS (default 5 minutes).
 * When any VM's CPU, RAM, or disk exceeds ALERT_THRESHOLD_PCT (default 80%),
 * it sends an email alert to:
 *   - The tenant_admin(s) of the tenant that owns that VM
 *   - All rachdev admins
 *
 * Cooldown: once alerted for a given vm+metric combination, the same alert
 * won't fire again for COOLDOWN_MS (default 1 hour).
 */

const dbPool       = require('@rach/core').pool;
const { promInstant, safeFloat } = require('./prometheus');
const { sendAlertEmail } = require('@rach/core').brevo;

const ALERT_THRESHOLD_PCT  = 80;
const CHECK_INTERVAL_MS    = 5 * 60 * 1000;   // 5 minutes
const COOLDOWN_MS          = 4 * 60 * 60 * 1000;  // 4 hours

// In-memory cooldown tracker: key = "vmId:metric", value = timestamp of last alert
const lastAlerted = new Map();

function isCooledDown(vmId, metric) {
  const key = `${vmId}:${metric}`;
  const last = lastAlerted.get(key);
  if (!last) return true;
  return Date.now() - last > COOLDOWN_MS;
}

function markAlerted(vmId, metric) {
  lastAlerted.set(`${vmId}:${metric}`, Date.now());
}

// ---------------------------------------------------------------------------
// Prometheus helpers (duplicated lightly from monitoringController to avoid
// circular deps — these operate on the full unscoped fleet)
// ---------------------------------------------------------------------------

function avgMetric(metric) {
  return `avg by (id) (${metric})`;
}

function guestInfoAll() {
  return `max by (id,name,type,pool) (pve_guest_info{template="0"})`;
}

function byId(results, fn) {
  return Object.fromEntries(results.map((r) => [r.metric.id, fn(r)]));
}

// ---------------------------------------------------------------------------
// Fetch current metrics for all VMs
// ---------------------------------------------------------------------------

async function fetchAllVMs() {
  const guests = guestInfoAll();

  const [infoRes, cpuRes, memUsedRes, memSizeRes, diskUsedRes, diskSizeRes, upRes] =
    await Promise.all([
      promInstant(guests),
      promInstant(`${avgMetric('pve_cpu_usage_ratio')}    * on(id) group_left(name,type,pool) ${guests}`),
      promInstant(`${avgMetric('pve_memory_usage_bytes')} * on(id) group_left(name,type,pool) ${guests}`),
      promInstant(`${avgMetric('pve_memory_size_bytes')}  * on(id) group_left(name,type,pool) ${guests}`),
      promInstant(`${avgMetric('pve_disk_usage_bytes')}   * on(id) group_left(name,type,pool) ${guests}`),
      promInstant(`${avgMetric('pve_disk_size_bytes')}    * on(id) group_left(name,type,pool) ${guests}`),
      promInstant(`${avgMetric('pve_up')}                 * on(id) group_left(name,type,pool) ${guests}`),
    ]);

  const cpuMap      = byId(cpuRes,      (r) => safeFloat(r.value[1]) * 100);
  const memUsedMap  = byId(memUsedRes,  (r) => safeFloat(r.value[1]));
  const memSizeMap  = byId(memSizeRes,  (r) => safeFloat(r.value[1]));
  const diskUsedMap = byId(diskUsedRes, (r) => safeFloat(r.value[1]));
  const diskSizeMap = byId(diskSizeRes, (r) => safeFloat(r.value[1]));
  const upMap       = byId(upRes,       (r) => safeFloat(r.value[1]));

  return infoRes.map((r) => {
    const id       = r.metric.id;
    const memUsed  = memUsedMap[id]  ?? 0;
    const memTotal = memSizeMap[id]  ?? 0;
    const diskUsed = diskUsedMap[id] ?? 0;
    const diskTotal= diskSizeMap[id] ?? 0;
    return {
      id,
      name    : r.metric.name ?? id,
      type    : r.metric.type ?? 'qemu',
      pool    : r.metric.pool ?? null,
      status  : upMap[id] === 1 ? 'running' : 'stopped',
      cpuPct  : Math.round((cpuMap[id] ?? 0) * 10) / 10,
      memPct  : memTotal > 0 ? Math.round((memUsed  / memTotal)  * 1000) / 10 : 0,
      diskPct : diskTotal > 0 ? Math.round((diskUsed / diskTotal) * 1000) / 10 : 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Build a vmId → tenant map in TWO queries (no per-VM round-trips)
// ---------------------------------------------------------------------------

async function buildTenantMap(vms) {
  // 1. Pool-based tenants: one query for all distinct pool labels
  const pools = [...new Set(vms.map((v) => v.pool).filter(Boolean))];
  let poolTenantMap = {}; // pool → { id, name }
  if (pools.length) {
    const { rows } = await dbPool.query(
      'SELECT id, name, pve_pool FROM tenants WHERE pve_pool = ANY($1)',
      [pools]
    );
    for (const row of rows) poolTenantMap[row.pve_pool] = { id: row.id, name: row.name };
  }

  // 2. Explicit assignments: one query for all VM IDs
  const vmIds = vms.map((v) => v.id);
  let assignmentMap = {}; // vmId → { id, name }
  if (vmIds.length) {
    const { rows } = await dbPool.query(
      `SELECT DISTINCT ON (tva.vm_id) tva.vm_id, t.id, t.name
       FROM tenant_vm_assignments tva
       JOIN tenants t ON t.id = tva.tenant_id
       WHERE tva.vm_id = ANY($1)`,
      [vmIds]
    );
    for (const row of rows) assignmentMap[row.vm_id] = { id: row.id, name: row.name };
  }

  // Return a lookup function
  return (vmId, poolLabel) =>
    (poolLabel && poolTenantMap[poolLabel]) || assignmentMap[vmId] || null;
}

// ---------------------------------------------------------------------------
// Fetch recipient emails
// ---------------------------------------------------------------------------

async function getAdminEmails() {
  const { rows } = await dbPool.query(
    "SELECT email, name FROM users WHERE role = 'admin'"
  );
  return rows;
}

async function getTenantAdminEmails(tenantId) {
  const { rows } = await dbPool.query(
    "SELECT email, name FROM users WHERE role = 'tenant_admin' AND tenant_id = $1",
    [tenantId]
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Build email HTML
// ---------------------------------------------------------------------------

function alertEmailHtml(alerts, tenantName) {
  const rows = alerts.map(({ vm, metric, pct }) => {
    const metricLabel = metric === 'cpu' ? 'CPU' : metric === 'mem' ? 'RAM' : 'Disk';
    const color = pct >= 95 ? '#dc2626' : '#ea580c';
    return `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;">
          <strong style="color:#111827;">${vm.name}</strong>
          <span style="color:#6b7280;font-size:12px;margin-left:6px;font-family:monospace;">${vm.id}</span>
        </td>
        <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;color:#6b7280;">${vm.type.toUpperCase()}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;font-weight:600;color:${color};">
          ${metricLabel}: ${pct}%
        </td>
      </tr>`;
  }).join('');

  const scope = tenantName ? `Tenant: <strong>${tenantName}</strong>` : 'All VMs';

  return `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:24px 28px;">
          <h1 style="margin:0;color:#fff;font-size:18px;">⚠️ VM Resource Alert</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">${scope}</p>
        </div>
        <div style="padding:24px 28px;">
          <p style="margin:0 0 16px;color:#374151;font-size:14px;">
            The following virtual machines have exceeded <strong>${ALERT_THRESHOLD_PCT}%</strong> resource usage:
          </p>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;letter-spacing:0.05em;">VM</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;letter-spacing:0.05em;">Type</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;letter-spacing:0.05em;">Usage</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="margin:20px 0 0;color:#6b7280;font-size:12px;">
            Sent by SpaceArk VM Monitor · Alerts repeat every hour while the issue persists.
          </p>
        </div>
      </div>
    </body>
    </html>`;
}

// ---------------------------------------------------------------------------
// Main check
// ---------------------------------------------------------------------------

async function runCheck() {
  let vms;
  try {
    vms = await fetchAllVMs();
  } catch (err) {
    console.error('[alertMonitor] Failed to fetch VM metrics:', err.message);
    return;
  }

  // Build tenant lookup map in 2 DB queries (not N)
  let getTenant;
  try {
    getTenant = await buildTenantMap(vms);
  } catch (err) {
    console.error('[alertMonitor] Failed to build tenant map:', err.message);
    return;
  }

  // Collect alerts that are new (past cooldown)
  // Group by tenantId → list of { vm, metric, pct }
  const tenantAlerts = new Map(); // tenantId → { tenant, alerts[] }

  for (const vm of vms) {
    if (vm.status !== 'running') continue;

    const breaches = [];
    if (vm.cpuPct  >= ALERT_THRESHOLD_PCT && isCooledDown(vm.id, 'cpu'))  breaches.push({ metric: 'cpu',  pct: vm.cpuPct  });
    if (vm.memPct  >= ALERT_THRESHOLD_PCT && isCooledDown(vm.id, 'mem'))  breaches.push({ metric: 'mem',  pct: vm.memPct  });
    if (vm.diskPct >= ALERT_THRESHOLD_PCT && isCooledDown(vm.id, 'disk')) breaches.push({ metric: 'disk', pct: vm.diskPct });

    if (!breaches.length) continue;

    const tenant    = getTenant(vm.id, vm.pool);
    const tenantKey = tenant?.id ?? '__admin_only__';
    if (!tenantAlerts.has(tenantKey)) {
      tenantAlerts.set(tenantKey, { tenant, alerts: [] });
    }
    for (const breach of breaches) {
      tenantAlerts.get(tenantKey).alerts.push({ vm, ...breach });
      markAlerted(vm.id, breach.metric);
    }
  }

  if (!tenantAlerts.size) return;

  // Fetch rachdev admin emails once (they get every alert)
  let adminRecipients;
  try {
    adminRecipients = await getAdminEmails();
  } catch (err) {
    console.error('[alertMonitor] Could not fetch admin emails:', err.message);
    adminRecipients = [];
  }

  for (const [, { tenant, alerts }] of tenantAlerts) {
    const tenantName = tenant?.name ?? null;
    const html       = alertEmailHtml(alerts, tenantName);
    const vmCount    = new Set(alerts.map((a) => a.vm.id)).size;
    const subject    = `⚠️ VM Alert: ${vmCount} VM${vmCount > 1 ? 's' : ''} above ${ALERT_THRESHOLD_PCT}% usage${tenantName ? ` — ${tenantName}` : ''}`;

    // Collect all recipients: tenant admins + rachdev admins
    let tenantAdmins = [];
    if (tenant?.id) {
      try {
        tenantAdmins = await getTenantAdminEmails(tenant.id);
      } catch (err) {
        console.error('[alertMonitor] Could not fetch tenant admin emails:', err.message);
      }
    }

    const allRecipients = [
      ...tenantAdmins.map((r) => r.email),
      ...adminRecipients.map((r) => r.email),
    ];
    const uniqueRecipients = [...new Set(allRecipients)];

    if (!uniqueRecipients.length) continue;

    try {
      const sent = await sendAlertEmail({ recipients: uniqueRecipients, subject, htmlContent: html });
      if (sent) {
        console.log(`[alertMonitor] Alert sent for ${alerts.length} breach(es) → ${uniqueRecipients.join(', ')}`);
      }
    } catch (err) {
      console.error('[alertMonitor] Failed to send alert email:', err.message);
    }
  }
}

// ---------------------------------------------------------------------------
// Start / stop
// ---------------------------------------------------------------------------

let _timer = null;

function start() {
  if (_timer) return;
  console.log(`[alertMonitor] Started — checking every ${CHECK_INTERVAL_MS / 60000} min, threshold ${ALERT_THRESHOLD_PCT}%`);
  // Run once at startup after a 30s delay (let Prometheus settle), then on interval
  setTimeout(() => {
    runCheck();
    _timer = setInterval(runCheck, CHECK_INTERVAL_MS);
  }, 30_000);
}

function stop() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

module.exports = { start, stop };
