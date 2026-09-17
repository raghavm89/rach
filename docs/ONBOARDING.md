# RachBase — Engineering Onboarding

Welcome, Eshan. This is the fast path to being productive in the `rach-platform` monorepo. It's the map: how the pieces fit, how to run it, where the important logic lives, and what's open to pick up. Everything here is heading to production, so treat `main` as shippable.

> Companion docs: root `README.md` (layout), `docs/RachBase-ARKA-GoLive-Whats-Left.docx` (remaining launch work), `docs/DATABASE_TOPOLOGY.md`, `docs/BILLING.md`, `docs/AUTHENTICATION.md`, `docs/site-controller-rbac-diagram.html`.

---

## 1. The one mental model

It's a **monorepo of two brands sharing one core**:

- **RachBase** (`apps/rachbase-*`) — the India-first developer cloud: deploy services, a Supabase-shaped Backend-as-a-Service, VMs, billing. *This is what we're launching.*
- **RachDev** (`apps/rachdev-*`) — AI agent builder. Separate product, same shared packages. Mostly out of scope for launch.
- **`packages/@rach/*`** — shared libraries both apps import (auth, billing, db, UI, etc.). Change these carefully: two apps depend on them.

Within RachBase there are **two planes** — keep them straight, it explains most of the design:

- **Control plane** — our own servers (`rachbase-backend` = the BFF/API, `rachbase-web` = the dashboard, one shared Postgres). Owns users, tenants, projects, billing.
- **Data plane** — the customer's stuff running on **ARKA's Kubernetes** (SpaceArk). We never touch their cluster directly; we submit *desired state* and a **site-controller** running in ARKA reconciles it. Each customer project also gets its own BaaS stack + its own database.

---

## 2. The repo at a glance

### Apps (`apps/`)
| App | What it is |
|---|---|
| `rachbase-web` | Next.js dashboard + marketing site (port 3002). |
| `rachbase-backend` | The BFF / control-plane API (Express). Billing, projects, deploy orchestration, BaaS admin, status. |
| `baas-auth` / `baas-gateway` / `baas-storage` / `baas-functions` / `baas-services` | The per-project BaaS runtime (Supabase-shaped: GoTrue-style auth, PostgREST, storage, edge functions), fronted by a gateway. Deployed **per customer project** into ARKA. |
| `site-controller` | Runs **inside ARKA**. Reconciles our CRDs (TenantClaim/App/Release) into real k8s objects. The RachBase↔ARKA contract lives here. |
| `runtime-agent` | Agent that runs on tenant VMs (the VM deploy path). |
| `rachdev-*` | The other brand — ignore for RachBase launch. |

### Packages (`packages/`)
| Package | Import | Role |
|---|---|---|
| `core` | `@rach/core` | DB pool, `validateEnv`, middleware, brevo/sms, shared models. |
| `identity` | `@rach/identity` | Auth, users, roles, tenancy. Shared by both apps. |
| `billing` | `@rach/billing` | Razorpay, pricing (`proPricing`), tax engine, invoices, `paymentSecurity`. |
| `baas` | `@rach/baas` | BaaS primitives — JWT minting, signing, API keys, realtime. |
| `ui` | `@rach/ui` | Shared React components + the web `lib/api.ts` client. |
| `site-contracts` | — | The DTOs/route shapes of the ARKA site API (single source of truth for the contract). |
| `rachbase-js` | `@rachbase/js` | Public supabase-js-shaped SDK for customers. |
| `deploy`, `llm` | — | Deploy engine/GitHub App; LLM helpers (RachDev-leaning). |

---

## 3. Local setup

**Prereqs:** Node 20+, a local Postgres, and `npm` (the repo uses npm workspaces — install once from the root).

```bash
npm install                      # root — installs all workspaces
# Postgres: create a DB and set env (see below), then:
npm run core:migrate             # applies packages/core/src/db/migrations/*.sql in order
```

**Environment:** copy `apps/rachbase-backend/.env.example` → `.env` and fill it. Either set `DATABASE_URL` **or** the individual `DB_HOST/PORT/NAME/USER/PASSWORD`. `validateEnv` (in `@rach/core`) fails fast on missing vars and **refuses placeholder/short secrets in production** — in local dev those are warnings, so a short dummy secret is fine locally.

**Run (each in its own shell):**
```bash
npm run dev  -w rachbase-backend      # control-plane API
npm run dev  -w rachbase-web          # dashboard on :3002
```
The BaaS apps and `site-controller` are normally exercised via tests locally; they run for real inside ARKA. `site-controller` has a demo harness: `node index.js provision-demo` / `teardown-demo`.

---

## 4. Test & conventions

- **Tests are `node --test`** (no Jest). Run per workspace: `npm test -w rachbase-backend`, `-w baas-auth`, `-w site-controller`, `-w @rach/billing`, etc. Many suites use **pglite** for a real-Postgres-in-memory harness.
- **Pure logic is extracted and unit-tested; DB/network is injected** (`deps` params) so tests don't need live services. Follow that pattern — see `apps/rachbase-backend/src/services/proTax.js` (+ its test) as the model.
- **Migrations** are numbered SQL in `packages/core/src/db/migrations/NNN_*.sql`, applied in order, each idempotent (`IF NOT EXISTS`) with a reversal comment. Next number wins — we're at `131_*` now. Never edit a shipped migration; add a new one.
- **Money is integer minor units** (paise/cents) end-to-end. Never floats.
- **Secrets** never get committed (`.gitignore`/`.dockerignore` cover `secrets/`, `.env`, keys). See `docs/RUNBOOK-secret-rotation.md`.

---

## 5. Key flows (with where to look)

**Auth / identity** — `@rach/identity` (`packages/identity/src`): users, roles, tenancy, JWT. Data-principal (DPDP) rights: `controllers/userController.js` (`/me/export`, `DELETE /me`).

**Billing** — the important one.
- Pricing authority: `packages/billing/src/proPricing.js` (geo-native: INR ₹500/₹1,500 ex-GST vs USD). Never trust a client amount.
- **GST**: amounts are ex-GST; `apps/rachbase-backend/src/services/proTax.js` grosses them up via the tax engine (`@rach/billing` `services/tax`), and it's **fail-closed** (a tax outage rejects checkout rather than minting a mispriced recurring plan). Invoices are issued on payment verify and reconcile to the charge.
- Payment integrity: `paymentSecurity.js` + `apps/rachbase-backend/src/services/paymentVerify.js` (`assertOrderPaid` — captured-amount check, closes the pay-cheap/verify-expensive bypass).
- Subscriptions/lifecycle: `apps/rachbase-backend/src/services/proSubscription.js` (base + per-container Razorpay subs, teardown on cancel).

**Deploy → ARKA** — the control plane writes desired state; the site-controller reconciles.
- BFF side: `apps/rachbase-backend/src/services/siteApp.js` / `siteTenant.js` / `siteOutbox.js` (transactional outbox → site API), `siteClient.js` (transport, mTLS in prod).
- ARKA side: `apps/site-controller` — `src/api/facade.js` (auth + idempotency + writes request CRDs), `src/reconcilers/*` (converge k8s objects), `src/renderers/manifests.js` (what gets applied), `deploy/*.yaml` (RBAC). Read `docs/site-controller-rbac-diagram.html` for the namespace/RBAC picture.
- Source-only images: **no bring-your-own Docker images** — deploy from a GitHub repo (platform builds/signs) or managed Postgres. Enforced in `createService`.

**BaaS (per project)** — `apps/baas-*` + `@rach/baas`. Auth is Supabase-shaped (`/auth/v1`), storage is per-ref namespaced on a shared filer (`apps/baas-storage`), realtime over WS. Control-plane config for a project's auth lives in `apps/rachbase-backend/src/lib/baasAuthConfig.js`.

**Status / SLA** — `apps/rachbase-backend/src/services/statusService.js` (+ `statusProber.js`) → public `/status`; SLA at `/legal/sla` (99.95%).

**DB topology** — read `docs/DATABASE_TOPOLOGY.md`: one control-plane Postgres + one DB per BaaS project (`baas_<ref>`) + tenant VM Postgres.

---

## 6. Gotchas worth knowing early

- **Two planes, one contract.** Anything crossing to ARKA goes through `site-contracts` DTOs + the outbox; don't call the cluster directly.
- **`SITE_CONTROLLER_NAMESPACE` must equal `spaceark-site-system`** or per-tenant RoleBindings grant nothing (reconciles fail forbidden). See the RBAC diagram.
- **CRDs are declarative/mutable** (server-side apply) — the BFF owns `spec`, the reconciler owns `status`; they never cross.
- **Web has two copies of some UI** (dashboard vs marketing `@rach/ui`). Pricing copy lives in both `apps/rachbase-web/src/app/dashboard/billing/page.tsx` and `packages/ui/src/components/sections/PricingSection.tsx` — change both.
- **`tsc --noEmit` in `rachbase-web`** before pushing web changes; run the relevant `node --test` suite for backend changes.

---

## 7. What's open to pick up

The full launch checklist (split RachBase vs ARKA, with priorities) is in **`docs/RachBase-ARKA-GoLive-Whats-Left.docx`**. Good first-week candidates that are self-contained and code-side:

- **Container monitoring UI** — backend queries an ARKA per-namespace metrics endpoint, dashboard renders CPU/mem/restarts. Mirrors the existing VM-monitoring pattern; no site-controller change. (Blocked on ARKA exposing the endpoint — good one to spec + stub.)
- **Runtime/deploy logs** — surface build + pod logs (needs the ARKA logs API; can start with the UI + client seam).
- **Container persistence (PVC)** — the real fix behind the current "no stateful images" guardrail: App CRD volume field + StatefulSet rendering in `site-controller` (needs an ARKA StorageClass).
- **RBAC/bundle cleanup** — standardize the site-controller on one bundle (all-in-one vs split) and remove the stale rolebindings/SAs.
- **Frontend polish** — dark-mode stragglers, consolidating the money-formatting helpers.

Pattern for any pickup: find the pure logic, add/extend a `node --test` suite with injected deps, wire it, run the suite + `tsc`. When in doubt, grep for a similar recent service (e.g. `proTax`, `paymentVerify`, `hostRegistry`) and follow its shape.

---

## 8. Where the deep docs are

`docs/` has topic deep-dives: `BILLING.md`, `BILLING_TAX_INVOICING.md`, `AUTHENTICATION.md`, `DATABASE_TOPOLOGY.md`, `FIRST_DEPLOY.md`, `RachBase_SpaceArk_Integration_*.md`, `RUNBOOK-secret-rotation.md`, and the go-live audit/plan files. Start with this file, then `DATABASE_TOPOLOGY.md` and `BILLING.md`, then the SpaceArk integration doc + the RBAC diagram for the ARKA side.

Ping Raghav for the `.env` values and ARKA/test-cluster access. Welcome aboard.
