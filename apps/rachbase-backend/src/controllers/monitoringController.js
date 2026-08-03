'use strict';

/**
 * Monitoring controller — Prometheus-backed VM monitoring.
 *
 * Scope resolution (what each role can see)
 * ─────────────────────────────────────────
 * admin         All VMs. Can narrow via ?userId.
 *
 * tenant_admin  If the tenant has pve_pool set → filter by pool label.
 *               Otherwise → explicit tenant_vm_assignments IDs.
 *               Can narrow to a user in their tenant via ?userId.
 *
 * tenant_user   Their own user_vm_assignments IDs only.
 *               Client-supplied query params are ignored.
 *
 * Scope object
 * ────────────
 * { pool: "k3s" }           → PromQL filter:  pool="k3s"
 * { vmIds: ["qemu/101"] }   → PromQL filter:  id=~"qemu/101|..."
 * {}                        → no filter (admin, sees everything)
 */

const dbPool       = require('@rach/core').pool;
const { promInstant, promRange, safeFloat, verifyConnection } = require('../services/prometheus');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VMID_RE = /^(qemu|lxc)\/\d+$/;

/**
 * Escape a value for safe interpolation inside a PromQL double-quoted label
 * value. PromQL label values are Go double-quoted strings, so a backslash or
 * quote in the value must be escaped or it breaks out of the selector.
 *
 * This is defence-in-depth: `vm_id`s are already format-validated on write, but
 * `pve_pool` is free text and every value that reaches a selector goes through
 * here so a stray quote can never alter query scope.
 */
function escapeLabelValue(v) {
  return String(v)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\r\n]/g, '');
}

/**
 * Keep only well-formed VM IDs. Defends the PromQL selectors even if a
 * malformed id was somehow persisted (direct DB write, future code path, import).
 */
function sanitizeVmIds(ids) {
  return ids.filter((id) => typeof id === 'string' && VMID_RE.test(id));
}

/**
 * Build a vmIds scope from raw DB values, dropping anything malformed. Throws a
 * 422 if nothing valid remains — critically, this never returns an empty scope,
 * which would otherwise widen to "all VMs" in scopeSelector().
 */
function vmIdScope(rawIds, emptyMessage) {
  const vmIds = sanitizeVmIds(rawIds);
  if (vmIds.length === 0) {
    const err = new Error(emptyMessage);
    err.status = 422;
    throw err;
  }
  return { vmIds };
}

// ---------------------------------------------------------------------------
// Scope resolution
// ---------------------------------------------------------------------------

/**
 * Returns a scope object describing what this request is allowed to see:
 *   { pool: string }          — filter by Proxmox pool label
 *   { vmIds: string[] }       — filter by explicit VM IDs
 *   {}                        — no filter (admin sees everything)
 */
async function resolveScope(req) {
  const { role, id: callerId, tenant_id } = req.user;

  // ── tenant_user ────────────────────────────────────────────────────────────
  if (role === 'tenant_user') {
    const { rows } = await dbPool.query(
      'SELECT vm_id FROM user_vm_assignments WHERE user_id = $1',
      [callerId]
    );
    if (rows.length === 0) {
      const err = new Error('No VMs are assigned to your account yet. Contact your administrator.');
      err.status = 422;
      throw err;
    }
    let vmIds = rows.map((r) => r.vm_id);

    // Defence-in-depth: for explicit-assignment tenants, restrict to VMs that
    // are actually in the caller's CURRENT tenant, so a stale user_vm_assignment
    // (e.g. left over from a previous tenant) can't leak another tenant's
    // metrics. Pool-based tenants are scoped by the pool label elsewhere.
    const { rows: tRows } = await dbPool.query('SELECT pve_pool FROM tenants WHERE id = $1', [tenant_id]);
    const tenantPool = tRows[0]?.pve_pool;
    if (!tenantPool) {
      const { rows: tva } = await dbPool.query(
        'SELECT vm_id FROM tenant_vm_assignments WHERE tenant_id = $1', [tenant_id]
      );
      const allowed = new Set(tva.map((r) => r.vm_id));
      vmIds = vmIds.filter((id) => allowed.has(id));
    }

    return vmIdScope(
      vmIds,
      'No valid VMs are assigned to your account. Contact your administrator.'
    );
  }

  // ── tenant_admin ───────────────────────────────────────────────────────────
  if (role === 'tenant_admin') {
    const { userId } = req.query;

    // Scoped to a specific user in this tenant
    if (userId) {
      const uid = parseInt(userId, 10);
      if (!Number.isInteger(uid) || uid < 1) {
        const err = new Error('Invalid userId'); err.status = 400; throw err;
      }
      const { rows: userRows } = await dbPool.query(
        'SELECT id FROM users WHERE id = $1 AND tenant_id = $2',
        [uid, tenant_id]
      );
      if (!userRows.length) {
        const err = new Error('User not found in your tenant'); err.status = 404; throw err;
      }
      const { rows } = await dbPool.query(
        'SELECT vm_id FROM user_vm_assignments WHERE user_id = $1',
        [uid]
      );
      if (rows.length === 0) {
        const err = new Error(`User ${uid} has no VMs assigned`); err.status = 422; throw err;
      }
      return vmIdScope(rows.map((r) => r.vm_id), `User ${uid} has no valid VMs assigned`);
    }

    // Full tenant scope: prefer pve_pool label, fall back to explicit IDs
    const { rows: tenantRows } = await dbPool.query(
      'SELECT pve_pool FROM tenants WHERE id = $1',
      [tenant_id]
    );
    const tenantPool = tenantRows[0]?.pve_pool;

    if (tenantPool) {
      // Use Proxmox pool label — any VM added to the pool automatically appears
      return { pool: tenantPool };
    }

    // Explicit VM IDs from tenant_vm_assignments
    const { rows } = await dbPool.query(
      'SELECT vm_id FROM tenant_vm_assignments WHERE tenant_id = $1',
      [tenant_id]
    );
    if (rows.length === 0) {
      const err = new Error('No VMs have been assigned to your tenant yet.');
      err.status = 422;
      throw err;
    }
    return vmIdScope(
      rows.map((r) => r.vm_id),
      'No valid VMs have been assigned to your tenant yet.'
    );
  }

  // ── admin: all VMs, optionally scoped to a specific user ──────────────────
  const { userId } = req.query;
  if (userId) {
    const id = parseInt(userId, 10);
    if (!Number.isInteger(id) || id < 1) {
      const err = new Error('Invalid userId'); err.status = 400; throw err;
    }
    const { rows } = await dbPool.query(
      'SELECT vm_id FROM user_vm_assignments WHERE user_id = $1',
      [id]
    );
    if (rows.length === 0) {
      const err = new Error(`User ${id} has no VMs assigned`); err.status = 422; throw err;
    }
    return vmIdScope(rows.map((r) => r.vm_id), `User ${id} has no valid VMs assigned`);
  }

  return {}; // admin sees everything
}

// ---------------------------------------------------------------------------
// PromQL helpers
// ---------------------------------------------------------------------------

/**
 * Build a selector fragment from a scope.
 *
 * pool scope  →  pool="k3s"
 * vmIds scope →  id=~"qemu/101|qemu/102"
 * empty scope →  (empty string)
 */
function scopeSelector(scope) {
  if (scope.pool)  return `pool="${escapeLabelValue(scope.pool)}"`;
  // vmIds are pre-sanitized in resolveScope (VMID_RE), so they contain no PromQL
  // metacharacters — safe to join into the id=~ regex.
  if (scope.vmIds && scope.vmIds.length) return `id=~"${scope.vmIds.join('|')}"`;
  return '';
}

/**
 * Build deduplicated guest-info selector.
 * Always excludes templates. Adds scope filter + any extra matchers.
 */
function guestInfo(scope, extra = '', keepLabels = 'name,type,pool') {
  const parts = ['template="0"'];
  const sel   = scopeSelector(scope);
  if (sel)   parts.unshift(sel);
  if (extra) parts.push(extra);
  const allLabels = ['id', ...keepLabels.split(',').filter(Boolean)].join(',');
  return `max by (${allLabels}) (pve_guest_info{${parts.join(',')}})`;
}

/**
 * Deduplicated scalar metric — averages across exporter instances.
 *
 * Pool-based scope: do NOT add a pool filter here because most pve_* metrics
 * (pve_up, pve_cpu_usage_ratio, pve_memory_usage_bytes, …) do NOT carry a
 * pool label — only pve_guest_info does.  The vector multiplication with
 * guestInfo() on the right side already restricts results to the correct VMs.
 *
 * vmIds scope: filter by id label (always present on every pve_* metric).
 */
function avgMetric(metric, scope) {
  if (scope.vmIds && scope.vmIds.length) {
    return `avg by (id) (${metric}{id=~"${scope.vmIds.join('|')}"})`;
  }
  return `avg by (id) (${metric})`;
}

/** Build a lookup map { vmId → value } from a Prometheus instant result. */
function byId(results, fn) {
  return Object.fromEntries(results.map((r) => [r.metric.id, fn(r)]));
}

// ---------------------------------------------------------------------------
// GET /api/monitoring/verify
// ---------------------------------------------------------------------------

async function verify(req, res) {
  const result = await verifyConnection();
  res.json({ ok: true, ...result });
}

// ---------------------------------------------------------------------------
// GET /api/monitoring/summary
// ---------------------------------------------------------------------------

async function getSummary(req, res) {
  const scope = await resolveScope(req);

  const [runningRes, totalRes, lxcRunningRes, lxcTotalRes, guestsRes] =
    await Promise.all([
      promInstant(`count(${avgMetric('pve_up', scope)} * on(id) group_left(type,pool) ${guestInfo(scope, 'type="qemu"', 'type,pool')} == 1)`),
      promInstant(`count(${guestInfo(scope, 'type="qemu"', '')})`),
      promInstant(`count(${avgMetric('pve_up', scope)} * on(id) group_left(type,pool) ${guestInfo(scope, 'type="lxc"', 'type,pool')} == 1)`),
      promInstant(`count(${guestInfo(scope, 'type="lxc"', '')})`),
      promInstant(`${avgMetric('pve_cpu_usage_ratio', scope)} * on(id) group_left(name,type,pool) ${guestInfo(scope)}`),
    ]);

  const vmRunning  = parseInt(runningRes[0]?.value[1]    ?? '0', 10);
  const vmTotal    = parseInt(totalRes[0]?.value[1]      ?? '0', 10);
  const lxcRunning = parseInt(lxcRunningRes[0]?.value[1] ?? '0', 10);
  const lxcTotal   = parseInt(lxcTotalRes[0]?.value[1]   ?? '0', 10);

  const guests = guestsRes.map((r) => ({
    id    : r.metric.id,
    name  : r.metric.name ?? r.metric.id,
    type  : r.metric.type ?? 'qemu',
    pool  : r.metric.pool ?? null,
    cpuPct: Math.round(safeFloat(r.value[1]) * 1000) / 10,
  }));

  res.json({
    snapshotTime: new Date().toISOString(),
    poolName: scope.pool ?? null,
    vms: { running: vmRunning, stopped: vmTotal - vmRunning, total: vmTotal },
    lxc: { running: lxcRunning, stopped: lxcTotal - lxcRunning, total: lxcTotal },
    guests,
  });
}

// ---------------------------------------------------------------------------
// GET /api/monitoring/vms
// ---------------------------------------------------------------------------

// In-guest memory via node_exporter, keyed by host IP (the `instance` label with
// its :port stripped). `MemAvailable` excludes reclaimable page cache, so
// 1 - MemAvailable/MemTotal reflects real memory pressure — more accurate than
// the hypervisor's pve_memory_usage_bytes. Returns { "10.0.31.10": {total,avail}, … }.
// Empty/absent when node_exporter isn't scraped, so callers fall back to PVE.
// Escape a literal (an IP) for use inside a PromQL =~ regex (RE2).
function escapeRelabel(s) {
  return String(s).replace(/[.*+?()|[\]{}^$\\]/g, '\\$&');
}

async function nodeMemByHost() {
  let totalRes = [], availRes = [];
  try {
    [totalRes, availRes] = await Promise.all([
      promInstant('node_memory_MemTotal_bytes'),
      promInstant('node_memory_MemAvailable_bytes'),
    ]);
  } catch (e) {
    console.warn('[monitoring] node_exporter memory query failed, using PVE:', e.message);
    return {};
  }
  const host = (inst) => String(inst || '').split(':')[0].trim();
  // Index each series under BOTH keys we might join on: the Proxmox `id` label
  // (present only if ARKA relabels node_exporter with it — the reliable key) and
  // the host IP from `instance`. The lookup then tries id first, then IP.
  const map = {};
  const put = (r, field) => {
    const val = safeFloat(r.value[1]);
    for (const key of [r.metric.id, host(r.metric.instance)]) {
      if (key) (map[key] ??= {})[field] = val;
    }
  };
  for (const r of totalRes) put(r, 'total');
  for (const r of availRes) put(r, 'avail');
  return map;
}

// Proxmox id → guest IP, so node_exporter series (keyed by IP) can be joined to
// the VM list (keyed by Proxmox id).
async function vmIpMap() {
  const { rows } = await dbPool.query('SELECT vm_id, ip_address FROM vm_ssh_config');
  const m = {};
  for (const r of rows) if (r.ip_address) m[r.vm_id] = String(r.ip_address).trim();
  return m;
}

async function getVMs(req, res) {
  const scope = await resolveScope(req);

  // pve_guest_info is the authoritative source for the VM list — it's present
  // for both running and stopped guests. Other metrics (cpu, mem, up) may be
  // absent when a VM is powered off, so we never use them to build allIds.
  const [infoRes, cpuRes, memUsedRes, memSizeRes, diskUsedRes, diskSizeRes, uptimeRes, upRes] = await Promise.all([
    promInstant(guestInfo(scope)),
    promInstant(`${avgMetric('pve_cpu_usage_ratio',    scope)} * on(id) group_left(name,type,pool) ${guestInfo(scope)}`),
    promInstant(`${avgMetric('pve_memory_usage_bytes', scope)} * on(id) group_left(name,type,pool) ${guestInfo(scope)}`),
    promInstant(`${avgMetric('pve_memory_size_bytes',  scope)} * on(id) group_left(name,type,pool) ${guestInfo(scope)}`),
    promInstant(`${avgMetric('pve_disk_usage_bytes',   scope)} * on(id) group_left(name,type,pool) ${guestInfo(scope)}`),
    promInstant(`${avgMetric('pve_disk_size_bytes',    scope)} * on(id) group_left(name,type,pool) ${guestInfo(scope)}`),
    promInstant(`${avgMetric('pve_uptime_seconds',     scope)} * on(id) group_left(name,type,pool) ${guestInfo(scope)}`),
    promInstant(`${avgMetric('pve_up',                 scope)} * on(id) group_left(name,type,pool) ${guestInfo(scope)}`),
  ]);

  const cpuMap      = byId(cpuRes,      (r) => safeFloat(r.value[1]) * 100);
  const memUsedMap  = byId(memUsedRes,  (r) => safeFloat(r.value[1]) / 1073741824);
  const memSizeMap  = byId(memSizeRes,  (r) => safeFloat(r.value[1]) / 1073741824);
  const diskUsedMap = byId(diskUsedRes, (r) => safeFloat(r.value[1]) / 1073741824);
  const diskSizeMap = byId(diskSizeRes, (r) => safeFloat(r.value[1]) / 1073741824);
  const uptimeMap   = byId(uptimeRes,   (r) => safeFloat(r.value[1]));
  const upMap       = byId(upRes,       (r) => safeFloat(r.value[1]));

  // In-guest memory (node_exporter) + the id→IP map to join it. Both degrade to
  // {} on failure so memory silently falls back to the PVE numbers.
  const [nodeMem, ipById] = await Promise.all([nodeMemByHost(), vmIpMap()]);

  // Use pve_guest_info as the authoritative VM list (includes stopped guests)
  const allIds = new Set(infoRes.map((r) => r.metric.id));

  const metaMap = {};
  for (const r of infoRes) {
    metaMap[r.metric.id] = {
      name  : r.metric.name ?? r.metric.id,
      type  : r.metric.type ?? 'qemu',
      pool  : r.metric.pool ?? null,
      // pve_up is absent for stopped VMs → treat missing as stopped
      status: upMap[r.metric.id] === 1 ? 'running' : 'stopped',
    };
  }

  const vms = Array.from(allIds).map((id) => {
    const meta     = metaMap[id] ?? { name: id, type: 'qemu', status: 'stopped', pool: null };
    let   memUsed  = memUsedMap[id]  ?? 0;   // PVE (GiB) — fallback
    let   memTotal = memSizeMap[id]  ?? 0;
    let   memSource = 'pve';

    // Prefer in-guest node_exporter when scraped — matched by Proxmox id label
    // first, then by the guest IP.
    const node = nodeMem[id] || (ipById[id] ? nodeMem[ipById[id]] : null);
    if (node && node.total > 0 && node.avail != null) {
      memTotal   = node.total / 1073741824;
      memUsed    = (node.total - node.avail) / 1073741824;
      memSource  = 'node_exporter';
    }

    const diskUsed = diskUsedMap[id] ?? 0;
    const diskTotal= diskSizeMap[id] ?? 0;
    return {
      id,
      name          : meta.name,
      type          : meta.type,
      status        : meta.status,
      pool          : meta.pool,
      cpuPct        : Math.round((cpuMap[id] ?? 0) * 10) / 10,
      memoryUsedGib : Math.round(memUsed   * 100) / 100,
      memoryTotalGib: Math.round(memTotal  * 100) / 100,
      memoryPct     : memTotal  > 0 ? Math.round((memUsed  / memTotal)  * 1000) / 10 : 0,
      memorySource  : memSource,
      diskUsedGib   : Math.round(diskUsed  * 100) / 100,
      diskTotalGib  : Math.round(diskTotal * 100) / 100,
      diskPct       : diskTotal > 0 ? Math.round((diskUsed / diskTotal) * 1000) / 10 : 0,
      uptimeSeconds : Math.round(uptimeMap[id] ?? 0),
    };
  });

  vms.sort((a, b) => {
    if (a.status === b.status) return a.name.localeCompare(b.name);
    return a.status === 'running' ? -1 : 1;
  });

  res.json({ snapshotTime: new Date().toISOString(), vms });
}

// ---------------------------------------------------------------------------
// GET /api/monitoring/vms/:vmId
// ---------------------------------------------------------------------------

async function getVM(req, res) {
  const { vmId } = req.params;

  if (!VMID_RE.test(vmId)) {
    return res.status(400).json({ error: 'Invalid vmId format — expected qemu/<n> or lxc/<n>' });
  }

  // Ownership check for non-admins
  if (req.user.role === 'tenant_user') {
    const { rows } = await dbPool.query(
      'SELECT 1 FROM user_vm_assignments WHERE user_id = $1 AND vm_id = $2',
      [req.user.id, vmId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'VM not found' });
  } else if (req.user.role === 'tenant_admin') {
    // Check against pool or explicit assignments
    const { rows: tenantRows } = await dbPool.query(
      'SELECT pve_pool FROM tenants WHERE id = $1',
      [req.user.tenant_id]
    );
    const pvePool = tenantRows[0]?.pve_pool;

    if (pvePool) {
      // Check VM is in this pool via Prometheus
      const check = await promInstant(
        `pve_guest_info{id="${vmId}",pool="${escapeLabelValue(pvePool)}",template="0"}`
      );
      if (check.length === 0) return res.status(404).json({ error: 'VM not found' });
    } else {
      const { rows } = await dbPool.query(
        'SELECT 1 FROM tenant_vm_assignments WHERE tenant_id = $1 AND vm_id = $2',
        [req.user.tenant_id, vmId]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'VM not found' });
    }
  }

  const idf = `id="${vmId}"`;

  const [infoRes, cpuRes, memUsedRes, memSizeRes, diskUsedRes, diskSizeRes, uptimeRes, upRes] = await Promise.all([
    promInstant(`max by (id,name,type,pool,node) (pve_guest_info{${idf},template="0"})`),
    promInstant(`avg by (id) (pve_cpu_usage_ratio{${idf}})`),
    promInstant(`avg by (id) (pve_memory_usage_bytes{${idf}})`),
    promInstant(`avg by (id) (pve_memory_size_bytes{${idf}})`),
    promInstant(`avg by (id) (pve_disk_usage_bytes{${idf}})`),
    promInstant(`avg by (id) (pve_disk_size_bytes{${idf}})`),
    promInstant(`avg by (id) (pve_uptime_seconds{${idf}})`),
    promInstant(`avg by (id) (pve_up{${idf}})`),
  ]);

  if (infoRes.length === 0) {
    return res.status(404).json({ error: `VM ${vmId} not found` });
  }

  const info         = infoRes[0].metric;
  const cpuPct       = Math.round(safeFloat(cpuRes[0]?.value[1]) * 1000) / 10;
  const memUsedGib   = Math.round((safeFloat(memUsedRes[0]?.value[1])  / 1073741824) * 100) / 100;
  const memTotalGib  = Math.round((safeFloat(memSizeRes[0]?.value[1])  / 1073741824) * 100) / 100;
  const memPct       = memTotalGib  > 0 ? Math.round((memUsedGib  / memTotalGib)  * 1000) / 10 : 0;
  const diskUsedGib  = Math.round((safeFloat(diskUsedRes[0]?.value[1]) / 1073741824) * 100) / 100;
  const diskTotalGib = Math.round((safeFloat(diskSizeRes[0]?.value[1]) / 1073741824) * 100) / 100;
  const diskPct      = diskTotalGib > 0 ? Math.round((diskUsedGib / diskTotalGib) * 1000) / 10 : 0;
  const uptime       = Math.round(safeFloat(uptimeRes[0]?.value[1]));
  const isUp         = safeFloat(upRes[0]?.value[1]) === 1;

  res.json({
    id            : vmId,
    name          : info.name ?? vmId,
    type          : info.type ?? 'qemu',
    status        : isUp ? 'running' : 'stopped',
    pool          : info.pool ?? null,
    node          : info.node ?? null,
    cpuPct,
    memoryUsedGib,
    memoryTotalGib,
    memoryPct     : memPct,
    diskUsedGib,
    diskTotalGib,
    diskPct,
    uptimeSeconds : uptime,
  });
}

// ---------------------------------------------------------------------------
// GET /api/monitoring/history
// ---------------------------------------------------------------------------

async function getHistory(req, res) {
  const { vmId, hours: hoursStr } = req.query;

  if (!vmId) return res.status(400).json({ error: 'vmId query parameter is required' });
  if (!VMID_RE.test(vmId)) {
    return res.status(400).json({ error: 'Invalid vmId format — expected qemu/<n> or lxc/<n>' });
  }

  // Ownership check
  if (req.user.role === 'tenant_user') {
    const { rows } = await dbPool.query(
      'SELECT 1 FROM user_vm_assignments WHERE user_id = $1 AND vm_id = $2',
      [req.user.id, vmId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'VM not found' });
  } else if (req.user.role === 'tenant_admin') {
    const { rows: tenantRows } = await dbPool.query(
      'SELECT pve_pool FROM tenants WHERE id = $1',
      [req.user.tenant_id]
    );
    const pvePool = tenantRows[0]?.pve_pool;
    if (pvePool) {
      const check = await promInstant(
        `pve_guest_info{id="${vmId}",pool="${escapeLabelValue(pvePool)}",template="0"}`
      );
      if (check.length === 0) return res.status(404).json({ error: 'VM not found' });
    } else {
      const { rows } = await dbPool.query(
        'SELECT 1 FROM tenant_vm_assignments WHERE tenant_id = $1 AND vm_id = $2',
        [req.user.tenant_id, vmId]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'VM not found' });
    }
  }

  const hours = Math.min(Math.max(parseInt(hoursStr ?? '1', 10) || 1, 1), 168);

  let stepSec;
  if      (hours <= 0.5) stepSec = 30;
  else if (hours <= 6)   stepSec = 60;
  else if (hours <= 24)  stepSec = 300;
  else                   stepSec = 900;

  const now   = Date.now();
  const start = now - hours * 3_600_000;

  // Prefer in-guest node_exporter memory history — matched by the Proxmox id
  // label first (if ARKA relabels), then the guest IP; else the pve series.
  let nodeSel = null;
  try {
    if ((await promInstant(`node_memory_MemTotal_bytes{id="${vmId}"}`)).length) {
      nodeSel = `{id="${vmId}"}`;
    } else {
      const { rows } = await dbPool.query('SELECT ip_address FROM vm_ssh_config WHERE vm_id = $1', [vmId]);
      const ip = rows[0]?.ip_address ? String(rows[0].ip_address).trim() : null;
      if (ip) {
        const sel = `{instance=~"^${escapeRelabel(ip)}(:.*)?$"}`;
        if ((await promInstant(`node_memory_MemTotal_bytes${sel}`)).length) nodeSel = sel;
      }
    }
  } catch { /* fall back to PVE */ }

  const [cpuHistory, memNode] = await Promise.all([
    promRange(`avg by (id) (pve_cpu_usage_ratio{id="${vmId}"}) * 100`, start, now, stepSec),
    nodeSel
      ? promRange(`(1 - node_memory_MemAvailable_bytes${nodeSel} / node_memory_MemTotal_bytes${nodeSel}) * 100`, start, now, stepSec)
      : Promise.resolve([]),
  ]);
  const memHistory = (memNode && memNode.length)
    ? memNode
    : await promRange(
        `avg by (id) (pve_memory_usage_bytes{id="${vmId}"}) / avg by (id) (pve_memory_size_bytes{id="${vmId}"}) * 100`,
        start, now, stepSec
      );

  const cpuPoints = cpuHistory[0]?.values ?? [];
  const memPoints = memHistory[0]?.values ?? [];

  const points = cpuPoints.map(([ts, cpuVal], i) => ({
    time     : new Date(ts * 1000).toISOString(),
    cpuPct   : Math.round(safeFloat(cpuVal) * 10) / 10,
    memoryPct: Math.round(safeFloat(memPoints[i]?.[1] ?? '0') * 10) / 10,
  }));

  res.json({ vmId, hours, stepSeconds: stepSec, points });
}

// ---------------------------------------------------------------------------
// GET /api/monitoring/users  (admin only)
// ---------------------------------------------------------------------------

async function getAllUsersUsage(req, res) {
  // 1. Get all tenant users with their assigned VMs and tenant info
  const { rows: assignments } = await dbPool.query(`
    SELECT u.id, u.name, u.email, u.role, u.tenant_id,
           t.name AS tenant_name, t.pve_pool AS tenant_pool,
           array_agg(a.vm_id) AS vm_ids
    FROM users u
    JOIN user_vm_assignments a ON a.user_id = u.id
    LEFT JOIN tenants t ON t.id = u.tenant_id
    WHERE u.role IN ('tenant_admin', 'tenant_user')
    GROUP BY u.id, u.name, u.email, u.role, u.tenant_id, t.name, t.pve_pool
    ORDER BY t.name, u.name
  `);

  if (assignments.length === 0) {
    return res.json({ snapshotTime: new Date().toISOString(), tenants: [] });
  }

  // 2. Single Prometheus pass — all VMs unfiltered
  const noScope = {};
  const allGuests = guestInfo(noScope);

  const [cpuRes, memUsedRes, memSizeRes, upRes] = await Promise.all([
    promInstant(`${avgMetric('pve_cpu_usage_ratio',    noScope)} * on(id) group_left(name,type,pool) ${allGuests}`),
    promInstant(`${avgMetric('pve_memory_usage_bytes', noScope)} * on(id) group_left(name,type,pool) ${allGuests}`),
    promInstant(`${avgMetric('pve_memory_size_bytes',  noScope)} * on(id) group_left(name,type,pool) ${allGuests}`),
    promInstant(`${avgMetric('pve_up',                 noScope)} * on(id) group_left(name,type,pool) ${allGuests}`),
  ]);

  const cpuMap     = byId(cpuRes,     (r) => safeFloat(r.value[1]) * 100);
  const memUsedMap = byId(memUsedRes, (r) => safeFloat(r.value[1]) / 1073741824);
  const memSizeMap = byId(memSizeRes, (r) => safeFloat(r.value[1]) / 1073741824);
  const upMap      = byId(upRes,      (r) => safeFloat(r.value[1]));

  const metaMap = {};
  for (const r of [...cpuRes, ...upRes]) {
    if (!metaMap[r.metric.id]) {
      metaMap[r.metric.id] = {
        name  : r.metric.name ?? r.metric.id,
        type  : r.metric.type ?? 'qemu',
        pool  : r.metric.pool ?? null,
        status: upMap[r.metric.id] === 1 ? 'running' : 'stopped',
      };
    }
  }

  // 3. Group by tenant → user → VMs
  const tenantMap = {};
  for (const user of assignments) {
    const tid = user.tenant_id ?? 'none';
    if (!tenantMap[tid]) {
      tenantMap[tid] = {
        tenantId  : user.tenant_id,
        tenantName: user.tenant_name ?? 'Unassigned',
        pvePool   : user.tenant_pool ?? null,
        users     : [],
      };
    }

    const vmIds = user.vm_ids || [];
    let running = 0, stopped = 0, totalCpu = 0, totalMemUsed = 0, totalMemSize = 0;

    const guests = vmIds.map((id) => {
      const meta           = metaMap[id] ?? { name: id, type: 'qemu', pool: null, status: 'unknown' };
      const cpuPct         = Math.round((cpuMap[id] ?? 0) * 10) / 10;
      const memoryUsedGib  = Math.round((memUsedMap[id] ?? 0) * 100) / 100;
      const memoryTotalGib = Math.round((memSizeMap[id] ?? 0) * 100) / 100;

      if (meta.status === 'running') running++; else stopped++;
      totalCpu     += cpuMap[id]     ?? 0;
      totalMemUsed += memUsedMap[id] ?? 0;
      totalMemSize += memSizeMap[id] ?? 0;

      return { id, name: meta.name, type: meta.type, pool: meta.pool, status: meta.status, cpuPct, memoryUsedGib, memoryTotalGib };
    });

    guests.sort((a, b) => {
      if (a.status === b.status) return a.name.localeCompare(b.name);
      return a.status === 'running' ? -1 : 1;
    });

    const total     = vmIds.length;
    const avgCpuPct = total > 0 ? Math.round((totalCpu / total) * 10) / 10 : 0;
    const memPct    = totalMemSize > 0 ? Math.round((totalMemUsed / totalMemSize) * 1000) / 10 : 0;

    tenantMap[tid].users.push({
      userId             : user.id,
      name               : user.name,
      email              : user.email,
      role               : user.role,
      vms                : { running, stopped, total },
      avgCpuPct,
      totalMemoryUsedGib : Math.round(totalMemUsed * 100) / 100,
      totalMemoryTotalGib: Math.round(totalMemSize * 100) / 100,
      memoryPct          : memPct,
      guests,
    });
  }

  const tenants = Object.values(tenantMap);
  res.json({ snapshotTime: new Date().toISOString(), tenants });
}

module.exports = { verify, getSummary, getVMs, getVM, getHistory, getAllUsersUsage };
