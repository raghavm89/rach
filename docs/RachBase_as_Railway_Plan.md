# RachBase → a Railway-style Platform — Plan

**Date:** 2026-07-13
**Goal:** Make RachBase work like [Railway](https://railway.com) — connect a repo, and the
platform deploys, networks, scales, monitors, and evolves the app for you, billed by usage.

---

## 1. What Railway actually is (grounded from railway.com)

**Model:** an all-in-one cloud PaaS. You connect a GitHub repo (or Docker image); Railway
auto-detects config, builds, and runs it as a **container**, with networking, scaling,
monitoring, and rollbacks handled for you. It positions itself as the alternative to
Docker + Helm + Kubernetes/ECS/Nomad + Nginx/Envoy + Datadog + Terraform — i.e. it hides
orchestration behind a simple product.

**Primitives (the mental model):**
- **Workspace/Team** → **Project** → **Service** → **Deployment**, across **Environments**.
- A **Service** = one containerized app (from a repo/image), with variables, a domain,
  volumes, replicas, healthchecks.
- **Environments** = parallel copies of a project (prod, staging, and a preview per PR).
- Plus **Volumes** (persistent disk), **Buckets** (object storage), **Databases**
  (one-click open-source DBs), **Cron jobs**.

**The five pillars (Railway's own homepage tabs — the ones you named):**
1. **Deploy** — connect repo, auto-config, build, instant deploys, Docker/Dockerfile support.
2. **Network** — private networking (100 Gbps internal, no VPC config), public endpoints,
   automatic SSL, load balancing, protocol detection (HTTP/TCP/gRPC/WS), custom domains.
3. **Scale** — vertical (CPU/RAM) + horizontal (replicas + load balancing), multi-region.
4. **Monitor** — build/deploy logs, CPU/RAM/disk/network metrics, log query/filter,
   configurable alerts (Slack/Discord/email), one dashboard.
5. **Evolve** — unlimited environments, a **PR preview** per pull request, **one-click
   rollbacks**, config-as-code (TOML/JSON), a real-time **visual project canvas**.

**Billing:** pure **usage-based, per-second** — CPU $/vCPU-sec, RAM $/GB-sec, volumes
$/GB-sec, egress $/GB, object storage $/GB-month. Plans (Free / Hobby $5 / Pro $20 /
Enterprise) are really **minimum monthly spend + included credits**, not fixed tiers. Two
things developers repeatedly praise: **hard/soft spend limits** and PR preview environments.

---

## 2. Where RachBase stands today vs Railway

| Railway capability | RachBase today | Gap |
|---|---|---|
| Deploy from GitHub | ✅ GitHub App + `deployRunner` (git→VM over SSH) | Deploys to a VM, not a managed container service |
| Container compute | ⚠️ Container tier exists on pricing + dashboard (mockup) | No real container runtime/provisioning |
| Orchestration (scale/replicas) | ❌ Proxmox VMs, manual | Need an orchestrator (K8s/Nomad) |
| Networking (SSL, domains, private net, LB) | ❌ raw VM IPs | Big gap |
| Monitoring (logs/metrics/alerts) | ⚠️ Prometheus + monitoring/vm-monitor dashboards, `alertMonitor` | Metrics yes; **log streaming/query** + alert routing missing |
| Environments / PR previews | ❌ | Missing |
| One-click rollback | ⚠️ deploy logs exist | No versioned deploy history to roll back to |
| Project → Service model | ❌ tenant → VM model | Need the Project/Service/Environment data model |
| Billing | ✅ monthly subscription + add-ons (Razorpay, plans, packages) | **Keep subscription** — no usage metering (by design) |
| Resource limits | ⚠️ credit balance check | Plan-**quota** enforcement at provision (not usage caps) |
| Visual canvas | ❌ | Missing |

**Bottom line:** RachBase is a **VM/BaaS provider**; Railway is a **container PaaS**. The
core shift is (a) go **container-first with an orchestrator** and (b) adopt the
**Project → Service → Environment** model with usage billing. Much of RachBase's plumbing
(GitHub App, deploy runner, Prometheus, tenancy, billing/credits) is reusable underneath.

---

## 3. The core architectural shift (do this first)

Two foundational changes everything else hangs off:

**A. A container orchestrator as the runtime.** Railway's scaling, networking, replicas,
and healthchecks all come from running containers on an orchestrator. On RachBase's Proxmox
base, run **k3s (lightweight Kubernetes)** or **Nomad** on the tenant VM pool. This is the
same "container substrate" from `RachBase_Container_Service_Plan.md` — now the heart of the
product. It provides: scheduling, replicas, health, rolling deploys, service networking.

**B. The Project → Service → Environment data model.** New tables:
`projects`, `services` (repo/image, build config, resources, replicas), `environments`
(prod/staging/preview), `deployments` (versioned, immutable → enables rollback),
`domains`, `volumes`, `service_variables`. This replaces "tenant owns VMs" as the primary
object model (VMs become the substrate the orchestrator runs on).

Everything below builds on A + B.

---

## 4. Build plan per pillar

### Deploy
- **Build pipeline:** on push, build the repo into an OCI image. Adopt **Nixpacks** (the
  open-source builder Railway itself uses) or Buildpacks for auto-detection; support a
  custom **Dockerfile**. Reuse the existing GitHub App + webhook.
- **Registry:** a per-tenant private image registry (Harbor / Docker Registry).
- **Deploy:** push image → orchestrator applies a new immutable `deployment`. Instant,
  zero-downtime rolling update.
- *Reuses:* `@rach/deploy` GitHub App/token logic; `deployment_services` becomes `services`.

### Network
- **Automatic SSL + domains:** an ingress (Traefik/Envoy) + cert-manager for auto-TLS;
  free `*.rachbase.app` subdomain per service + custom domains.
- **Private networking:** orchestrator service DNS so services in a project talk over an
  internal network with no config.
- **Protocol/LB:** ingress handles HTTP/TCP/WS + load-balances across replicas.

### Scale
- **Vertical:** set CPU/RAM per service (your container tiers become the sizing knobs —
  0.5 vCPU/1 GB/5 GB is the entry size).
- **Horizontal:** replicas N with LB; optional autoscale on CPU/RAM.
- *This is the "Managed Kubernetes / Container Apps" stage from the master roadmap, delivered
  as product features rather than a raw K8s SKU.*

### Monitor
- **Metrics:** already have Prometheus + per-pool scoping — point it at containers
  (cAdvisor/kube-state-metrics) and reuse the monitoring dashboards.
- **Logs:** add centralized log streaming (Loki + a live tail UI) — the main missing piece.
- **Alerts:** extend `alertMonitor` to route to Slack/Discord/email/webhooks with
  user-configured thresholds.

### Evolve
- **Environments:** clone a project's services into prod/staging.
- **PR previews:** GitHub webhook on PR open → spin up a preview environment; destroy on
  merge/close. (High-value, high-visibility feature.)
- **Rollback:** since deployments are immutable + versioned, "roll back" = re-point the
  service at a previous `deployment` — one click.
- **Config-as-code:** a `rachbase.toml` in the repo describing services/resources.

---

## 5. The Railway-style dashboard

Restructure the RachBase dashboard around **Project → Service**, replacing the current
VM-centric layout:

- **Project canvas (home):** a visual graph of services in the project (service nodes,
  their connections, DBs, volumes) — the signature Railway view. Each node shows status +
  quick metrics.
- **Service view — tabbed, exactly your five mechanisms:**
  - **Deploy** — source (repo/branch/Dockerfile), build & deploy log, deploy history +
    **Rollback**.
  - **Network** — domains (add custom), generated URL, private hostname, ports/SSL.
  - **Scale** — CPU/RAM sliders, replica count, region, autoscale rules.
  - **Monitor** — live logs (tail/filter), CPU/RAM/net charts, alert config.
  - **Evolve** — environments switcher, PR-preview list, variables/secrets, settings.
- **Top-level:** environment switcher (prod/staging/preview), **usage & spend meter with a
  hard-limit setting**, and the "+ New" create picker (you already built the
  "What would you like to create?" modal — GitHub Repo / Database / Docker Image / etc.).

The create modal and Containers page you already have are the seed of this; they graduate
into the Service-create flow.

---

## 6. Billing model — subscription + quota (NOT usage-based)

RachBase bills on a **fixed monthly subscription**, not Railway's per-second usage model.
This is deliberate — and simpler — so we diverge from Railway here on purpose:

- **Plans + add-ons, not metering.** A tenant subscribes to a plan and/or buys monthly
  add-ons (e.g. a $15/mo container, a $100/mo VM). The bill is the sum of monthly line
  items through the existing **Razorpay + `plans` / `subscriptions` / `vm_packages` /
  `expansion_requests`** machinery in `@rach/billing`. **No metering pipeline, no
  per-second precision, no reconciliation** — that whole workstream is dropped.
- **"Spend limits" → plan quotas.** Instead of "stop when you've spent $X," the limit is
  "your plan allows N services / N containers / N vCPU / N GB." Enforcement is a simple
  **quota check at provision time** (count what the tenant has vs what the plan allows) —
  no metered cutoff. A tenant scales/creates *up to* their plan; buying more = an add-on.
- **Positioning is a strength, not a gap.** Railway users praise "hard spend limits"
  precisely *because variable cloud bills are scary*. A fixed subscription sidesteps that
  entirely — **"predictable monthly pricing, no surprise invoices"** is the pitch for SMBs
  who dread AWS/Railway bill anxiety. We're offering the certainty their users want.

**Net effect on this plan:** the Billing pillar is **easier** than a usage model — reuse
what's already built (Razorpay, plans, packages, credits) and add **plan-quota enforcement**
on the Project/Service create paths. Everything else (Deploy/Network/Scale/Monitor/Evolve,
the canvas) is independent of the billing model and unchanged.

---

## 7. Phased roadmap (what to do, in order)

1. **Foundation** — stand up the orchestrator (k3s/Nomad) on the tenant VM pool + the
   Project/Service/Environment/Deployment schema. *(Nothing user-visible; unblocks all.)*
2. **Deploy MVP** — GitHub repo → Nixpacks build → registry → run one container service
   with a generated URL + auto-SSL. This alone is "a working mini-Railway."
3. **Monitor** — container metrics into Prometheus + **live logs (Loki)** + the service
   Monitor tab.
4. **Scale + Network** — replicas/vertical sizing, custom domains, private networking.
5. **Evolve** — environments, **PR previews**, one-click rollback, `rachbase.toml`.
6. **Plan quotas** — enforce plan/add-on allotments at project/service create (subscription model; no usage metering).
7. **Dashboard canvas** — the visual project graph + polished per-service tabs.
8. **Premium** — multi-region, dedicated VMs, BYOC, SSO/RBAC/audit (the enterprise tier).

**First revenue-relevant milestone:** step 2 (deploy a repo to a live URL). **The
Railway-defining wow:** step 5 (PR previews) + step 7 (canvas).

---

## 8. What already helps (don't rebuild)

- **GitHub App + deploy runner** (`@rach/deploy`) → the Deploy pillar's front half.
- **Proxmox VM pool** → the substrate the orchestrator runs on.
- **Prometheus + monitoring dashboards + `alertMonitor`** → most of Monitor.
- **Tenancy + billing/credits (Razorpay)** in `@rach/billing` → usage billing + spend caps.
- **Container tier + deploy picker + Containers dashboard page** → the seed of Service-create.
- **The monorepo + shared `@rach/*`** → RachDev's agents can run as just another service
  type on the same runtime (the "shared agent runtime" finally lands here).

---

## 9. Honest scope note

This is a **large** platform build — Railway is a well-funded company replacing a stack of
tools. The realistic path is to pick the **thin slice that already differentiates**: repo →
container → live URL (steps 1–2), then **PR previews** (step 5), which together are
"Railway for our niche." The orchestrator (step 1) is the gating dependency and the biggest
single lift; everything else is incremental on top of it.
