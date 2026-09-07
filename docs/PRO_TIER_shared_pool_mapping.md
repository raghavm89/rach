# Pro Tier (shared-pool, scale-to-zero) — Brief → Codebase Mapping

**Status:** Plan only. No code written. Produced per the "explore first, map onto the
codebase, flag conflicts" working style before implementing anything.

---

## 0. Decision log — updated 2026-08-09

Verified the claims below against current code (`postgresProvision.js` header states
"NATIVE (apt + systemd), no Docker"; no k8s/dockerode deps; `catalog.json` USD/flat/no
`pro` tier; credits ledger present). Decisions locked with Raghav:

| # | Decision | Choice | Status |
|---|---|---|---|
| 1 | Phase 1 substrate | **Path A** — existing VM/systemd/credits rails; defer k8s/Knative to a Phase 2 decision made against real Pro adoption | ✅ confirmed |
| 2 | Pro Postgres | **(b)** database-per-tenant + RLS on a shared managed-PG VM (already the native pattern in `postgresProvision.js`) | ✅ confirmed |
| 3 | Billing | Subscription base (`$29/mo` Razorpay) + metered overage on the **credits ledger**, not Razorpay native metering. Egress accounting is approximate until a metering point exists (Phase 2) | ✅ confirmed |
| 4 | Pro billing currency | **Region-based:** GeoIP = default suggestion at signup; **billing address is authoritative** (India/GST → INR, else → USD). Currency locked at subscription creation, never changed mid-subscription | ✅ confirmed — see §8 for implications |

Two items surfaced on 2026-08-09 (see §7):
- **`plan` name reuse** — Raghav's call: keep the tenant-tier column named `plan`
  (`pro`|`max`), distinct from the existing Razorpay `plans` table. No SQL conflict;
  documented so the two aren't confused.
- **No feature-flag system exists** in `rachbase-backend` — introducing one is itself a Phase 1 build item.

All four decisions are set. **No product code until Raghav gives an explicit go**, and
the §8 currency sub-items (Razorpay USD acceptance, dual-currency catalog price) are
confirmed as buildable.

---

## 1. What the codebase actually is today

- **Provisioning substrate = Proxmox qemu VMs, orchestrated over SSH.** The control
  plane (`rachbase-backend`) never runs workloads; it writes files and runs commands
  over per-VM SSH keys (`vm_keys`), exactly as `@rach/deploy runDeploy` does.
- **Apps run as systemd units behind Caddy**, not containers. See
  `docs/paas-on-vm-design-2026-07-26.md`: one `rb-svc-<id>.service` per service,
  Caddy for TLS + hostname routing, auto domains via GoDaddy. **No Docker, no OCI
  images in the running product.**
- **No Kubernetes anywhere.** Zero k8s/docker client deps in any `package.json`
  (`@kubernetes/*`, `dockerode`, kubeconfig — none). No manifests, no Helm, no
  namespaces/quotas/NetworkPolicies in the repo.
- **Postgres is native**, installed via apt/PGDG over SSH on a VM (managed DB =
  placed on its own VM). Backup/PITR = WAL archival + daily backups. **No Postgres-in-
  a-pod / PVC tooling exists.**
- **Billing = Razorpay subscriptions bolted onto `vm_expansion_requests`**
  (`012_subscriptions.sql`: `razorpay_subscription_id`, `subscription_status`,
  `next_charge_at`). Pricing authority is `packages/billing/catalog.json` (flat list,
  integer cents, USD).
- **A usage/metering ledger already exists** — `tenant_credits` + `credit_transactions`
  (`022_agent_credits.sql`) with a **reserve → settle** pattern (`credits.js`) used
  today to meter LLM calls. This is a ready-made overage rail.
- **No `plan`/`tier` concept** exists in the data model yet. `tenants` is minimal
  (id, name); users carry `tenant_id`.
- The team's **own prior design docs already chose the non-k8s path**:
  `RachBase_Container_Service_Plan.md` recommends **Docker-on-VM for launch** and
  explicitly calls managed Kubernetes *"significant new infra + ops burden; overkill
  for launch,"* reserved as a later premium SKU.

---

## 2. The core conflict (must decide before coding)

**The brief's Phase 1/2 assume a Kubernetes/Knative substrate that does not exist in
this repo and that the team previously, deliberately deferred.** Specifically these
brief items have *no foundation to build on today*:

| Brief item | Reality in repo | Gap |
|---|---|---|
| "One k8s namespace per Pro project, ResourceQuotas/LimitRanges" | SSH-to-VM, systemd, no k8s | Entire orchestration layer missing |
| "NetworkPolicies for tenant isolation" | Isolation = VM + firewall boundary; no CNI | Needs Cilium/Calico → needs k8s |
| "Install Knative Serving on k3s for scale-to-zero" | No k3s cluster in the product control plane | New production system to stand up + operate |
| "Egress bytes via ingress controller / Cilium-Hubble" | Routing is per-VM Caddy, no central ingress | No per-tenant egress accounting point |
| "Per-tenant Postgres pods with PVCs" | Native Postgres over SSH; no pod/PVC tooling | Backup/PITR tooling doesn't cover pods |
| "gVisor RuntimeClass / Firecracker (Phase 3)" | n/a | Only meaningful on a k8s substrate |

This isn't a reason to abandon the goal — the **business rules are all achievable**
(no free tier; Pro ~$29 + usage on shared infra; Max untouched; Phase-1 managed
services only; don't block Phase 3). It's the *specific k8s mechanics* that are
premature.

### Key insight that resolves most of it

**Phase 1 does not need Knative or k8s at all.** Phase 1 is *managed services*
(Postgres, auth, auto-APIs, storage, realtime) — these are **always-on**, not
scale-to-zero workloads. The brief itself says Postgres does **not** scale to zero
(idle-pause instead). Scale-to-zero only matters once Pro runs **customer service
workloads**, and the brief scopes arbitrary user code to **Phase 3**. So the k8s/Knative
bet can be **deferred to Phase 2** and decided against real Pro adoption — Phase 1
ships entirely on the existing VM substrate.

---

## 3. Two coherent paths

**Path A — Reuse the rails (recommended for Phase 1).**
Add the `plan` model + shared-pool multi-tenancy + Pro Postgres + metered billing on
the *existing* SSH/VM/systemd/credits substrate. No k8s. Ships in weeks, zero new
ops surface, Max path literally untouched. Scale-to-zero (Phase 2) is later
approximated with idle-stop + wake-on-request, or becomes the trigger to adopt Knative.

**Path B — Build the k8s substrate now (the brief as literally written).**
Stand up k3s + Knative + CNI + ingress + storage classes + monitoring integration as
a new production system. Gives true sub-second scale-to-zero and clean quotas/
NetworkPolicies, and sets up Phase 3 gVisor naturally — but it's a genuinely new
platform to operate, contradicts the prior "overkill for launch" call, and delays a
sellable Pro tier.

**Recommendation:** Path A for Phase 1; make Knative-vs-idle-stop an explicit Phase 2
decision informed by how many Pro tenants actually land and how spiky they are. This
honors every non-negotiable while not committing to a new cluster on speculation.

---

## 4. Phase 1 mapping onto real files (Path A)

- **Plan model** — new migration `0XX_tenant_plan.sql`: `ALTER TABLE tenants ADD COLUMN
  plan TEXT NOT NULL DEFAULT 'max'` (existing tenants → `max`, satisfying the brief's
  "existing customers map to max"). Optionally mirror `plan` onto the
  expansion_request/order for per-subscription clarity. Reversible.
  **Naming note (Raghav's call, 2026-08-09):** we keep the column name `plan`. It is a
  *tenant tier* (`pro`|`max`) and is distinct from the existing `plans` table / `Plan`
  model, which are **Razorpay subscription plans**. No SQL conflict (`tenants.plan`
  column vs `plans` table are unrelated objects) — keep the two straight in code:
  `tenants.plan` = tier, `plans` = Razorpay billing plan.
- **Shared-pool placement** — Pro tenants are placed onto a shared "Pro pool" VM (or
  small set), reusing `pve_pool` / `tenant_vm_assignments` semantics with a pool
  flagged `shared`. A "namespace" in brief terms becomes a **tenant workspace on a
  shared VM** (systemd unit group + Caddy vhost + OS user/cgroup limits), not a k8s ns.
- **Quotas** — the brief's `request 0.25 vCPU/512MB, limit 0.5 vCPU/1GB` map to
  **cgroup limits on the systemd unit** (`CPUQuota=`, `MemoryMax=`) — config-driven,
  same numbers. This is the honest Path-A equivalent of a LimitRange.
- **Pro managed services** reuse existing controllers (auth/identity, auto-APIs,
  storage, realtime) scoped by `tenant_id` + `plan`.
- **Isolation** — per-tenant OS user + cgroup + firewall on the shared VM; Pro tenants
  cannot reach the Max VM network (separate pools/subnets). Weaker than NetworkPolicies;
  documented honestly as "shared infrastructure" per business rule 3.
- **Feature-flag everything** — confirm/introduce a flag gate so nothing is
  user-visible until flipped (brief requirement; flag mechanism to confirm in repo).

## 5. Pro Postgres decision (evaluated against real tooling)

- **(a) per-tenant Postgres pods + PVCs** — *not available on Path A* (no pod/PVC
  tooling; backup/PITR is VM-based). Only viable on Path B.
- **(b) shared Postgres cluster, database-per-tenant + RLS + PgBouncer** — **maps
  cleanly onto what exists**: native Postgres + PgBouncer already run; a Pro DB becomes
  a `CREATE DATABASE`/role on a shared managed-PG VM, pooled via PgBouncer, isolated by
  RLS. WAL archival + daily backups already cover the whole instance.
- **Recommendation: (b) on a shared managed-Postgres VM for Phase 1.** Idle-pause =
  stop accepting new connections / smaller shared instance, per brief (default off).
  Note the tradeoff: DB-per-tenant on a shared instance is weaker isolation than
  per-tenant pods — acceptable under the honest "shared infrastructure" label, and the
  upgrade to Max = a dedicated managed-Postgres VM (already a product).

## 6. Subscription → usage billing (the question you raised)

Keep subscription as the base; **add usage as a thin metered layer on the ledger you
already have** — do not replace the model.

- **Base:** Pro `$29/mo` via the existing Razorpay subscription flow (same rails as
  `vm_expansion_requests` subscriptions). Predictable, on-brand.
- **Overage:** meter compute GB-hours / egress into `credit_transactions` as
  `type='usage'` using the existing **reserve → settle** pattern (`credits.js`). The
  credits ledger becomes the "usage wallet"; a Pro subscription grants an included
  monthly baseline, overage draws down / bills as usage.
- **Note / flag:** Razorpay's *native* metered billing is limited; the **credits ledger
  is the better-fitting mechanism and already exists** — recommend metering there and
  charging overage as a periodic top-up/add-on rather than relying on Razorpay usage
  records. Egress metering has **no accounting point today** (per-VM Caddy, no central
  ingress) — Phase 2 must add a counting proxy or accept approximate accounting.
- **Usage dashboard:** new page reading `credit_transactions` + per-tenant Prometheus
  (baseline vs consumed vs projected). Reuses existing monitoring.

## 7. Other conflicts / flags

- **`plan` name reuse (2026-08-09):** a `plans` table + `Plan` model already exist, but
  they are **Razorpay subscription plans** (`planController.js` creates them in Razorpay).
  The brief's `plan (pro|max)` is a different concept (a tenant tier). **Decision
  (Raghav): keep the name `plan`** — `tenants.plan TEXT NOT NULL DEFAULT 'max'`. There's
  no SQL collision (a column on `tenants` vs the `plans` table are unrelated). The only
  cost is readability, mitigated by a consistent convention: **`tenants.plan` = tier,
  `plans`/`Plan` = Razorpay billing plan.** Leave the existing billing objects untouched.
- **No feature-flag system exists (new, 2026-08-09):** the brief requires "ship Phase 1
  behind feature flags, nothing user-visible until flipped," but `rachbase-backend` has
  **no flag mechanism today** (only `rachdev` has an unrelated `isEnabled` for agents).
  So "feature-flag everything" is itself a Phase 1 build item — either an env-gated flag
  + `tier` check, or a small `feature_flags` table for runtime toggling. Do not assume a
  flag system exists.
- **Currency:** resolved — region-based (see §0 #4 and §8 for the mechanics + the three
  implementation implications).
- **Two databases:** `plan` lives in `rach_base_db`; migrations run per-DB
  (`DATABASE_TOPOLOGY.md`). Max customers unaffected.
- **"Knative footprint too heavy?"** — moot for Phase 1 (not needed). Real question in
  Phase 2: Knative vs systemd socket-activation/idle-stop for scale-to-zero.
- **Phase 3 (gVisor/Firecracker):** design-doc only, and only coherent on Path B. If
  Phase 1 stays Path A, the Phase 3 doc should present the k8s substrate as a
  prerequisite it introduces — not assume it already exists.

## 8. Region-based currency — implications (2026-08-09)

Decision: currency is chosen by region — GeoIP gives the signup default, the **billing
address is authoritative**, India (with GST) → **INR**, everywhere else → **USD**;
currency is **locked at subscription creation** and never changed mid-cycle. Scope is
**two currencies (INR + USD), not per-country** — the honest reading of "per region" for
an India-based LLP selling globally. Three things this requires:

1. **Dual-currency catalog price, not live FX.** `catalog.json` is single-currency USD
   integer cents. Pro needs an explicit INR price too (e.g. `$29` + a round `₹` figure),
   not an FX-converted amount — customers expect a stable local price. Add a
   `price_cents` per currency for the Pro entry, keep everything else as-is.
2. **Razorpay must accept USD.** The account defaults to INR; USD acceptance is
   Razorpay's international-payments feature and must be enabled/verified on the account.
   Until it is, USD Pro cannot actually charge — an operational dependency, not code.
   *(Flag for Raghav to confirm the Razorpay account has international/USD enabled.)*
3. **Tax path already forks on region.** The existing `indiaGst` / `tax_registrations`
   engine applies GST to India customers. INR/India Pro must run through it (SAC code,
   GST invoice — already built); USD/international Pro should not. Reuse the existing tax
   engine keyed on billing address; no new tax logic, just wire Pro into it.

GeoIP itself is a lightweight lookup at signup for the *default* selection only — never
the source of truth for what's charged. The billing address the customer confirms (and,
for India, their GST registration) decides the currency and tax treatment.

## 9. Decisions — status

See the §0 decision log. As of 2026-08-09: #1 Path A, #2 Postgres (b), and #3
subscription + credits-ledger overage are **confirmed**; #4 Pro billing currency is the
**one open item blocking code**.

Once #4 is set and Raghav gives an explicit go, Phase 1 is: `tenants.plan` migration
(default `max`) → introduce a feature-flag gate → shared-pool placement + cgroup quotas
(`CPUQuota=`/`MemoryMax=` matching the brief's 0.25/512 request, 0.5/1G limit) → Pro
managed services scoped by `plan` → metered overage on the credits ledger → Pro pricing
card + plan selection in signup — all behind the flag, Max path untouched, migrations
reversible, with tests for provisioning + quota enforcement.
