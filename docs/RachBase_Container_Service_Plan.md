# RachBase — Container-as-a-Service (CaaS) Product Plan

**Date:** 2026-07-11
**Companion to:** `RachDev_RachBase_Split_Plan.md`, `RachDev_Agent_Deployment_Plan.md`
**Goal:** Add **managed containers as a sellable RachBase product** — a new SKU alongside VMs and managed Postgres.

---

## 0. Why this fits RachBase now

RachBase already sells **infrastructure by the month, metered per resource**, on a Proxmox (SpaceArk PVE) base:

- VMs at $100/mo (2 vCPU / 8 GB / 50 GB), block storage at $0.15/GB, snapshots $0.10/GB.
- Capacity is packaged in `vm_packages` and bought via Razorpay `expansion_requests` that an admin fulfills.
- Each tenant is scoped to a PVE resource pool; Prometheus/monitoring is already per-tenant.
- Managed Postgres, observability ($25/VM/mo), and workload monitoring ($25/endpoint/mo) prove you already sell **managed add-on services**, not just raw compute.

A container product is the natural next SKU: **same billing rails, same tenancy model, same monitoring — a lighter, denser unit of compute that customers increasingly expect.** And critically, it's the *same container substrate* the agent-builder runtime needs (Agent Deployment Plan, Layer 1) — **build once, sell twice.**

---

## 1. What we're selling

**RachBase Containers** — managed container hosting. A customer pushes an image (or connects a repo), picks a size, and RachBase runs it: networked, monitored, auto-restarted, billed monthly + usage.

### Product tiers (proposed)

| Tier | What the customer gets | Who it's for |
|---|---|---|
| **Managed Containers** | Run individual containers by size (like a lightweight VM). Deploy from image or GitHub. Logs, metrics, restart. | Teams that want app hosting without managing a VM/OS. |
| **Container Apps** | Multi-container app: service + attached Postgres/Redis, internal networking, a public URL. | Product teams shipping a whole app. |
| **Managed Kubernetes** *(later)* | A managed cluster; customer brings their own manifests. | Advanced teams already on K8s. |

Start with **Managed Containers** — it maps almost 1:1 onto today's VM packaging and reuses the deployment pipeline.

### Positioning vs VMs (avoid cannibalizing, clarify the choice)

> **VMs** = full OS, full control, heavier, dedicated hardware. **Containers** = just your app, denser, cheaper, faster to deploy, scale-to-zero. Pick VMs for stateful/OS-level workloads; pick Containers for stateless apps, services, and workers.

---

## 2. Technical architecture (on Proxmox / SpaceArk)

Three ways to run containers on the existing PVE base:

| Option | How | Pros | Cons |
|---|---|---|---|
| **A. Proxmox LXC** | Native Proxmox system containers, per tenant pool. | Zero new stack; PVE already manages them; fits `pve_pool` tenancy & existing Prometheus. | LXC = system containers, not the Docker/OCI image workflow customers expect; weaker app-container ergonomics. |
| **B. Docker on per-tenant VMs** | Provision a VM (as today), run a Docker/containerd runtime, schedule tenant containers onto it. | Reuses **everything** you have (VM assignment, SSH, deployRunner, observability); OCI images; small leap. | Isolation is process-level within the tenant's VM; scaling across VMs is manual at first. |
| **C. Managed Kubernetes** | Stand up K8s (or k3s) clusters; multi-tenant namespaces or per-tenant clusters. | Real orchestration, autoscaling, scale-to-zero, self-healing; the "grown-up" answer. | Significant new infra + ops burden; overkill for launch. |

### Reference (recommended launch): Docker-on-VM, tenant-scoped

```
   PVE resource pool (per tenant)
   ┌────────────────────────────────────────────┐
   │  Container Host VM(s)                       │
   │  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
   │  │container │ │container │ │container │ ...  │  ← OCI images, sized
   │  └──────────┘ └──────────┘ └──────────┘     │
   │  containerd + agent ── metrics ─▶ Prometheus │
   └───────────────┬────────────────────────────┘
                   │  deploy / start / stop / logs (RachBase API)
   RachBase control plane (deployRunner + new container orchestrator)
```

### Recommendation

**Launch on Option B (Docker-on-VM), architect toward Option C (K8s) as the scale tier.**

- B reuses your entire stack — VM provisioning, `vm_ssh_config`, `deployRunner`, per-pool Prometheus, Razorpay packaging. Fastest path to a sellable SKU with real OCI-image support.
- Keep the control-plane API generic (deploy/start/stop/scale/logs) so that swapping the *backing runtime* to K8s later (Option C) doesn't change the customer-facing product or billing.
- Reserve **Managed Kubernetes** as its own premium SKU once demand justifies the ops investment.
- **Do not launch on LXC-only (A):** customers expect Docker/OCI images; LXC undersells the product.

This is the **same substrate** the Agent Deployment Plan recommends for Layer 1 — so this work directly powers the agent builder's runtime too.

---

## 3. How it slots into existing machinery

The container product should mirror the VM plumbing, not reinvent it:

| Existing (VMs) | New (Containers) | Notes |
|---|---|---|
| `vm_packages` | `container_packages` | Sizes: vCPU/RAM/storage per container, price, billing period. |
| `vm_expansion_requests` | `container_expansion_requests` (or reuse a generic `expansion_requests` with a `resource_type`) | Razorpay-paid, admin-fulfilled — identical flow. |
| `vm_assignments` | `container_assignments` | Which container runs for which tenant, on which host, its size/state. |
| `deployment_services` (repo→VM) | extend to `target_type` (`vm` \| `container`) | The GitHub-deploy pipeline already exists; point it at a container target. |
| `vm_ssh_config` / `runCommand` | container exec | `docker exec`-style command channel instead of SSH. |
| `vm_observability` / Prometheus | `container_observability` | Reuse per-pool Prometheus; scrape container metrics (cadvisor/containerd). |
| VM snapshots | image versions / volumes | Container "snapshot" = pinned image tag + named volume backup. |

**Design choice to make:** a generic `resource_type` on the existing tables (cleaner, less duplication) vs parallel container_* tables (simpler migrations, clearer separation). Recommendation: **generic where the shape is identical (expansion/billing), parallel where semantics differ (assignments, observability).**

---

## 4. Pricing & packaging (proposed)

Mirror the VM model — monthly per unit + usage add-ons:

| Item | Proposed pricing basis | Rationale |
|---|---|---|
| **Container (small)** e.g. 0.5 vCPU / 512 MB / 5 GB | ~$15–20/mo | Priced well under a $100 VM to make the density win obvious. |
| **Container (medium/large)** | Tiered by vCPU/RAM | Same shape as VM sizes. |
| **Persistent volume** | $/GB/mo (align with block storage $0.15/GB) | Reuse existing storage pricing. |
| **Egress / bandwidth** | $/GB over an included allotment | Standard CaaS meter. |
| **Container observability** | $25/container/mo (or bundled) | Matches VM observability SKU. |
| **Private image registry** | Flat/mo or per-GB stored | New managed add-on. |
| **Scale-to-zero / on-demand** *(K8s tier)* | Usage-metered | Premium, later. |

Keep the **monthly-provisioned + usage-metered** billing philosophy from the pricing FAQ so it's consistent for customers and reuses the Razorpay flow. Final numbers are a business call — these are placeholders to anchor the model.

---

## 5. DB & API additions (Phase-by-phase, not now)

New migrations (following the existing `0XX_*.sql` convention):

- `024_container_packages.sql` — catalogue (size, price, billing period).
- `025_container_assignments.sql` — tenant ↔ running container ↔ host VM ↔ state.
- `026_container_registry.sql` — per-tenant image registry refs.
- `027_container_observability.sql` — metrics config per container.
- extend `020_deployment` — add `target_type` to `deployment_services`.

New/extended API surface (RachBase): `containerController` + routes for create/list/start/stop/scale/logs/exec; extend `planController`/`expansionController` for container packages; extend `monitoringController` for container metrics.

---

## 6. Phased rollout

**Phase 1 — Foundation (shared with agent runtime).** Stand up a container runtime on a tenant Container-Host VM (Docker/containerd), driven by the RachBase control plane. Internal only. *This is the same work as Agent Deployment Plan, Layer 1, Step 1 — do it once.*

**Phase 2 — Sellable Managed Containers.** Add `container_packages` + Razorpay purchase (mirror `vm_expansion_requests`), `container_assignments`, create/start/stop/logs API, and a dashboard section under `(dashboard)`. Wire container metrics into existing Prometheus. This is the MVP you can sell.

**Phase 3 — Deploy-from-GitHub for containers.** Extend `deployment_services` with `target_type=container`; reuse the GitHub App + `deployRunner` so customers deploy a repo to a container the same way they deploy to a VM.

**Phase 4 — Container Apps.** Multi-container apps, attached managed Postgres/Redis, internal networking, public URLs, private registry.

**Phase 5 — Managed Kubernetes (premium SKU).** Swap/augment the backing runtime with managed K8s for autoscaling and scale-to-zero, exposed as its own tier — control-plane API and billing unchanged.

---

## 7. Synergy with the rest of the roadmap

- **Agent builder (RachDev):** the Phase 1 container runtime *is* the agent-as-a-service runtime. One substrate powers an internal capability *and* an external product.
- **Split plan:** containers live entirely in RachBase (infra), sold through RachBase billing — cleanly on the "RachBase = platform" side of the split. RachDev consumes it via the same deploy API it already uses.
- **Monitoring/billing:** reuses per-pool Prometheus and Razorpay — no new billing system.

---

## 8. Open decisions for you

- **Runtime bet:** confirm Docker-on-VM for launch (recommended) vs jumping straight to managed K8s.
- **Table strategy:** generic `resource_type` columns vs parallel `container_*` tables (recommendation: hybrid, §3).
- **Isolation bar:** is shared-tenant density acceptable at launch (containers of one tenant share a host VM), or do you need per-container VM-grade isolation from day one (affects cost/density)?
- **Pricing:** confirm the per-container price points and included allotments (egress, storage).
- **Currency:** VM pricing is quoted in USD but plans/Razorpay default to INR — pick the billing currency for containers up front.
