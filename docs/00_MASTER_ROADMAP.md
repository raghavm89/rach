# RachDev × RachBase — Master Roadmap

**Date:** 2026-07-11
**Consolidates:**
- `RachDev_RachBase_Split_Plan.md` (two-repo split)
- `RachDev_RachBase_Shared_Core_Spec.md` (shared packages)
- `RachDev_Agent_Deployment_Plan.md` (agent runtime + LLM layer)
- `RachBase_Container_Service_Plan.md` (sellable CaaS)
- `RachBase_Branding_and_Docs.md` (positioning/copy)

This is the single sequence. The five docs are the detail; this is the order to do them in and how they interlock.

---

## 1. The whole picture in one frame

```
                         ┌───────────────────────────────────┐
                         │   SHARED CORE (@rach/* packages)   │
                         │  auth · billing+credits · deploy   │
                         │  db/middleware · notifications · ui │
                         └───────────────┬───────────────────┘
                    ┌────────────────────┴────────────────────┐
                    ▼                                          ▼
        ┌───────────────────────┐                 ┌───────────────────────┐
        │      RACHBASE         │  container/deploy│       RACHDEV         │
        │  Cloud Mgmt / BaaS    │◀────API contract─│   AI Agent Builder    │
        │  · VMs                │                  │  · build agents       │
        │  · Containers (CaaS)  │──runtime for────▶│  · agents run on      │
        │  · Deploy Agent (ops) │   agents         │    RachBase containers│
        │  · monitoring/billing │                  │  · LLM gateway        │
        └───────────────────────┘                 └───────────────────────┘
```

Two brands, one shared core, one API contract between them. RachBase is the platform; RachDev is a consumer of it. The **container substrate is built once** and powers both RachBase's sellable CaaS *and* RachDev's agent runtime.

---

## 2. Dependency logic (what must precede what)

1. **Shared-core extraction** and the **RachBase API seam** come first — everything else assumes them.
2. **Container substrate** must exist before either the CaaS product or the agent runtime can use it.
3. **Physical app split** needs the shared packages + API seam in place.
4. **Rebrand/launch** comes after the split is functional.
5. **Monetization & scale** (sellable containers, multi-provider LLM, K8s, BYOK) are post-split, largely parallel workstreams.

Golden rule from the split plan: **draw every seam while still in one codebase and prove nothing breaks, before physically separating.**

---

## 3. The unified sequence

### Stage 0 — Freeze & baseline
Tag current `main`, cut `split/*` branches. No functional change.
*(Split Phase 0)*

### Stage 1 — Draw the seams (still one codebase, reversible)
The highest-leverage, lowest-risk stage. Nothing user-facing changes.

- Extract shared code **in place** into `@rach/core`, `@rach/identity`, `@rach/billing`, `@rach/deploy`, `@rach/ui` — prove both concerns still work against them.
- Introduce a **RachBase boundary** (`RachBaseClient`) so `agentController` calls deploy/credits through an interface, not direct imports.
- **Untangle `agentController`**: chat stays RachDev; credit logic → `@rach/billing`; deploy/SSH → `@rach/deploy`.
- Extract the **LLM Gateway** (`@rach/llm` or RachDev module): move the inline Anthropic call behind the gateway with existing token→credit metering **unchanged**.
*(Split Phases 1–2 · Shared Core Spec · Agent Phase A)*

### Stage 2 — Container substrate (build once, powers two products)
Stand up a container runtime (Docker/containerd) on a tenant Container-Host VM, driven by the RachBase control plane. Internal only — no product yet. **This single piece becomes both the CaaS backend and the agent runtime.**
*(Container Phase 1 = Agent Phase B, step 1)*

### Stage 3 — Physically split the apps
- Split backend → `rachbase-backend` + `rachdev-backend`, both consuming `@rach/*`. Replace the in-process `RachBaseClient` with an **HTTP API + service token**; wire RachDev→RachBase auth (RachBase issues tokens, RachDev validates).
- Split frontend → `rachbase-web` + `rachdev-web`, both consuming `@rach/ui`. Point each at its own backend.
*(Split Phases 3–4)*

### Stage 4 — Rebrand & launch
- Apply naming changes, introduce the **RachBase** brand, set up domains, 301s, sitemaps.
- Roll in positioning/README/marketing copy.
- Deploy **RachBase prod first** (it's the dependency), then RachDev. Run in parallel behind flags/DNS before retiring the monolith.
*(Split Phases 5–6 · Branding doc)*

### Stage 5 — Monetize (post-split, parallel workstreams)
- **RachBase:** ship **sellable Managed Containers** — `container_packages` + Razorpay purchase, assignments, create/start/stop/logs API, dashboard section, container metrics into Prometheus. Then **deploy-from-GitHub for containers** (extend `deployment_services` with `target_type`).
- **RachDev:** **multi-provider LLM + cost controls** — second provider adapter, per-model credit multipliers, spend caps, model allow-lists.
*(Container Phases 2–3 · Agent Phase C)*

### Stage 6 — Scale & premium
- **Orchestrated runtime / Managed Kubernetes** — swap the backing runtime to K8s for autoscaling + scale-to-zero; RachBase premium SKU. Serves both CaaS and agent runtime; control-plane API unchanged.
- **Container Apps** — multi-container apps, attached Postgres/Redis, public URLs, private registry.
- **BYOK + enterprise** — encrypted per-tenant LLM keys, compliance controls.
*(Container Phases 4–5 = Agent Phases D–E)*

---

## 4. Stage → outcome → source mapping

| Stage | Shippable / sellable outcome | Source-doc phases |
|---|---|---|
| 0 | Safety baseline | Split P0 |
| 1 | Cleaner monolith, all seams drawn | Split P1–2, Shared Core, Agent A |
| 2 | Container runtime (internal) | Container P1 / Agent B |
| 3 | Two running apps on shared core | Split P3–4 |
| 4 | **RachDev & RachBase live as separate brands** | Split P5–6, Branding |
| 5 | **Containers sold; multi-LLM agents** | Container P2–3, Agent C |
| 6 | K8s tier, Container Apps, BYOK | Container P4–5, Agent D–E |

**First revenue-relevant milestone:** Stage 4 (two brands live). **First new revenue from containers:** Stage 5.

---

## 5. Parallelization

- Stage 1's four workstreams are largely independent — the LLM gateway extraction can run alongside the shared-core extraction.
- Stage 2 (containers) can begin as soon as `@rach/deploy` exists (mid-Stage 1); it doesn't need the app split.
- In Stages 5–6, RachBase (containers) and RachDev (LLM/agents) workstreams run in parallel by different owners — they only share the container substrate and billing, both already stable by then.

---

## 6. Consolidated open decisions

Carried forward from the five docs — settle these to unblock the stages noted:

| # | Decision | Blocks | Recommendation |
|---|---|---|---|
| 1 | Repo model: monorepo workspace vs multi-repo + registry vs submodule | Stage 1 | Monorepo workspace with `packages/*` + `apps/*` |
| 2 | Credits/metering: shared `@rach/billing` vs RachBase-owned API | Stage 1, 5 | Shared module now; can service-ize later |
| 3 | Database: one shared DB vs split per app | Stage 3 | Keep one (RachBase-owned) through launch |
| 4 | UI kit: shared-with-themes vs forked per brand | Stage 3 | Shared primitives + per-brand theme tokens |
| 5 | Container runtime bet: Docker-on-VM vs straight to K8s | Stage 2, 6 | Docker-on-VM at launch; K8s as premium tier |
| 6 | Container isolation: shared host per tenant vs per-container VM | Stage 5 | Decide on isolation bar vs cost/density |
| 7 | LLM gateway scope: shared (deploy agent + builder) vs RachDev-only | Stage 1 | Shared gateway; simpler to consolidate now |
| 8 | Billing currency for containers (USD vs INR) | Stage 5 | Pick up front; VM pricing is USD, Razorpay INR |
| 9 | Agent tool power: keep SSH/runCommand for user agents? | Stage 2 | If yes, container isolation is urgent |
| 10 | LLM providers to support beyond Anthropic | Stage 5 | Confirm launch set |

---

## 7. Recommended immediate next step

Greenlight **Stage 1**. It's reversible, ships no user-facing change, and every later stage depends on it. Concretely: stand up the monorepo workspace (decision #1), extract `@rach/core` + `@rach/identity` first (they unblock everything), then `@rach/billing`/`@rach/deploy`, then the LLM gateway. When Stage 1 is green, Stage 2 (containers) and Stage 3 (app split) can start in parallel.
