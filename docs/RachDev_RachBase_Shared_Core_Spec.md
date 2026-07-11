# Shared Core / Submodule Spec — RachDev & RachBase

**Date:** 2026-07-11
**Companion to:** `RachDev_RachBase_Split_Plan.md`, `RachDev_Agent_Deployment_Plan.md`, `RachBase_Container_Service_Plan.md`
**Purpose:** Define exactly what code is shared between RachDev and RachBase, how it's packaged, and which files map where — so both codebases consume one source of truth instead of drifting copies.

---

## 1. Principle

Three pillars are shared by decision: **Auth**, **Payment gateway (billing + credits)**, and **AI APIs + Agent deployment**. Around those sit the plumbing both apps need anyway (DB, middleware, notifications, UI kit). All of it lives in versioned shared packages; RachDev and RachBase depend on those packages rather than copy-pasting.

**Key constraint:** a single submodule can't cleanly hold both backend (Node) and frontend (React) code. Shared code is therefore split into **focused packages**, grouped as backend vs frontend.

---

## 2. Package layout

```
@rach/core          (backend)  db, config, middleware, notifications
@rach/identity      (backend)  auth, users, roles, tenancy
@rach/billing       (backend)  payments (Razorpay) + credits/metering
@rach/deploy        (backend)  deploy engine + GitHub App
@rach/llm           (backend)  LLM gateway / provider adapters  [see note §4]
@rach/ui            (frontend) design system + client foundation
```

Both apps import the backend packages in their API; both frontends import `@rach/ui`. Brand-specific code (cloud controllers, agent builder, dashboards, marketing content) stays in each app and is **not** shared.

---

## 3. Exact file-to-package mapping

Source paths are relative to today's monorepo:
`BackEnd/rach-dev_backend/src/` and `FrontEnd/rach-dev/src/`.

### `@rach/core` (backend plumbing)

| File (today) | Notes |
|---|---|
| `config/db.js` | Postgres pool. Shared even if DBs split later (connection tooling). |
| `config/env.js` | Env loading; pairs with the GPG-encrypted env pattern. |
| `db/migrate.js` | Migration runner + `0XX_*.sql` convention. |
| `middleware/asyncHandler.js` | Async error wrapper. |
| `middleware/parseId.js` | Route param parsing. |
| `middleware/paginate.js` | List pagination. |
| `middleware/rateLimit.js` | Rate limiting. |
| `middleware/idempotency.js` | Idempotent request handling. |
| `models/idempotencyKey.js` | Backs idempotency middleware. |
| `models/webhookEvent.js` | Webhook dedupe/audit (payments + GitHub). |
| `services/brevo.js` | Transactional email. |
| `services/sms.js` | SMS/OTP. |
| app scaffolding (from `app.js`) | CORS, helmet, morgan, central error handler, `/health`, `/ready`. Extract into a `createApp()` factory. |

### `@rach/identity` (backend)

| File (today) | Notes |
|---|---|
| `controllers/authController.js` | Login/register/refresh. |
| `routes/auth.js`, `routes/oauth.js` | Auth + Google/GitHub OAuth. |
| `controllers/userController.js`, `routes/users.js` | User CRUD/profile. |
| `models/user.js` | User model. |
| `models/refreshToken.js` | Refresh tokens. |
| `models/verification.js` | Email/OTP verification. |
| `middleware/auth.js` | JWT authenticate. |
| `middleware/role.js` | `authorize(...)` RBAC. |
| tenancy | `tenants` handled via SQL (no `tenant.js` model today). Add a `Tenant` model here as the shared home for tenant scoping. |

*Decision:* identity is the natural **identity provider** — RachBase issues tokens, RachDev validates them (per split plan). Keep the issuing logic here.

### `@rach/billing` (backend)

| File (today) | Notes |
|---|---|
| `services/razorpay.js` | Razorpay client. |
| `controllers/paymentController.js`, `routes/payments.js` | Checkout, webhook, verify. |
| `models/plan.js`, `order.js`, `payment.js`, `subscription.js` | Billing models. |
| credits/metering | `tenant_credits` logic (currently inline in `agentController`: `getOrCreateBalance`, `deductCredits`, credit packs). **Extract into a shared `credits` module** — both the RachBase deploy agent and RachDev LLM gateway spend credits. |

*Decision to confirm (§6):* does metering live here as shared, or is it RachBase-owned with an API RachDev calls?

### `@rach/deploy` (backend)

| File (today) | Notes |
|---|---|
| `services/deployRunner.js` | Git-based deploy over SSH. |
| `services/sshKey.js` | SSH key provisioning. |
| GitHub App integration | Installation-token logic (currently duplicated in `deployRunner` + `deploymentController` — dedupe into one place here). |

*Note:* the deploy engine is shared, but **who calls it** differs — RachBase calls it in-process; RachDev calls it via the RachBase API (split plan Phase 3). The engine code is the shared unit; the transport is per-app.

### `@rach/llm` (backend) — see §4

The LLM gateway from the Agent Deployment Plan (provider adapters, model catalog, key resolution, metering hook). Shared *if* the RachBase deploy agent and RachDev agents should use one gateway. Otherwise RachDev-only.

### `@rach/ui` (frontend)

| File (today) | Notes |
|---|---|
| `components/ui/*` | Button, Card, Input, Badge, Select, PricingCard, SectionHeader, etc. |
| `components/forms/*` | Form primitives. |
| Tailwind config + tokens | `tailwind.config.ts`, `globals.css`, fonts. |
| `lib/api.ts` | Typed API client. |
| `lib/utils.ts` | Shared helpers. |
| `providers/query-provider.tsx` | React Query provider. |
| `lib/server/env.ts`, `lib/server/email` | Server-side helpers. |
| `contexts/AuthContext.tsx` | Client auth state (part of Auth pillar). |

*Decision (§6):* is the UI kit truly shared, or forked per brand for distinct looks? Recommended: **shared primitives, per-brand theme tokens** — one kit, two themes.

---

## 4. What is NOT shared (stays in each app)

**RachBase only:** `deploymentController`, `monitoringController`, `tenantController`, `vmAssignmentController`, `expansionController`, `planController` (catalogue admin), cloud services `prometheus.js`, `alertMonitor.js`, `terminalServer.js`; models `plan` catalogue admin; the entire `(dashboard)` UI, `TerminalContext`, `VMHistoryModal`; future container product code; cloud marketing (`products/baas`).

**RachDev only:** the agent builder — `agentController` (minus the credit/deploy bits that move to shared), agent registry/runtime orchestration, `ChatContext`, `components/chat`/`demo`/`industry-demo`, agent marketing (`products/agent-builder`), demo/industry/template data.

**Note on `agentController`:** today it mixes three concerns — agent chat (RachDev), credit spend (→ `@rach/billing`), and deploy/SSH (→ `@rach/deploy`). Splitting it is Phase 1 of the agent work: keep chat in RachDev, move credits and deploy calls to shared packages.

---

## 5. Packaging & mechanics

**Recommendation: private npm packages in a workspace (monorepo), not raw git submodules.**

- Submodules pin a commit and are clumsy for versioning + CI; npm packages give you semver, changelogs, and clean dependency resolution.
- A pnpm/npm workspace can hold `packages/*` (the `@rach/*` above) plus `apps/rachbase` and `apps/rachdev` — shared code and both apps versioned together, published or linked internally.
- If you must stay multi-repo, publish `@rach/*` to a private registry (GitHub Packages) and depend by version. Use a git submodule **only** as a last resort.

**Versioning rule:** shared packages are semver'd; apps pin versions and upgrade deliberately. Breaking a shared package = a major bump, not a silent break in both apps.

**Migration path from today:** extract packages *in place* first (split plan Phase 2) while still one codebase — prove nothing breaks — then physically separate the apps (Phase 3–4).

---

## 6. Open decisions

1. **Credits/metering ownership** — shared `@rach/billing` module, or RachBase-owned service with an API RachDev calls? (Affects whether RachDev can spend credits offline or must round-trip.)
2. **UI kit** — one shared kit with per-brand themes (recommended), or fully forked per brand?
3. **Database** — one shared DB (simplest, matches today) or split per app? Determines whether `@rach/core`'s DB layer is truly common or just a shared client against separate schemas.
4. **`@rach/llm` scope** — one gateway for both the deploy agent and the agent builder, or RachDev-only with RachBase keeping its own simple Anthropic call?
5. **Repo model** — monorepo workspace (recommended) vs multi-repo + private registry vs git submodule.

---

## 7. Summary table

| Package | Layer | Shared because |
|---|---|---|
| `@rach/core` | backend | Every service needs DB, config, middleware, email/SMS. |
| `@rach/identity` | backend | One auth/user/tenant system across both brands. |
| `@rach/billing` | backend | One payment + credits engine; both spend credits. |
| `@rach/deploy` | backend | Both use the same deploy engine (RachBase direct, RachDev via API). |
| `@rach/llm` | backend | Optional shared LLM gateway (decision §6.4). |
| `@rach/ui` | frontend | Consistent design system + client foundation. |
