# RachBase Services — Step-by-Step Build Plan

**Date:** 2026-07-13
**Scope:** Turn RachBase into a Service platform (Railway-style), selling **Services** and
**VMs** — no "container" wording. Covers the unit model, pay-to-online, live scaling, the
90% alert, dedicated-VM placement, and the upsell. Built on one k3s deploy pipeline.

---

## Core model (the atom everything is built from)

- **Service Unit** = **0.5 vCPU · 0.5 GB RAM · 0.5 GB storage.** The sellable + scalable atom.
- **Service** = an app that runs on **1..N units**. Source = **GitHub repo** or **Postgres**
  (for now). `resources = units × (0.5 vCPU / 0.5 GB / 0.5 GB)`.
- **Scale = add a unit** (pay → attached live, no downtime via k3s rolling update).
- **Placement (compute target):** `shared` (RachBase cluster, pay-as-service) or
  `dedicated` (customer's VM, pay-for-the-VM). Same deploy pipeline, different cluster.
- **Words we sell:** **Service** and **VM**. The word **"container" is removed everywhere.**

Open decision: **price of one Service Unit** (0.5/0.5/0.5). Everything else below is defined.

---

## Step 1 — Terminology & pricing cleanup  *(frontend only, no infra)*

Covers point **1** and part of **2**.

- Remove "Container/Containers" from **pricing**, **BaaS product page**, **FAQ**, **dashboard
  nav + page**, and the **hero**. Replace with **Service**.
- Pricing shows two things to buy: **Service Unit** (0.5/0.5/0.5, $X/mo) and **VM** ($/mo).
- Dashboard: rename the **Containers** page/nav → **Services** (or fold into Projects).
- Keep **VM Deployment** (dedicated) and **Projects/Services** (shared) as the two paths.

**Deliverable:** consistent "Service/VM" language sitewide; the Service Unit is the priced item.

---

## Step 2 — Data model: units, payment, placement  *(backend)*  — ✅ DONE

**Status:** shipped in migration `025_service_units.sql` + `models/project.js`. The
`services` table gained `units`, `compute_target`, `vm_id` and per-unit sizing
(0.5 vCPU / 512 MB / 0.5 GB); the `service_units` ledger holds one row per purchased
unit (pending → active), each a $15 line item with its Razorpay order/payment ids.
Quota now counts **active units** across the tenant. (`service_events` audit table
deferred — not needed until Step 5's alerting.)

Covers points **2, 3, 5**.

Extend `services` (from migration 024) + add supporting tables:
- `services`: `units INT DEFAULT 1`, `unit_cpu 0.5 / unit_ram_gb 0.5 / unit_disk_gb 0.5`
  (constants), `source_type` (`github_repo` | `postgres`), `status`
  (`draft | pending_payment | provisioning | online | scaling | stopped | crashed`),
  `compute_target` (`shared` | `dedicated`), `vm_id` (nullable).
- `service_units` (or a `units` ledger) — one row per purchased unit, each a **billing line
  item** tied to the tenant's subscription (Razorpay). Enables per-unit add/remove + invoicing.
- `service_events` — audit (created, paid, deployed, scaled, alerted, migrated).

Quota/capacity logic branches on `compute_target`:
- **shared:** units count against the tenant's plan allotment.
- **dedicated:** units count against **VM capacity** = `floor(min(vm.cpu/0.5, vm.ram/0.5, vm.disk/0.5))`.

**Deliverable:** migration + models; a service knows its units, source, status, placement.

---

## Step 3 — Pay-to-online flow  *(backend + frontend)*  — ✅ DONE (provisioning stubbed)

Covers point **3**.

1. Create service → status `draft`, **0 units** (free). ✅
2. **Checkout** for the first unit — `POST /units/checkout` creates a Razorpay order
   ($15) + a pending ledger row → status `pending_payment`. ✅ (reuses `@rach/billing`)
3. **Verify** — `POST /units/verify` checks the HMAC signature, activates the unit,
   `+1 unit`, and a draft/pending service flips to `online`. ✅
4. A service **cannot go online without a paid unit** — enforced server-side. ✅
5. Frontend: a "not online yet" banner + live Razorpay checkout on the service page;
   the Scale tab's **Add power** button runs the same flow. ✅

**Not yet (waits on the orchestrator):** between `pending_payment` and `online` there is
currently **no real k3s provisioning** — verify flips the status directly. When k3s lands
(Step 4/6 infra), insert `provisioning` + the actual rollout there.

Verified end-to-end with pg-mem: create → checkout → verify → online, bad-signature
rejected (400), double-verify blocked, add-power → 2 units, unit quota → 402, cross-tenant → 404.

**Deliverable:** "Create → Pay → Online" works end to end; unpaid services stay `draft`.

---

## Step 4 — Live scaling (add a unit)  *(backend + frontend)*

Covers points **4 (action) and 7**.

- **"Add power"** button on the service → buy 1 unit (Razorpay) → on success, `units += 1`
  → **k3s rolling update** raises the pod's resources / adds a replica → **no downtime**.
- Same flow to **remove** a unit (down-scale) at next cycle.
- UI shows a **usage bar** (current util vs allocated) and current units.

**Deliverable:** scale up/down by units, live, from the service view.

---

## Step 5 — 90% usage alert → email Tenant Admin  *(backend)*  — ✅ DONE

Covers point **4 (trigger)**.

- Migration `026_service_alerts.sql`: `service_usage_samples` (utilization the orchestrator
  posts) + `service_alerts` (fired-alert ledger for cooldown dedup + audit). ✅
- `services/alerting.js`: a resource is a **sustained breach** when its *minimum* across the
  full window stays **≥ 90%** (never dropped) AND we have ~full-window coverage. Defaults:
  threshold **90%**, window **10 min**, cooldown **6 h** — all env-tunable. ✅
- **Brevo email** to the **Tenant Admin** (reuses `brevo.sendAlertEmail`) naming the breaching
  resource(s) + peaks, with an **Add a unit** CTA linking to the Scale flow (Step 4). Only
  `tenant_admin`/`admin` recipients; falls back to any tenant user if none. ✅
- **Human-approved, not auto-scale** — we notify; they choose to add. ✅
- Entry points: `POST /internal/usage` (sample ingest) + `POST /internal/alerts/evaluate`
  (both service-token gated), plus `npm run evaluate-alerts` for a host cron (`* * * * *`). ✅

**Metrics source:** currently the samples table (orchestrator pushes). A Prometheus adapter
can replace `ServiceUsage.samplesSince` later without touching the evaluator.

Verified with pg-mem: healthy → no email; high-but-brief (3 min) → not sustained; sustained
CPU ≥90% → one email to `tenant_admin` only; re-eval within cooldown → deduped; memory breach
detected; `evaluateAllOnline` sweeps online services.

**Deliverable:** at 90%, the tenant admin gets an actionable email; no surprise autoscale.

---

## Step 6 — Dedicated VM placement  *(backend + frontend)*

Covers points **5, 6, 7**.

- A tenant buys a **VM** (existing VM/expansion purchase flow).
- Install **k3s** on the VM (single-node). Same deploy pipeline, different kubeconfig.
- When creating a project/service, choose **compute target = this VM**. Services deploy there.
- **Capacity shown**: "This VM fits N services" = `floor(min(cpu/0.5, ram/0.5, disk/0.5))`;
  block creating beyond capacity (with an upsell to a bigger VM).

**Deliverable:** deploy services onto a customer-owned VM; capacity enforced + visible.

---

## Step 7 — Upsell: shared → dedicated, no downtime  *(backend + frontend)*

Covers points **6, 7**.

- Prompt: "Move to a dedicated VM for isolation & more headroom."
- On purchase: **blue-green migration** — deploy the service onto the new VM's k3s, health-check,
  switch traffic (ingress/DNS), drain the shared instance. **Service never goes offline.**

**Deliverable:** one-click "upgrade to dedicated VM" that migrates live.

---

## Step 8 — UI/UX so both personas are simple  *(frontend)*

Covers point **7**.

- **Has services (shared):** Projects → Service view → usage bar + **Add power** (scale) +
  Deploy/Network/Scale/Monitor/Evolve tabs. Scaling never implies downtime.
- **Has a dedicated VM:** a **VM view** showing the VM, its capacity meter, and the services
  running on it; "Add service" until capacity, then upsell a bigger VM.
- Consistent create flow (source = GitHub repo | Postgres) regardless of placement.

---

## The one hard dependency (unchanged)

All of Steps 3–7's "actually running/scaling/migrating" require the **k3s orchestrator** on
the VM pool. Steps 1–2 (words, data model) and the *UI shells* are buildable now; the live
behaviors light up once k3s + the deploy pipeline exist. Recommended order:
**1 → 2 → 3 (shared) → 4 → 5 → 6 (dedicated) → 7 → polish 8**, with k3s stood up before Step 3's "online."

## Decisions (locked)
1. **Service Unit price:** **$15 / month** (0.5 vCPU / 0.5 GB / 0.5 GB).
2. **Launch sources:** **GitHub repo + Postgres** only.
3. **90% alert window:** **sustained 10 minutes** before the email fires.
4. **Down-scaling:** removing a unit takes effect **only at renewal** (no mid-cycle removal).
