# Sprint 1 — Scaffold (monorepo: rach-platform)

Status: **Done and tested** — backend + shared seam + the authenticated clinical workspace shell in `rachdev-web`. This is the B9 seam from `integration-and-ui-architecture.md`, re-homed for the monorepo's package split. The old flat repo (`~/RachDev`) is deprecated; this is the source of truth.

**Decision taken:** the healthcare workspace UI lives as a **new authenticated area in `rachdev-web`** (`/dashboard`), not in the rachbase-web dashboard — RachDev is the agent product.

## Monorepo mapping (vs the old flat repo)

| Concern | Old flat repo | Monorepo home |
|---|---|---|
| Migrations | `BackEnd/.../db/migrations` | `packages/core/src/db/migrations` |
| RBAC `authorize` | `BackEnd/.../middleware/role.js` | `@rach/identity` (`authorize`) |
| Role list | (enum only) | `@rach/identity` `ROLES` + enum migration |
| LLM provider layer | (new `agentProvider.js`) | **`@rach/llm` gateway** (already existed) + a `vllm` adapter |
| Agent model | `models/agentDefinition.js` | `@rach/core` (`AgentDefinition`) |
| Agent controller/routes | `BackEnd/.../agent*` | `apps/rachdev-backend/src/{controllers,routes}` |
| Shared `User`/`UserRole` | `FrontEnd/.../lib/api.ts` | `@rach/ui` `src/lib/api.ts` |
| Marketing agent demo | `FrontEnd/.../industry-demo` | `apps/rachdev-web/src/components/industry-demo` |
| Dashboard shell | `FrontEnd/.../(dashboard)` | **`apps/rachbase-web/src/app/dashboard`** (not rachdev-web) |

## What was built

**Backend (shared packages + rachdev app)**
- `packages/identity/src/models/user.js` — `ROLES` extended with `doctor`, `reception`, `store_manager`.
- `packages/core/src/db/migrations/043_clinical_roles.sql` — enum values for the three roles.
- `packages/core/src/db/migrations/044_agent_definitions.sql` — `agent_definitions` (the persisted AgentSpec).
- `packages/core/src/models/agentDefinition.js` + exported from `@rach/core` barrel.
- `packages/llm/src/providers/vllm.js` — on-prem (Sarvam) adapter, **stubbed** until the vLLM endpoint is wired.
- `packages/llm/src/gateway.js` — registers `vllm` in `PROVIDERS`.
- `packages/llm/src/models.js` — catalog entries `sarvam-105b` / `sarvam-30b` (provider `vllm`, multiplier 0 = not metered); `DEFAULT_MODEL` now reads `LLM_DEFAULT_MODEL` (the deploy-profile switch: cloud→Claude, on-prem→Sarvam).
- `apps/rachdev-backend/src/controllers/agentController.js` — `listDefinitions` / `createDefinition` / `updateDefinition`.
- `apps/rachdev-backend/src/routes/agent.js` — `GET/POST/PUT /api/agent/definitions`.

**Frontend (shared + rachdev-web) — RachBase intentionally untouched**
- `@rach/ui` `src/lib/api.ts` — added `User.tenant_industry` (optional). The shared **`UserRole` union is left at the base four roles** on purpose: widening it would force exhaustive `Record<UserRole>` fixes in rachbase-web. Clinical roles live at the data layer (DB enum migration 043 + `@rach/identity` `ROLES`); rachdev-web gates its workspace nav on `string[]` role lists, so it needs no TS-union change and RachBase is not modified.
- `apps/rachdev-web/src/data/industries.ts` — `Industry.workspace` config; filled for `medical`.
- `apps/rachdev-web/src/lib/agentFeed.ts` + `ControlTower` `source` prop — mock/live data seam.
- `apps/rachdev-web/src/app/dashboard/**` — authenticated clinical workspace shell (see below).

## Authenticated workspace shell (rachdev-web) — built

`rachdev-web` had no authenticated area (it was marketing + agent demo), so we stood one up:
- `apps/rachdev-web/src/app/dashboard/layout.tsx` — auth-guarded shell (uses `@rach/ui` `useAuth`, redirects to `/login`), sidebar with **role- + industry-gated** nav (the same `tenant.industry === 'healthcare'` + role filter).
- `apps/rachdev-web/src/app/dashboard/clinical/{control-tower,scribe,reception,inventory,audit}/page.tsx` — the 5 route shells.
- `apps/rachdev-web/src/components/clinical/ClinicalPlaceholder.tsx` — placeholder (shared design tokens).
- `apps/rachdev-web/src/components/SiteChrome.tsx` — `/dashboard` added to `BARE_PREFIXES` so the workspace skips the marketing navbar/footer.

`AuthProvider` is already mounted at the rachdev-web root layout, so no provider wiring was needed.

## How to run / verify

```bash
# Backend tests (no DB needed)
cd apps/rachdev-backend && npm test            # 13 tests

# Apply migrations (needs Postgres + env)
npm run migrate -w @rach/core

# Frontend typecheck
cd apps/rachbase-web && npx tsc --noEmit        # 0 errors
cd apps/rachdev-web  && npx next build          # use Next (raw tsc can't resolve @rach/ui subpaths)
```

## Sprint-1 verification results

- Backend: **13/13 node:test pass** (gateway registers vllm; Sarvam→vllm; vllm stub rejects clearly; Claude default intact; RBAC incl. clinical roles; identity ROLES; migrations; model; controller). All touched JS passes `node --check`.
- `rachbase-web`: **untouched** — clean vs HEAD (the base-four `UserRole` union means no rachbase-web changes were needed).
- `rachdev-web`: **0 new type errors** (incl. the new `/dashboard` shell) — the only tsc errors are the pre-existing `@rach/ui/*` subpath-resolution quirk that affects the whole app under raw tsc (resolved by `next build`).

## tenant_industry wiring — done

So the workspace nav renders for a hospital tenant, `tenant_industry` now flows end to end (all in shared packages — **no rachbase app files touched**):
- `packages/core/src/db/migrations/045_tenant_industry.sql` — adds `tenants.industry`.
- `@rach/identity` `user.js` — `SAFE_FIELDS` + `findByEmail` / `findByPhone` now select `t.industry AS tenant_industry`.
- `@rach/identity` `authController.js` — `publicUser` returns `tenant_industry`; the access-token JWT carries it too (so `req.user.tenant_industry` is available for backend authz later).
- `@rach/ui` `User.tenant_industry` (already added) — the rachdev-web nav reads `user.tenant_industry === 'healthcare'`.

**Enable a healthcare tenant — from RachDev (no RachBase needed).** A tenant_admin sets their own tenant's industry in-app:
- UI: RachDev dashboard → **Settings** (`/dashboard/settings`) → choose **Healthcare** → Save. The nav updates immediately (session `tenant_industry` is patched client-side).
- API: `PATCH /api/tenant/industry { "industry": "healthcare" }` (auth: tenant_admin/admin), `GET /api/tenant` reads it. Backend: `apps/rachdev-backend` `tenantController` + `routes/tenant.js` (scoped to the caller's own tenant; RachBase's system-level tenant admin is untouched). Shared API method: `@rach/ui` `workspace.get` / `workspace.setIndustry`.
- SQL alternative (pilot): `UPDATE tenants SET industry = 'healthcare' WHERE id = <tenant_id>;`

The **Settings** nav item is not industry-gated, so a tenant_admin can reach it before any industry is chosen (bootstraps the workspace).

## Sprint-2 notes

- Wire `useAgentFeed(config, 'live')` to `/api/agent/...` SSE, and render the live ControlTower inside `dashboard/clinical/control-tower`.
- Seed platform-template `agent_definitions` for `scribe` / `reception` / `inventory`.
- Build Nora (Scribe) into `dashboard/clinical/scribe` as the first real agent.
- (Optional) add an `industry` selector to tenant management — that screen is in rachbase-web, so touch only if you want it there.
