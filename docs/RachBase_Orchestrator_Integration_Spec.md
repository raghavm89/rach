# RachBase — Orchestrator Integration Spec

**Purpose.** Define the single seam between the RachBase application and the compute
substrate (k3s) so that Steps 4 (live scaling), 6 (dedicated-VM placement) and 7
(shared→dedicated upsell) can be written against a stable interface *now*, and lit up
the moment a k3s cluster exists. Nothing in the app should call `kubectl`, the k3s API,
or SSH directly — everything goes through the `Orchestrator` interface described here.

This spec covers the interface, the two backends behind it, the status lifecycle, the
data-model touchpoints, and exactly which existing call sites change.

---

## 1. Design principles

1. **One interface, two backends.** A `shared` service runs on the RachBase multi-tenant
   k3s cluster; a `dedicated` service runs on a single-tenant k3s installed on the
   customer's VM. Same interface, different kubeconfig — chosen by `service.compute_target`.
2. **The DB is the source of truth for intent; k3s is the source of truth for reality.**
   The app writes desired state (units, image, status) and asks the orchestrator to
   converge the cluster to it. A reconciler closes the loop back into the DB.
3. **Idempotent + declarative.** Every method may be retried. `apply(desired)` converges;
   it does not imperatively "add one." This survives crashes, double-clicks, and webhook
   redelivery.
4. **No downtime by construction.** Scaling and migration are rolling updates / blue-green,
   never stop-then-start.
5. **The app never holds cluster credentials in a request path.** Kubeconfigs live with the
   orchestrator worker, keyed by cluster id.

---

## 2. The `Orchestrator` interface

Location: `packages/deploy/src/orchestrator/` exported from `@rach/deploy` as
`orchestrator`. All methods are async, idempotent, and take/return plain objects.

```
orchestrator.provision(spec)            → { workload_ref, status }
orchestrator.apply(spec)                → { workload_ref, status }   // converge to desired
orchestrator.scale(workloadRef, units)  → { status }                // sugar over apply()
orchestrator.deploy(workloadRef, build) → { deployment_ref, status }// new image, rolling
orchestrator.status(workloadRef)        → { phase, ready_units, endpoints, message }
orchestrator.metrics(workloadRef)       → { cpu_pct, mem_pct, disk_pct }
orchestrator.migrate(spec, fromRef,toRef)→{ status }                // blue-green across clusters
orchestrator.teardown(workloadRef)      → { status }
```

### 2.1 `ServiceSpec` (the desired state the app passes down)

```jsonc
{
  "service_id":     123,
  "tenant_id":      7,
  "name":           "acme-api",
  "compute_target": "shared",           // "shared" | "dedicated"
  "cluster_id":     "rb-shared-1",       // which k3s (dedicated → the VM's cluster)
  "units":          2,                    // desired unit count → resource requests/limits
  "unit":           { "cpu": 0.5, "memory_mb": 512, "disk_gb": 0.5 },
  "source": {
    "type":   "github_repo",             // "github_repo" | "postgres"
    "repo":   "acme/api",
    "branch": "main",
    "image":  null                        // set once built
  },
  "env":            { "NODE_ENV": "production" },
  "ports":          [8080],
  "domains":        ["acme-api.rachbase.app"]
}
```

Resource math is fixed and lives in one place: for `units = N`,
`cpu = N × 0.5`, `memory = N × 512Mi`, `ephemeral-storage = N × 0.5Gi`. A k3s Deployment
carries these as **requests == limits** (guaranteed QoS); the PVC carries disk.

### 2.2 `workload_ref`

An opaque, stable handle the app stores on the service row (`service.workload_ref`), e.g.
`"rb-shared-1/ns-tenant-7/svc-123"`. The app treats it as a string; only the orchestrator
parses it.

### 2.3 Method contracts

- **`provision(spec)`** — first-time creation. Creates the namespace (per tenant),
  Deployment, Service, PVC, Ingress, and TLS (cert-manager). Returns `workload_ref`.
  Idempotent: if it already exists, behaves like `apply`.
- **`apply(spec)`** — converge existing workload to `spec`. This is the workhorse: changing
  `units`, `env`, `domains`, or `image` all route through here as a rolling update.
- **`scale(ref, units)`** — thin wrapper: load spec, set `units`, `apply`. Exists so Step 4
  reads cleanly.
- **`deploy(ref, build)`** — set the container image to a freshly built tag and roll it out.
  `build = { image, commit_sha }`. Build itself (GitHub → image) is out of scope here and
  handled by the existing build path; the orchestrator only rolls the new image.
- **`status(ref)`** — cheap read of Deployment/Pod phase. `phase ∈ {provisioning, running,
  degraded, updating, stopped, error}`; `ready_units` = ready replicas; `endpoints` = public
  URLs once Ingress + TLS are live.
- **`metrics(ref)`** — instantaneous CPU/RAM/disk **percent of the service's own allocation**
  (units × unit-size). This is the feed for Step 5 — see §5.
- **`migrate(spec, fromRef, toRef)`** — stand up the workload on `toRef` (new cluster), wait
  healthy, cut the domain over, then tear down `fromRef`. Blue-green; see §4.3.
- **`teardown(ref)`** — delete the workload; keep the PVC only if `spec` says so.

### 2.4 Errors

Methods throw typed errors the controllers can map to HTTP:
`CapacityError` (dedicated VM full → 409), `NotFoundError` (404), `ClusterUnavailableError`
(503, retryable), `ValidationError` (400). Everything else → 500 + logged, workload left
untouched (declarative apply is safe to retry).

---

## 3. Backends

### 3.1 `SharedK3sBackend` (compute_target = "shared")

- One multi-tenant k3s cluster (`rb-shared-1`, …). Tenants isolated by **namespace**
  (`ns-tenant-<id>`) + NetworkPolicy + ResourceQuota.
- Placement = the scheduler's problem; the app just sets requests/limits.
- Quota is enforced in the **app** against the tenant's plan (already live: active-unit
  count in `serviceUnitController` / `unitQuotaFor`). The cluster's ResourceQuota is a
  backstop, not the primary gate.

### 3.2 `DedicatedK3sBackend` (compute_target = "dedicated")

- A single-node (or small) k3s installed on the customer's VM; the app holds its kubeconfig
  keyed by `cluster_id` (1:1 with `vm_id`).
- **Capacity is physical**: `capacity_units = floor(min(vm.cpu/0.5, vm.ram_gb/0.5,
  vm.disk_gb/0.5))`. The app must check `Σ active units on this VM + requested ≤ capacity_units`
  before `apply`; over-capacity → `CapacityError` (409). This is the Step 6 gate.
- Installing k3s on the VM (the one hard infra dependency) is done by a **provisioner** that
  reuses the existing SSH path (`@rach/deploy` `getSshPrivateKey`, `vm_ssh_config`): SSH in,
  run the k3s install, pull back the kubeconfig, store it. This is the only place SSH remains.

Both backends implement the identical interface, so controllers never branch on target beyond
selecting `cluster_id` and running the capacity check.

---

## 4. How Steps 4/6/7 consume it

### 4.1 Step 4 — live scaling (already wired at the app layer)

`verifyUnit` today does `Service.applyActivatedUnit` (DB units += 1). Add one call:

```
const updated = await Service.applyActivatedUnit(service.id);
await orchestrator.scale(updated.workload_ref, updated.units);   // rolling, no downtime
```

Removing a unit (down-scale **only at renewal**, per locked decision) is the same call with a
lower `units` at the cycle boundary — no separate path.

### 4.2 Step 6 — dedicated VM placement

`createService` with `compute_target = "dedicated"` + a `vm_id`:
1. App resolves `cluster_id` from `vm_id`; if the VM has no k3s yet, the provisioner installs it.
2. On the first paid unit, `verifyUnit` runs the **capacity check** (§3.2) then
   `orchestrator.provision(spec)` against the VM's cluster instead of the shared one.
3. Everything else (scale, deploy, metrics, alerts) is identical — the interface hides it.

### 4.3 Step 7 — shared → dedicated upsell, no downtime

A single call, driven from a "Move to dedicated VM" action:

```
await orchestrator.migrate(spec, service.workload_ref, targetVmRef);
// provision on VM → wait healthy → switch domain → teardown shared workload
await Service.update(service.id, { compute_target: 'dedicated', vm_id, workload_ref: targetRef });
```

Blue-green means the public domain only flips after the dedicated copy is serving; the shared
copy is torn down last. If any step fails before cutover, the shared workload is untouched.

---

## 5. Step 5 wiring (already built) meets real metrics

Step 5's evaluator reads usage from `service_usage_samples` and is deliberately decoupled from
the source (`ServiceUsage.samplesSince`). Two ways to feed it real data — pick one at k3s time:

- **Push (simplest):** a small agent / CronJob calls `orchestrator.metrics(ref)` per service
  each minute and POSTs to `/internal/usage`. No app change — the endpoint already exists.
- **Pull (Prometheus):** implement a `PrometheusUsageSource.samplesSince` that runs
  `min_over_time(...[10m]) ≥ 0.9`-style queries and swap it in `services/alerting.js`. The
  evaluator, cooldown, and email are unchanged.

Either way, "percent" means **percent of the service's own unit allocation**, so 90% has a
consistent meaning regardless of units or placement.

---

## 6. Data-model touchpoints

Add to `services` (migration `027_service_workload.sql`, when this lands):

```sql
ALTER TABLE services ADD COLUMN IF NOT EXISTS cluster_id    TEXT;     -- which k3s
ALTER TABLE services ADD COLUMN IF NOT EXISTS workload_ref  TEXT;     -- opaque handle
ALTER TABLE services ADD COLUMN IF NOT EXISTS last_reconciled_at TIMESTAMPTZ;
```

New table for the reconciler's view of cluster reality (optional but recommended):

```sql
CREATE TABLE clusters (
  id          TEXT PRIMARY KEY,          -- 'rb-shared-1' | 'vm-<vmid>'
  kind        TEXT NOT NULL,             -- 'shared' | 'dedicated'
  vm_id       TEXT,                       -- set for dedicated
  capacity_units INTEGER,                 -- dedicated only
  status      TEXT DEFAULT 'unknown',    -- ready | unreachable | draining
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

Statuses already used by the app (`draft → pending_payment → online`, `deploying`) extend
cleanly with orchestrator phases: `provisioning`, `scaling`, `degraded`, `stopped`. The
mapping from `orchestrator.status().phase` → `service.status` lives in the reconciler.

---

## 7. The reconciler

A background loop (host cron or in-cluster controller) that, per service with a
`workload_ref`, calls `orchestrator.status(ref)` and writes back `service.status` +
`ready_units` + `last_reconciled_at`. This is what turns `pending_payment → online` for real
(replacing the current direct flip in `verifyUnit`) and catches drift (a crashed pod →
`degraded`). Runs every ~30–60s; reuses the `evaluate-alerts` cron host.

---

## 8. Build order when k3s arrives

1. Stand up `rb-shared-1`; store its kubeconfig; seed `clusters`.
2. Implement `SharedK3sBackend` + the `provision/apply/status/metrics` methods; add
   migration `027`.
3. Insert `orchestrator.provision` into `verifyUnit` (first unit) and the reconciler flip —
   now services go online for real.
4. Insert `orchestrator.scale` into `verifyUnit` (extra units) — Step 4 live.
5. Point Step 5's usage feed at `orchestrator.metrics` (push agent) — real alerts.
6. Implement the dedicated provisioner (SSH k3s install) + `DedicatedK3sBackend` + capacity
   check — Step 6.
7. Implement `migrate` — Step 7.

Steps 1–5 here need only the shared cluster; 6–7 need the dedicated path. The app code above
(`verifyUnit`, alerting, controllers) changes by a handful of lines each because every cluster
interaction is behind `orchestrator`.

---

## 9. Testability before k3s exists

Ship an `InMemoryBackend` implementing the interface (a Map of workloads, fake phases,
scriptable metrics). It lets Steps 4/6/7 controller logic — capacity checks, status
transitions, migration ordering, the `verifyUnit` scale call — be unit-tested with pg-mem
exactly like Steps 2/3/5 were, with zero cluster. Wire the real backend by swapping one
factory (`getOrchestrator(compute_target)`), selected by env.
