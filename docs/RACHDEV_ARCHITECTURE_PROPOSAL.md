# RachDev Architecture Proposal — Agent Product over a Pluggable Runtime

**Date:** 2026-08-05
**Status:** Proposal for review (no code changed yet)
**Scope:** `apps/rachdev-web`, `apps/rachdev-backend`, and the RachDev↔RachBase seam. RachBase internals are described only where the contract touches them.
**Related:** `docs/RACHDEV_PRODUCT_AUDIT_2026-08-05.md` (findings this proposal resolves), `docs/00_MASTER_ROADMAP.md`.

---

## 1. What this proposal decides

RachDev is the **multi-industry AI agent product**: build an agent, deploy it, monitor it, pay for it. It is *not* a cloud/infrastructure vendor. Today the code blurs that line — the implemented agent is a DevOps deployment assistant, the pricing page sells VMs, and privileged infra actions (`run-command`, `trigger-deploy`) are exposed as product features. This document defines the target architecture that removes the blur.

Three principles drive everything below:

1. **Hosting is an internal detail, never a product surface.** Customers buy and see *agents*. VMs and containers are our cost of goods, not a SKU.
2. **The dashboard is the product; the runtime is just where the agent happens to run.** RachDev's control plane is always our cloud. The runtime can sit on RachBase, on-prem, or a customer cloud — the dashboard is identical across all three.
3. **The AgentSpec is the only artifact that crosses the seam.** RachDev produces it; a runtime executes it. Nothing infrastructure-shaped travels upward into the product.

---

## 2. The problem today (grounded in the code)

- **`apps/rachdev-backend/src/routes/agent.js`** exposes `POST /sessions/:id/run-command` and `/trigger-deploy`. Both carry only `authenticate` — any logged-in user of any role can trigger an SSH exec (audit finding **P0-7**).
- **`agentController.chat`** builds a system prompt that reads *"You are a deployment assistant for Rach Dev, a managed cloud platform… run commands on their VMs."* The implemented agent is an infra-ops copilot, not the industry agent builder the site markets.
- **`services/rachbaseClient.js`** speaks infrastructure verbs to RachBase: `POST /internal/deploy`, `POST /internal/run-command` with `x-service-token`. These verbs pull VM concepts up into RachDev.
- **`apps/rachdev-web/src/app/pricing/page.tsx`** renders `@rach/ui`'s `PricingSection`, which reads the shared **cloud catalog** (VMs, Postgres, load balancers). RachDev has no agent-native pricing (finding **P0-1**).
- RachDev's DB carries **`vm_ssh_config`** and **`deployment_services`** — infrastructure state that belongs to RachBase.

All of these are the same leak — hosting has escaped upward into the product — showing up in five places.

---

## 3. Target architecture — control plane vs. data plane

```
                RACHDEV CONTROL PLANE  (always ours, always cloud)
        Builder + Sandbox · Monitor/Dashboard · Billing/Seats · AgentSpec registry
                                     │  deploy(AgentSpec)      ▲ telemetry (metadata)
                                     ▼                         │
        ┌──────────────── AGENT RUNTIME CONTRACT — one interface, N targets ────────────────┐
        │                                                                                    │
   ① RachBase-managed                  ② On-prem                        ③ Customer cloud (BYOC)
   containers on our VMs        runtime agent phones home              same runtime agent
   we meter compute (COGS)      data stays on the customer's site      their AWS/Azure/GCP
```

**Control plane (RachDev, our cloud).** Everything the customer interacts with: the builder chat and sandbox, the monitoring dashboard, billing and seats, and the AgentSpec registry. This never moves — even for an on-prem customer, this is the SaaS they log into.

**Data plane (the runtime).** Where a deployed agent actually executes and touches customer data. Pluggable across three targets (§5). The control plane addresses all of them through one contract (§4).

This is a standard hybrid/BYOC control-plane / data-plane split. It is what lets us host most customers on RachBase while selling on-prem solutions to enterprises that can't send data to our cloud — without maintaining two products.

---

## 4. The Agent Runtime Contract (the seam)

The seam changes from **infrastructure verbs** to **agent verbs**. RachDev hands over an AgentSpec and asks about the agent — it never names a VM or sends a shell command.

| Direction | Call | Purpose |
|---|---|---|
| Control → Runtime | `deploy(agentSpec)` | Create/update a running agent from its spec. Returns a runtime handle + endpoint/channel info. |
| Control → Runtime | `stop(handle)` / `restart(handle)` | Lifecycle control. |
| Runtime → Control | `status(handle)` | Health, version, replica state. |
| Runtime → Control | `metrics(handle)` | Counts, latency, credit/token usage — **aggregates, not content.** |
| Runtime → Control | `logs(handle)` | Operational logs, **redaction-aware** (see §5 on on-prem). |

**AgentSpec is the crossing artifact.** The primitive already exists in the codebase as `AgentDefinition` (`agentController` describes it as the "builder ↔ operate seam"). It is promoted to the single contract object: template lineage, system prompt, tools, guardrails, channel config, industry, and versioning. The builder writes it; a runtime runs it; nothing else structural crosses.

**Telemetry is metadata-first.** The upward calls (`status`, `metrics`, `logs`) are defined to carry operational metadata by default, not raw conversation data. This is what makes the same dashboard safe for an on-prem deployment where content must never leave the customer's premises.

**What this retires.** `run-command` and `trigger-deploy` leave RachDev entirely (§8). RachBase decides internally which container on which VM runs a spec; that decision is invisible to RachDev and to the customer.

---

## 5. Pluggable runtime targets

The runtime target is a property of a deployment, chosen at deploy time.

**① RachBase-managed (default; self-serve).** RachBase runs the agent as a container on its VM substrate, holds the SSH keys, scales it, and meters the compute as *our* cost. This is the target for all self-serve/single-agent customers because we control the compute and can therefore publish a price. Billing: per active agent + credits (§6).

**② On-prem (enterprise).** The agent runs inside the customer's datacenter. We ship a small **runtime agent** — a container/daemon the customer runs on their side — that:
- pulls the AgentSpec from the control plane (outbound connection only),
- runs the agent against the customer's own data and systems,
- pushes **metadata telemetry** back out to the control plane so the dashboard stays live.

We never open an inbound connection into the customer's network; the runtime agent phones home. Raw conversation/records stay on-site; the dashboard shows health, counts, and usage. Billing: license/solution fee, negotiated (§6) — there is no RachBase COGS to price against.

**③ Customer cloud / BYOC (enterprise, later phase).** The same runtime agent, deployed into the customer's AWS/Azure/GCP. Same contract, same telemetry model. Sequenced after on-prem since it shares the runtime-agent machinery.

> **Recommended constraint:** on-prem and BYOC are **sales-led / enterprise-only**. Self-serve always means RachBase-managed. This keeps the self-serve product simple and keeps the "runtime agent" complexity behind the enterprise motion.

---

## 6. Commercial model

Two motions, mapped to the targets.

**Self-serve — single agent (published price).** Always RachBase-hosted. Priced as a **requirement-based bundle**: the customer describes the need, we assemble a bundle. The meters:

- **Seats** — who can build/manage agents (the builder subscription).
- **Active agents** — flat per live agent per month; *this line absorbs the hosting COGS.* The customer reads "3 active agents," never "1 VM."
- **Credits** — a single shared wallet metering LLM usage (`@rach/llm` already meters tokens→credits). Building sips; deployed agents gulp. One balance the customer tops up.

**Enterprise — full AI solution (no public price).** Any target, including on-prem/BYOC. No RachBase COGS on-prem, so it's a **license/solution fee** — always negotiated. The `/pricing` page therefore shows the self-serve bundle plus a **"Talk to us"** card for solutions. This is how P0-1 gets fixed in a way that matches how RachDev actually sells: the borrowed cloud catalog is removed and replaced with a RachDev-native bundle + contact-sales.

Open pricing decisions are listed in §11.

---

## 7. Multi-industry (ties in the audit's P1-6)

The dashboard shell stays identical across industries; only content varies — the model already partly exists (`dashboard/layout.tsx` gates nav by `user.tenant_industry`). To make onboarding a new industry a *config change* rather than a code change:

- **Industry module registry.** A config keyed by industry id declaring its nav items, roles, and module routes. `NAV_ITEMS` and route structure are driven from it instead of being hardcoded.
- **Roles move into modules.** `doctor`, `reception`, `store_manager` currently live in the global role enum and in backend `authorize(...)` calls. They become part of the healthcare module definition, so a new industry ships its own roles without touching global enums.
- **De-clinicalize naming.** `ClinicalDashboardLayout` → a generic shell; `dashboard/clinical/*` → an industry-scoped structure. Healthcare becomes the first registered module, not the hardcoded default.

Industries themselves already exist on the marketing side (`src/lib/industries/*`, 15+ verticals) — the registry brings the dashboard in line with that.

**Implemented (2026-08-05):**
- `apps/rachdev-web/src/config/dashboard/registry.ts` — the registry: `platformNav`/`platformFooterNav` (industry-independent), `industryModules` (keyed by industry id; healthcare is the first entry, carrying its own modules + role labels), and helpers `navForUser(role, industry)` / `roleLabel(role, industry)`.
- `dashboard/layout.tsx` is now driven entirely by the registry — the hardcoded `NAV_ITEMS`/`ROLE_LABEL` are gone, and `ClinicalDashboardLayout` → `WorkspaceLayout`. Onboarding a new vertical is now an entry in `industryModules` plus its route pages — no layout change.
- Frontend role labels (`doctor`/`reception`/`store_manager`) now live inside the healthcare module, not a global map.

**Remaining coupling — resolved (2026-08-13):** the backend now has its own role registry (`packages/identity/src/config/roles.js`, mirroring the frontend registry): platform roles plus per-vertical `roles` + reusable authorization `groups` (healthcare: clinician/frontdesk/store/anyStaff/viewer/signer; hr: staff/director/employee). The valid-role allowlist (`ROLES` in `user.js`) is derived from it, and all ~15 healthcare/HR route files import named groups (`authorize(...HEALTHCARE.clinician)`) instead of inline magic-string arrays — so adding or changing a vertical's roles is a single edit in the registry. Role sets are byte-for-byte identical to the pre-refactor behavior (verified). The only remaining per-vertical DB touch is the Postgres `user_role` enum, which is extended by migration (047 healthcare, 052 HR, 081 employee) — inherent to enum types and kept in parity with the registry.

**Second industry added — HR (2026-08-05):** validated the registry with a real vertical ported from the HR Layers demo.
- `industryModules.hr` registered (nav: Dashboard, Requisitions, Pipeline, Approvals, Interviews, Offers, Audit + HR role labels) — no layout change, exactly the config-only onboarding the registry promised.
- All seven HR screens built under `dashboard/hr/*` (Dashboard, Requisitions, Pipeline, Approvals, Interviews, Offers, Audit — the last with actor/subject filters + CSV export), restyled to the RachDev design system over ported demo data (`src/data/hr/*.json`, `src/lib/hr/demo.ts`). No backend needed; all typecheck clean.
- The 7 HR AI features registered as platform AgentSpec templates via `051_hr_agent_templates.sql` (each with `human_review` guardrails — the "AI drafts, humans approve" thesis maps directly onto AgentSpec). Verified against a real Postgres: 7 valid templates, idempotent.
- HR roles wired backend + frontend (2026-08-05): `052_hr_roles.sql` adds `hr_executive`/`hr_director`/`project_manager` to the `user_role` enum (verified on a fresh Postgres); the `ROLES` allowlist in `@rach/identity` accepts them (so a tenant admin can assign them); `@rach/ui`'s `UserRole` type includes them; and the HR dashboard modules are gated to those roles (Audit → hr_director, Offers → hr_director/hr_executive, rest → all HR roles + Org Admin). To see the HR workspace, a tenant's industry must be set to `hr`.
- HR backend data layer built (2026-08-05): `053_hr_schema.sql` adds 7 tenant-scoped tables (requisitions, applications, candidates, approvals, interviews, offers, audit_events) storing each domain object as JSONB keyed by `ext_id`, so the API returns exactly the shape the screens render. `@rach/core`'s `Hr` model does tenant-scoped `list`/`counts`/`seedFromDemo`; `apps/rachdev-backend` serves `GET /api/hr/:entity` + `/summary`, gated to HR roles + Org Admin. Seed a tenant with `node apps/rachdev-backend/scripts/seed-hr-demo.js <tenantId>`. Proven on a fresh Postgres: seeded 3 reqs / 33 apps / 55 audit events, counts match, idempotent, second tenant sees zero (isolation).
- All seven HR screens now fetch real data via `/api/hr` (`@rach/ui` `hr` client + a shared `useHr` hook); none read bundled JSON anymore. The demo JSON in `src/data/hr/*.json` remains only as the seed source. (`src/lib/hr/demo.ts` still provides types/labels/helpers; its now-unused data-array exports are harmless cleanup.)

---

## 8. Data / ownership: what moves, what stays

**Stays in RachDev (product/control plane):**
- `agent_definitions` (AgentSpec registry)
- Builder conversations + sandbox transcripts (rebuilt around the AgentSpec, replacing the DevOps-assistant chat)
- `credit_transactions`, credit balances, usage summaries (billing)
- Tenant/industry, users, seats, support tickets
- The whole `apps/rachdev-web` control plane

**Moves to RachBase (infra/data plane):**
- `vm_ssh_config`, `deployment_services` — infrastructure state
- `run-command`, `trigger-deploy` handlers and the `rachbaseClient` infra verbs
- The **DevOps deployment-assistant agent** (its current system prompt calls RachDev "a managed cloud platform"). Decide whether it is retired or survives as a *RachBase* product feature — either way it exits RachDev.

**Becomes the seam:**
- `services/rachbaseClient.js` is rewritten to the agent-runtime contract (§4) — `deploy(spec)`, `status`, `metrics`, `logs`, `stop` — pointed at whichever runtime target the deployment selects.

---

## 9. Security implications

- **P0-7 resolved by construction.** With `run-command`/`trigger-deploy` gone from RachDev, there is no user-facing arbitrary-exec surface. In the interim (before the move), gate both with `authorize('tenant_admin','developer')`.
- **Service-token trust boundary clarified.** RachBase authenticates the *service*, not the user; per-user authorization is RachDev's job. The runtime contract keeps that responsibility on the RachDev side where the user identity exists.
- **On-prem data residency.** Metadata-only telemetry means customer content never transits our cloud for on-prem deployments — a prerequisite for regulated verticals (healthcare/PHI, legal, financial).
- **Carried forward from the audit:** enforce a CORS allowlist in production (reject `*`), and revisit the documented login user-enumeration tradeoff before enterprise GA.

---

## 10. Migration sequence

Draw every seam while still in one codebase and prove nothing breaks before separating (the roadmap's golden rule).

1. **Interim safety:** add `authorize(...)` to `run-command`/`trigger-deploy` (closes P0-7 today).
2. **Fix the storefront:** replace the borrowed cloud catalog on `/pricing` with the RachDev bundle + "Talk to us" card (closes P0-1); hide `/docs` while it says "Coming soon."
3. **Hygiene:** delete the 7 unused `mock/*` files, 3 unused deps, and `_rtest.js` (audit P1-11/12, P2-13).
4. **Define the AgentSpec contract** formally from the existing `AgentDefinition`.
5. **Introduce the runtime contract** (`deploy/status/metrics/logs/stop`) alongside the current infra client; make RachBase-managed the first target behind it.
6. **Rebuild the builder chat** around the AgentSpec (replacing the DevOps-assistant chat); retire/relocate the DevOps agent and move `vm_ssh_config`/`deployment_services` to RachBase.
7. **Industry module registry** — de-clinicalize the dashboard, move roles into modules (P1-6).
8. **On-prem runtime agent** — design and build the phone-home runtime + metadata telemetry. Largest lift; enterprise-gated.
9. **BYOC** — extend the runtime agent to customer clouds.

**Implemented (2026-08-13) — steps 8 & 9:**
- **Control-plane phone-home API** (`/api/runtime/v1`, `runtimeController` + `routes/runtime.js`): `GET /spec` (returns the deployment's published AgentSpec, bumps heartbeat) and `POST /telemetry` (metadata-only: status, run/error counts, p50/p95 latency, token totals, runtime version). Authenticated by a per-deployment **runtime token** (`rt_…`), minted once at self-host deploy and stored hashed. CORS-open, outbound-only from the customer; mounted ahead of origin-locked CORS.
- **Storage** (migration `095_agent_deployment_runtime.sql`): `runtime_token_hash/prefix`, `last_heartbeat_at`, `telemetry` JSONB, `runtime_version`, `placement` on `agent_deployments`; `AgentDeployment` gains `mintRuntimeToken`/`verifyRuntimeToken`/`recordTelemetry`/`touchHeartbeat`/`health()` (fresh heartbeat → reported status; stale → `unreachable`; never phoned home → `pending`).
- **Deploy flow** (`deploymentController`): self-hosted deploy mints the token, returns a target-aware bundle (token once + image + launch recipe + config). Pull-target `status`/`metrics`/`logs` now read the stored telemetry/health instead of "pending"; logs return **no content** for pull targets (data-residency note) — only metadata ever reaches the dashboard.
- **The runtime agent** (`apps/runtime-agent`): a dependency-free Node daemon. Pulls its spec periodically, runs locally against the **customer's own LLM key** (Anthropic/OpenAI) exposing `/chat` + `/v1/chat/completions`, and pushes metadata-only telemetry every 60s. Ships with a `Dockerfile`, `README`, and `deploy/` manifests. Conversation content never leaves the customer.
- **BYOC recipes** (`services/runtimeRecipes.js`): the same image with placement-specific launchers — on-prem `docker run`/compose, Kubernetes, AWS ECS/Fargate, Google Cloud Run, Azure Container Instances — generated into the deploy bundle and picked in the Ship-it UI.
- **Verified** on embedded Postgres + supertest: deploy→token mint (stored hashed), spec pull (auth ok/reject), telemetry ingest → control-plane health/metrics reflect it, stale→unreachable, plus a runtime-agent smoke (pull spec + run against a stubbed LLM + push metadata-only telemetry). Web `tsc` clean.

> **Still enterprise-ops, not code:** publishing the runtime-agent image to a registry (`RUNTIME_AGENT_IMAGE`), and the §11 decisions (on-prem telemetry scope confirmation, active-agent fee) remain open.

---

## 11. Open decisions

1. **On-prem = enterprise-only?** Recommend yes: self-serve is always RachBase-managed; on-prem/BYOC are sales-led. Confirm.
2. **Telemetry scope for on-prem** — confirm metadata-only (no raw conversation logs leave the customer). Shapes the `logs`/`metrics` contract.
3. **Runtime agent form factor** — container image vs. daemon; how it authenticates its phone-home; update mechanism. Biggest engineering scope item.
4. **Active-agent fee: flat or tiered?** Flat is simpler; tiered (Standard vs. Isolated) protects margin on regulated/isolated hosting.
5. **Free/trial floor** — is build + sandbox (no deploy) a free tier? It's cheap for us and a natural on-ramp.
6. **DevOps assistant** — retire, or keep it as a RachBase product feature?

---

*This is a proposal. Nothing here is implemented. Once the §11 decisions are settled, the next artifacts are: the AgentSpec schema, the runtime-contract API spec (with the metadata telemetry shape), and the RachDev pricing catalog.*
