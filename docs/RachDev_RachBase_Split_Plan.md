# RachDev → RachBase: Repo Split & Rebranding Plan

**Date:** 2026-07-11
**Decision recorded:** Split the current single codebase into **two separate repos/apps**.
**This document:** the migration plan. No application code has been changed yet.

---

## 1. The rebrand in one line

| Vertical | Old home | New brand | Product |
|---|---|---|---|
| AI Solutions / Agent Builder | RachDev | **RachDev** (unchanged) | Build & run AI agents |
| Cloud Management / BaaS | inside RachDev | **RachBase** (new) | VM provisioning, deployments, monitoring, tenants, billing |

The name `RachBase` is not yet used anywhere in the code — this is a greenfield brand, which keeps the rename risk low.

---

## 2. The one thing that makes this non-trivial

The two verticals are **not cleanly separable today**. The agent builder (RachDev) is built *on top of* the cloud layer (RachBase):

- `agentController.js` (agent builder) directly imports `services/deployRunner`, `services/sshKey`, and reads/writes the `tenant_credits` table.
- It provisions and talks to **VMs** — the same VMs the cloud vertical manages.
- Both verticals share one Postgres database, one auth system, one billing/Razorpay integration, and one `tenants`/`users` model.

So this is not a find-and-replace rename. It's a **service extraction**: RachBase becomes the infrastructure/identity/billing platform, and RachDev becomes a product that *consumes* RachBase over an API.

The naming footprint itself is small (~81 refs in frontend, ~12 in backend, plus folder/package names). The hard part is the dependency untangling below, not the renaming.

---

## 3. What belongs to which brand

### Backend (`rach-dev_backend`)

**→ RachBase (Cloud / BaaS platform)**

| Layer | Files |
|---|---|
| Controllers | `deploymentController`, `monitoringController`, `tenantController`, `vmAssignmentController`, `expansionController`, `planController`, `paymentController` |
| Routes | `deployment`, `monitoring`, `tenants`, `expansion`, `plans`, `payments` |
| Services | `deployRunner`, `prometheus`, `alertMonitor`, `razorpay`, `sshKey`, `terminalServer` |
| Models | `plan`, `order`, `payment`, `subscription`, `idempotencyKey`, `webhookEvent` |

**→ RachDev (Agent Builder)**

| Layer | Files |
|---|---|
| Controllers | `agentController` |
| Routes | `agent` |
| Depends on (currently in-process) | `deployRunner`, `sshKey`, `tenant_credits` — **these must become RachBase API calls** |

**→ Shared / Core (needed by both)**

| Layer | Files |
|---|---|
| Config | `config/db`, `config/env` |
| DB | `db/migrate`, `db/migrations` |
| Middleware | `auth`, `role`, `asyncHandler`, + rest of `middleware/` |
| Controllers | `authController`, `userController`, `contactController` |
| Routes | `auth`, `oauth`, `users`, `contact` |
| Services | `brevo` (email), `sms` |
| Models | `user`, `refreshToken`, `verification` |

### Frontend (`rach-dev`)

**→ RachBase app** — the entire `(dashboard)` group: `deployment`, `infrastructure`, `monitoring`, `my-vms`, `vm-monitor`, `tenants`, `orders`, `billing`, `credit-usage`, `team`, `users`. Plus `components/dashboard`, `components/dashboard-ui`, `VMHistoryModal.tsx`, `TerminalContext`, and `products/baas` marketing.

**→ RachDev app** — `(public)/agents`, `(public)/demo`, `components/chat`, `components/demo`, `components/industry-demo`, `ChatContext`, `products/agent-builder`, `data/demo`, `data/industries`, `data/templates`.

**→ Shared** — `(auth)` flow, `AuthContext`, root `layout`, `components/ui`, `components/forms`, `lib/api.ts`, marketing shell (`home`, `sections`, `contact`, `about`, `legal`, etc.).

---

## 4. Recommended target architecture

```
                 ┌─────────────────────────────┐
   auth / users  │        RachBase             │  ← platform of record
   billing       │  (Cloud Mgmt / BaaS API)    │    owns DB, auth, billing,
   VMs / deploy  │  repo: rachbase-backend     │    VMs, deployments, monitoring
   monitoring    │  app:  rachbase-web (dash)  │
                 └──────────────┬──────────────┘
                                │  REST/JSON + service token
                                │  (deploy, ssh exec, credits, tenant)
                 ┌──────────────┴──────────────┐
                 │        RachDev              │  ← consumer product
                 │  (Agent Builder)            │    calls RachBase for infra;
                 │  repo: rachdev-backend      │    owns agent sessions, chat,
                 │  app:  rachdev-web          │    Anthropic integration
                 └─────────────────────────────┘
```

**Why RachBase is the platform and RachDev the consumer:** the dependency arrow already points that way in the code (agent builder → deploy/ssh/credits). Reversing it would be fighting the codebase. RachBase owns identity, billing, and infra; RachDev authenticates against RachBase and requests deployments through a documented API.

**Shared code strategy:** extract the "Shared / Core" layer above into an internal package (e.g. `@rach/core` — auth middleware, db client, user model, email/SMS) published to a private registry or a git submodule, so both repos consume one source of truth instead of copy-paste drift.

**Data:** keep a single Postgres owned by RachBase for now (users, tenants, credits, subscriptions, VMs). RachDev reads/writes agent-specific tables (`agent_sessions`, messages) — decide later whether those move to a RachDev-owned schema. Splitting the DB is the highest-risk step; defer it past the rename.

---

## 5. Phased execution (proposed — for when you greenlight code work)

**Phase 0 — Freeze & branch.** Tag current `main` on both repos. Create `split/*` branches. No user-facing change.

**Phase 1 — Define the RachBase boundary.** Introduce a `RachBaseClient` inside the current backend that wraps `deployRunner`, `sshKey`, and credit operations behind function calls. `agentController` calls the client instead of importing services directly. Still one process — this just draws the seam.

**Phase 2 — Extract shared core.** Move auth/db/user/email/SMS into `@rach/core`. Both future repos import it. Verify nothing broke in one codebase first.

**Phase 3 — Split the backend.** Create `rachbase-backend` (cloud controllers/routes/services/models + core). Create `rachdev-backend` (agent controller/routes + core). Replace the in-process `RachBaseClient` with an HTTP client + service token. Wire RachDev → RachBase auth (shared JWT / introspection).

**Phase 4 — Split the frontend.** `rachbase-web` = the dashboard + BaaS marketing. `rachdev-web` = agent/demo + agent-builder marketing. Shared UI kit → `@rach/ui`. Point each at its own backend.

**Phase 5 — Rename & rebrand.** Apply the naming changes in §6, set up domains (§7), update all copy/docs (see companion branding doc).

**Phase 6 — Deploy & cut over.** Stand up RachBase prod first (it's the dependency), then RachDev. Run both old and new in parallel behind feature flags / DNS before retiring the monolith.

---

## 6. Naming changes checklist (Phase 5)

- Folder/repo: `rach-dev_backend` → split into `rachbase-backend` + `rachdev-backend`.
- `package.json` names: `rach-dev-temp` → `rachdev-web`; `rach-dev_backend` → per-repo names.
- `~81` frontend + `~12` backend string references to `rach-dev`/`RachDev` — reassign per §3 (cloud strings → RachBase, agent strings → RachDev). Do this per-repo *after* the split, not before, to avoid churn.
- API base paths: cloud routes can move under a RachBase host; keep `/api/...` stable to limit client changes.
- Env vars, deploy keys (`rachdev_deploy.pub`, `rach-dev-india` GitHub App key), GPG assets: duplicate/rename per repo.
- Favicon, `icon.svg`, OpenGraph images, `sitemap.ts`, `robots.ts`: brand-specific per app.

---

## 7. Domains & infra (decide before Phase 6)

Open questions to settle: production domains for each brand (e.g. `rachdev.*` for agent builder, `rachbase.*` for cloud); whether they share an SSO domain; separate Razorpay accounts or one; separate Prometheus/monitoring stacks or shared; CI/CD per repo. None block the plan, but they shape Phase 3–6.

---

## 8. Risks & how to de-risk

- **Agent→infra coupling (highest).** Mitigation: Phases 1–3 turn the in-process dependency into an API contract *before* physically splitting. Don't skip Phase 1.
- **Shared-code drift.** Mitigation: `@rach/core` package, not copy-paste.
- **DB split.** Mitigation: don't. Keep one RachBase-owned DB through the rebrand; revisit later.
- **Auth across two apps.** Mitigation: RachBase is the identity provider; RachDev validates RachBase-issued tokens.
- **Broken marketing SEO on rename.** Mitigation: 301 redirects, updated sitemaps, keep URL slugs where possible.

---

## 9. Immediate next steps

1. Review this split direction (RachBase = platform, RachDev = consumer). If you disagree with the dependency direction, that changes Phases 1–3.
2. Approve the branding/positioning (companion doc: `RachBase_Branding_and_Docs.md`).
3. When ready for code, greenlight **Phase 1** — it's low-risk and reversible, and it's the seam everything else depends on.
