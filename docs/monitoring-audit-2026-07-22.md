# Monitoring Feature Audit — Security + Code Review

**Date:** 2026-07-22
**Scope:** Frontend (`rachbase-web`) + backend (`rachbase-backend`) monitoring feature — VM monitoring APIs, alerting, and dashboard pages.
**Type:** Security review + code correctness review.

## Files reviewed

Backend: `routes/monitoring.js`, `controllers/monitoringController.js`, `services/prometheus.js`, `services/alertMonitor.js`, `services/alerting.js`, `models/serviceAlert.js`, `middleware/serviceAuth.js`, `routes/internal.js`, `controllers/internalController.js`, `controllers/vmAssignmentController.js`.
Frontend: `app/dashboard/monitoring/page.tsx`, `app/dashboard/vm-monitor/page.tsx`, `lib/api.ts` (monitoring client), `components/VMHistoryModal.tsx`.

## Summary

The monitoring stack is well structured: routes are authenticated, scope resolution is centralized in the controller (not client-overridable), the frontend sends the token as a Bearer header and encodes path params, and role checks exist on both tiers. The most serious issue is a **cross-tenant data-disclosure path through unescaped PromQL built from stored, tenant-controllable values**. There is also a powerful internal remote-command endpoint whose only gate is a single static, non-constant-time-compared secret.

Counts: **High 1**, **Medium 2**, **Low 4**, **Info/quality 4**.

---

## Update — 2026-07-22: fixes implemented

Security findings H1, M2, and L1–L4 plus I1 have been implemented. **M1 is moved to the (separate) infrastructure audit** — `/internal/run-command` is a control-plane endpoint (SSH into VMs), not part of the monitoring data path; it only surfaced here because it shares the `/internal` routes and `serviceAuth` token with the alert-ingestion endpoints. It belongs with `deploy` and the web terminal (`terminalServer.js`) in that review. The I2–I4 code-quality refactors were left for later.

**Correction to H1 severity.** On implementation it was confirmed that both `vm_id` write paths already enforce `VMID_RE` (`vmAssignmentController.assignVMs` line 54, `tenantController.setTenantVMs` line 148). The originally-described exploit — a `tenant_admin` persisting a malformed `vm_id` — is therefore **already blocked**, so H1 is **not** an exploitable tenant-admin escalation. It is downgraded to **defence-in-depth + a real `pve_pool` gap** (admin-set, stored with only `.trim()`, interpolated into PromQL unescaped). The fix below hardens all three angles regardless.

| ID | Status | Change |
|----|--------|--------|
| H1 | Fixed | `escapeLabelValue()` applied to every PromQL label value (incl. `pve_pool`); `resolveScope` re-validates stored `vm_id`s and never widens to an empty (all-VMs) scope; `pve_pool` now format-validated on write (`POOL_RE`). |
| M2 | Fixed | New `vm_alerts` table (migration `030`); `alertMonitor` cooldown now DB-backed — survives restarts, shared across instances, recorded only after a successful send. |
| L1 | Fixed | `serviceAuth` uses `crypto.timingSafeEqual` on SHA-256 digests (constant-time, no length leak). |
| L2 | Fixed | `prometheus.httpGet` now has a request timeout (`PROM_TIMEOUT_MS`, default 15s) and a response-size cap (`PROM_MAX_RESPONSE_BYTES`, default 8 MB). |
| L3 | Fixed | Upstream error text / failing PromQL is logged server-side; clients get generic messages. |
| L4 | Fixed | `recordUsage` rejects unknown `service_id` (404). |
| I1 | Fixed | `verify` wired as admin-only `GET /api/monitoring/verify`. |
| M1 | Moved | To infrastructure audit — control-plane endpoint, not monitoring. Covered there with `deploy` + web terminal. |
| I2–I4 | Deferred | Helper dedup, client-side guard, page consolidation. |

**Migration required:** run `node packages/core/src/db/migrate.js` to apply `030_vm_alerts.sql` before deploying (M2 reads/writes `vm_alerts`).

---

## High

### H1 — Stored PromQL injection → tenant isolation bypass
**Where:** `controllers/monitoringController.js` `resolveScope()`, `scopeSelector()`, `avgMetric()`, `getVMs`, `getSummary`; write path in `controllers/vmAssignmentController.js` `setUserVMs`.

VM IDs are read from `user_vm_assignments` / `tenant_vm_assignments` and interpolated straight into PromQL selectors with no escaping:

```js
if (scope.vmIds && scope.vmIds.length) return `id=~"${scope.vmIds.join('|')}"`;
// avgMetric: `avg by (id) (${metric}{id=~"${scope.vmIds.join('|')}"})`
```

The format guard `VMID_RE` (`/^(qemu|lxc)\/\d+$/`) is only applied to the `:vmId` **path param** in `getVM`/`getHistory`. It is **not** applied to the stored IDs that `resolveScope` feeds into `getVMs`/`getSummary`. On the write side, `setUserVMs` explicitly **skips validation for pool-based tenants** ("trust that the tenant admin picked from their own pool"), so a `tenant_admin` can persist a crafted `vm_id` such as:

```
qemu/1"} or pve_cpu_usage_ratio{id=~".*
```

When that user (or the admin via `?userId`) loads monitoring, the crafted value breaks out of the `id=~"…"` selector and the query returns metrics for VMs outside the tenant — names, CPU/memory/disk, uptime. That is a cross-tenant data disclosure and a tenant-isolation break by an authenticated tenant admin.

**Also affected (same class, lower likelihood):** `pve_pool` is interpolated unescaped in `getVM`/`getHistory`/`resolveScope` (`pool="${pvePool}"`). It is admin-set, so the exposure is smaller, but a stray quote in a pool name will silently corrupt scoping.

**Fix:**
- Validate `vm_id` against `VMID_RE` on **write** (`setUserVMs`, `tenant_vm_assignments` inserts), including the pool-based path — never store an ID that isn't `qemu/<n>` or `lxc/<n>`.
- Defensively validate/escape in `resolveScope` and `scopeSelector` before building PromQL (reject or drop non-conforming IDs; escape `"` and `\` in any label value, including `pve_pool`).
- Consider a single `promLabelValue()` escaper used everywhere a value enters a PromQL selector.

---

## Medium

### M1 — Internal remote-command endpoint is broad RCE behind one static secret
**Where:** `routes/internal.js` → `controllers/internalController.js` `runCommand`; `middleware/serviceAuth.js`.

`POST /internal/run-command` runs an arbitrary shell string over SSH on a tenant VM (`ssh.execCommand(command)`), with `command` taken verbatim from the request body. The only protection is a shared static token (`RACHBASE_SERVICE_TOKEN`) compared with `!==`. There is no command allow-list, no structured operation model, no audit log, and no rate limiting. If the token leaks, this is full remote code execution across every VM with SSH config.

**Fix:** Replace free-form `command` with an allow-listed set of structured operations; add an audit log (who/what/when/target); rate-limit `/internal/*`; scope/rotate tokens; keep the secret out of logs.

### M2 — Alert cooldown is in-memory and per-instance
**Where:** `services/alertMonitor.js` (`lastAlerted` Map).

The VM-alert cooldown lives in a process `Map`. Consequences: (a) it **resets on every restart/deploy**, causing alert storms; (b) it is **not shared across instances**, so a multi-instance deployment emails duplicates; (c) it is never evicted, so it **grows unbounded** (slow leak). Note the sibling service-usage alerter (`models/serviceAlert.js`) already persists cooldowns in `service_alerts` — the VM path should do the same.

**Fix:** Persist VM-alert cooldown state (DB table keyed by `vm_id:metric` with `sent_at`), mirroring `ServiceAlert.recentExists`; or at minimum bound and periodically evict the map.

---

## Low

### L1 — Non-constant-time service-token comparison
`middleware/serviceAuth.js` uses `provided !== expected`, a timing side channel on the shared secret. Use `crypto.timingSafeEqual` on equal-length buffers (guard against length leak). Pairs with M1.

### L2 — No timeout or response-size cap on Prometheus/Grafana calls
`services/prometheus.js` `httpGet` sets no socket/request timeout and accumulates the response body into an unbounded string. A hung or oversized Grafana response can hang the Node request or exhaust memory. Add a request timeout with `req.destroy()`/abort, and cap accumulated bytes.

### L3 — Internal error text leaked to clients
`promInstant`/`promRange` throw `body.error` (raw Prometheus/Grafana message) which can surface internal query text and infra details to API callers. Return a generic message to the client; log the detail server-side.

### L4 — `recordUsage` trusts arbitrary `service_id`
`internalController.recordUsage` inserts a sample for whatever `service_id` the caller sends, without checking the service exists. A service-token holder (or a bug in the orchestrator) can inject junk samples and manipulate/suppress alerts. Validate `service_id` against `services` before insert.

---

## Info / code quality

### I1 — Dead/incomplete `verify` endpoint
`monitoringController.verify` and `prometheus.verifyConnection` are exported but no `/verify` route is wired in `routes/monitoring.js` (and the route's access-matrix comment doesn't list it). Either wire it as admin-only or remove it.

### I2 — Duplicated Prometheus helpers with drift
`avgMetric` / `guestInfo` / `byId` are copy-pasted in `monitoringController.js` and `alertMonitor.js` and have already diverged (e.g. `alertMonitor` keeps memory in bytes, the controller converts to GiB). Extract a shared `promQuery` helper module to prevent scope/formula drift.

### I3 — Client-side-only role guard on the admin monitoring page
`app/dashboard/monitoring/page.tsx` redirects non-admins in a `useEffect`, but the admin-only obs-assignment fetches fire before the redirect resolves. The backend enforces authorization, so this is not a security hole — just wasted/failed calls. Gate the fetch on `user?.role === 'admin'`.

### I4 — Two near-duplicate monitoring pages
`monitoring/page.tsx` (admin obs-assignment view) and `vm-monitor/page.tsx` (tenant view) share substantial markup/logic. Consider consolidating shared pieces to reduce maintenance drift.

---

## Suggested priority order

1. **H1** — validate/escape VM IDs and pool labels before they reach PromQL (write-side + defensive read-side).
2. **M1** — lock down `/internal/run-command` (allow-list + audit + rate limit) and **L1** constant-time token compare.
3. **M2** — persist VM-alert cooldown.
4. **L2–L4** — Prometheus client hardening and input validation.
5. **I1–I4** — cleanup and de-duplication.
