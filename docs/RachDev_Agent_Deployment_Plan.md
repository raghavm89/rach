# RachDev Agent Builder — Deployment Plan

**Date:** 2026-07-11
**Companion to:** `RachDev_RachBase_Split_Plan.md`
**Scope:** How agents built in RachDev get deployed and run. Two layers, per your framing:

1. **The agent-as-a-service** — where the agent lives and runs.
2. **The LLM API layer** — how a running agent calls LLM provider APIs.

Runtime model: you asked for a recommendation — see §2.4.

---

## 0. Where things stand today (grounding)

The current "agent" is **not yet a builder** — it's a single hardcoded *deployment assistant* baked into `agentController.chat`:

- One provider, one model: `anthropic.messages.stream({ model: 'claude-haiku-4-5-...' })`.
- One key: the **platform's** `ANTHROPIC_API_KEY` from env. No per-tenant keys, no other providers.
- Runs **inline inside the API request** — there's no separate agent process or service. The "agent" is an HTTP handler that streams from Anthropic.
- Metering already exists and is solid: `input + output tokens → credits`, deducted from `tenant_credits`; credit packs + Razorpay purchase already built.
- "Actions" (`triggerDeploy`, `runCommand`) are **separate endpoints**, not model-driven tool calls — the model can talk about deploys but can't autonomously invoke them yet.

So to become an agent *builder*, two things must be designed that don't exist yet: **a runtime where each user's agent lives**, and **a provider layer the agent calls out through**. That's exactly the two-part split you named.

---

## 1. The two deployment layers, defined

```
   ┌──────────────────────────────────────────────────────────────┐
   │  LAYER 1 — Agent-as-a-service (WHERE the agent runs)          │
   │  A user builds an agent → it's packaged → deployed to a       │
   │  runtime that hosts it, gives it an endpoint, keeps it alive. │
   └───────────────────────────┬──────────────────────────────────┘
                               │  at runtime the agent makes outbound calls
                               ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  LAYER 2 — LLM API layer (HOW the agent calls the model)      │
   │  Every agent turn → LLM Gateway → provider (Anthropic/OpenAI/ │
   │  …) → tokens metered → credits deducted → response returned.  │
   └──────────────────────────────────────────────────────────────┘
```

These are independent decisions. You can change where an agent runs without changing how it calls models, and vice-versa. The plan treats them separately.

---

## 2. Layer 1 — Agent-as-a-service (the runtime)

### 2.1 What a "deployed agent" needs

Each user-built agent needs: an identity/config (prompt, tools, model settings), a place to execute, an addressable endpoint (HTTP/webhook/schedule trigger), isolation from other tenants' agents, lifecycle control (start/stop/restart/scale-to-zero), and logs + metrics.

### 2.2 The options

| Model | How it works | Pros | Cons |
|---|---|---|---|
| **A. VM + SSH (today's infra)** | Deploy agent code onto a tenant VM via `deployRunner`, run as a process. | Reuses RachBase as-is; zero new infra; matches current `deployment_services` model. | Weak isolation between agents on a VM; you manage the OS; scaling is manual; heavy for a lightweight agent. |
| **B. Containers (Docker → orchestrated)** | Package each agent as a container image; run on a scheduler (K8s / Nomad / ECS). | Strong per-agent isolation; horizontal scaling; scale-to-zero; clean multi-tenancy; reproducible. | New infra to stand up & operate; image build pipeline; more moving parts. |
| **C. Serverless / functions** | Agent turn = a function invocation (Lambda/Cloud Run/Workers). | No idle cost; scales automatically; simplest ops. | Cold starts; execution time limits hurt long-running/stateful agents; harder to run persistent tools/sessions; vendor lock-in. |

### 2.3 Reference: hybrid runtime

```
   RachDev control plane                RachBase (infra provider)
   ┌────────────────────┐  deploy API   ┌───────────────────────┐
   │ Agent registry     │──────────────▶│  Container runtime    │
   │ (config, versions) │               │  (per-tenant agents)  │
   │ Deploy orchestrator│◀──────────────│  logs / metrics       │
   └────────────────────┘   status/logs └───────────────────────┘
        │
        │ invoke (HTTP / schedule / webhook)
        ▼
   Running agent instance ──▶ Layer 2 (LLM Gateway)
```

RachDev owns the **agent registry and orchestrator** (what an agent is, its versions, when it deploys). RachBase owns the **runtime substrate** (VMs today, containers next) and exposes deploy/logs/scale over the API contract from the split plan. This keeps the split's dependency direction intact: RachDev requests, RachBase provisions.

### 2.4 Recommendation

**Target containers (Option B); get there in two steps, don't rip out VMs on day one.**

- **Step 1 (now, low-risk):** keep the VM+SSH path you already have, but run each agent as a **containerized process on the VM** (Docker on the existing VMs). This gives you real per-agent isolation immediately with almost no new infra — `deployRunner` deploys a container instead of a bare process.
- **Step 2 (when volume justifies it):** put a real orchestrator in front (managed K8s / ECS / Nomad) for autoscaling and scale-to-zero. RachBase exposes it through the same deploy API, so RachDev doesn't change.

Why not serverless as the default: agents are often **stateful and long-running** (multi-turn sessions, persistent tools, the SSH/command tools already in the code), which fights function time limits and cold starts. Keep serverless as an option for **stateless webhook-style agents** later, not the foundation.

Why not stay on bare VM+SSH: it's fine for one internal assistant, but a *builder* means many tenants' arbitrary agents sharing hosts — that needs container-grade isolation before it's a product.

---

## 3. Layer 2 — The LLM API layer (how agents call models)

### 3.1 The problem with today's setup

One provider, one model, one platform key hardcoded in a controller. A builder needs: multiple providers and models, per-tenant or bring-your-own keys, safe key storage, routing/fallback, and accurate metering per call. The good news: **the metering half already exists** (tokens → credits → `tenant_credits`). Build the gateway around it.

### 3.2 Introduce an LLM Gateway (single choke point)

Every agent's model call goes through one internal service instead of `new Anthropic(...)` scattered in controllers:

```
 agent turn ─▶ LLM Gateway ─▶ provider adapter ─▶ Anthropic | OpenAI | …
                   │                                   │
                   ├─ resolve model + key              │
                   ├─ apply rate limits / quotas       │
                   ├─ stream back to caller ◀──────────┘
                   └─ on finish: tokens → credits (reuse deductCredits)
```

Responsibilities: provider abstraction (adapter per vendor, uniform request/stream shape), model catalog (which models are allowed, their credit multipliers), key resolution (§3.3), streaming passthrough (keep the current SSE behavior), metering (reuse existing token→credit logic), and observability (per-call logs of model, tokens, latency, cost).

### 3.3 Key management — two modes

| Mode | Who owns the key | When to use | Metering |
|---|---|---|---|
| **Platform keys (default)** | RachDev's own provider accounts | Most users; simplest UX; you mark up via credits | Full credit deduction |
| **Bring-your-own-key (BYOK)** | Tenant's own provider key, stored encrypted | Enterprises, high volume, compliance | Meter usage but discount/zero credits since they pay the provider directly |

Store keys encrypted at rest (KMS / secrets manager, **never** in `deployment_services` or plaintext env per-tenant). Resolve at call time: tenant BYOK if present, else platform key. This is a clean extension of the current single-key model.

### 3.4 Routing, limits, and cost control

Per-model **credit multipliers** (a Haiku turn ≠ an Opus turn — today all tokens cost the same, which under-charges for expensive models). Per-tenant **rate limits & spend caps** to prevent runaway agents draining credits (the current code only checks `balance <= 0` *before* a call — add mid-stream and per-minute guards). **Fallback routing** (if a provider errors/times out, retry on an alternate). **Model allow-lists** per plan tier.

### 3.5 Recommendation

Build the **LLM Gateway as a RachDev-owned service** (agents are RachDev's product; model access is core to it — don't push this into RachBase). Ship in order: (1) extract today's inline Anthropic call into the gateway with the existing metering intact — no behavior change; (2) add a second provider adapter to prove the abstraction; (3) add per-model credit multipliers + spend caps; (4) add BYOK. Steps 1–2 are the foundation; 3–4 are monetization/enterprise.

---

## 4. How this rides on the RachDev / RachBase split

| Concern | Owner | Notes |
|---|---|---|
| Agent registry, versions, config | **RachDev** | The builder's core domain. |
| Deploy orchestration (request) | **RachDev** | Calls RachBase deploy API. |
| Runtime substrate (VM/container) | **RachBase** | Provisioning, SSH, logs, scale — the shared infra. |
| LLM Gateway + provider keys | **RachDev** | Model access is product-specific to the agent builder. |
| Credit metering + billing | **Shared** | `tenant_credits` + Razorpay live in RachBase billing; gateway calls it. |
| Auth / tenants | **RachBase** | Identity provider per the split plan. |

Net: **Layer 1 leans on RachBase** (it's infra). **Layer 2 lives in RachDev** (it's the agent product). Billing/identity stay shared in RachBase. This is consistent with the split plan's "RachBase = platform, RachDev = consumer."

---

## 5. Phased rollout (proposed)

**Phase A — Gateway extraction (Layer 2, no user-visible change).** Move the inline Anthropic call into an LLM Gateway module; keep Haiku + existing credit metering identical. Pure refactor, reversible.

**Phase B — Containerize the runtime (Layer 1, step 1).** Run agents as Docker containers on existing VMs via `deployRunner`. Real isolation, minimal new infra.

**Phase C — Multi-provider + cost controls (Layer 2).** Add a second provider adapter, per-model credit multipliers, spend caps, model allow-lists per plan.

**Phase D — Orchestrated runtime (Layer 1, step 2).** Introduce a scheduler (K8s/ECS) behind RachBase's deploy API for autoscaling + scale-to-zero. RachDev unchanged.

**Phase E — BYOK + enterprise.** Encrypted per-tenant keys, BYOK metering path, compliance controls.

Sequencing note: A and B are independent and can run in parallel. Both should land **after** split Phase 1 (the RachBase API seam) so Layer 1 has a contract to call.

---

## 6. Open decisions for you

- **Agent invocation model:** are agents mostly interactive chat sessions (like today), or do you also need scheduled/webhook-triggered autonomous agents? This changes how hard serverless-style triggers matter.
- **Tool execution:** should deployed agents keep the `runCommand`/SSH tool power (agents that operate infra), or are most agents pure LLM+API workflows? The former needs the container isolation urgently.
- **BYOK priority:** is enterprise BYOK a near-term sales need or a later feature? Determines whether Phase E moves up.
- **Provider set:** which LLM providers beyond Anthropic must launch support (OpenAI, Google, open-weight/self-hosted)?
