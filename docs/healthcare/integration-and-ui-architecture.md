# RachDev × Hospital UI — Integration & UI Architecture

Status: Draft for discussion · Owner: Raghav
Companion to `phase1-ai-architecture.md` and `phase1-poc-plan.md`.

Goal: make the RachDev product and the hospital-facing UI **one product** — one codebase, one design system, one data model — deployed two ways. This doc has two parts: **(A)** the integration model, and **(B)** a concrete, build-ready Next.js structure for Sprint 1.

---

# Part A — Integration model

## A1. Two senses of "one" (settle this first)

- **One product / codebase / UX — yes.** The hospital UI is not a separate app. It is a **healthcare workspace inside the existing RachDev app**, shown to the right people via the multi-tenant + RBAC machinery that already exists.
- **One running server for both rachdev.com and the hospital — no.** For a military/AFMS site the hospital instance runs **on-prem and air-gapped**, separate from the public cloud. Same code, **two deployment profiles**. Unification is at the code/UX/data-model level, not a shared live server.

## A2. The unifying spine — the agent definition

The single object that makes portal and hospital UI genuinely one thing is the **agent definition** (`AgentSpec`): role, tools, guardrails, and model binding (`provider: claude | vllm | ollama`).

- In the **portal** (agent-builder) you *configure* an agent → writes an `AgentSpec` record.
- In the **hospital workspace** you *operate* that same agent → the runtime executes the same record.
- The **runtime** resolves `provider` to Claude (cloud POC) or on-prem models (production) with no code change.

Make `AgentSpec` a first-class DB object now. That is the seam that stops the portal and the hospital UI from drifting into two products.

## A3. How one app renders different UIs

Resolution order on every authenticated load:

1. **`tenant.industry`** decides which *workspace* is available (e.g. `healthcare` unlocks the clinical workspace). Already modelled in `lib/industries/` — extend it from marketing config to workspace config.
2. **`user.role`** decides which *views* inside that workspace are visible. Already enforced by the `roles?: string[]` filter on `NAV_ITEMS` in the dashboard layout.

| Role | Workspace view |
|---|---|
| `doctor` | Scribe — dictate, SOAP note, sign-off |
| `reception` | Reception intake companion (→ built over Dhanvantri in production) |
| `store_manager` | Inventory + shortage alerts (Kiran) |
| `tenant_admin` (hospital admin) | Control Tower + audit log |

The public `agents/medical` marketing page and the authenticated Control Tower are the **same components** (`industry-demo/*`) with the data source swapped: mock for the public demo, live agent API when logged in.

## A4. What's shared vs profile-specific

| Layer | Shared (one codebase) | Differs by deployment profile |
|---|---|---|
| UI shell, design system, components | ✅ same | — |
| Auth, RBAC, tenant model | ✅ same | Cloud multi-tenant vs on-prem single-tenant |
| Agent definitions / runtime / audit | ✅ same | — |
| Model binding | ✅ same `AgentSpec` | `provider: claude` (cloud) vs on-prem `Sarvam/IndicWhisper` |
| Network posture | — | Cloud vs air-gapped, no egress |
| Billing / self-serve onboarding | code present | Enabled in cloud; disabled/licensed on-prem |

Net principle: **don't build a separate hospital app — extend RachDev with a healthcare workspace + clinical roles, and ship it as an on-prem build profile.**

---

# Part B — Concrete Next.js structure (build-ready for Sprint 1)

Grounded in the real repo: `FrontEnd/rach-dev` (Next.js 14, route groups, `NAV_ITEMS` RBAC) and `BackEnd/rach-dev_backend` (Express, `agentController`, `middleware/role.js`, Postgres).

## B1. Frontend — new clinical workspace routes

Add under the existing dashboard route group (reuses its layout, auth guard, and nav):

```
FrontEnd/rach-dev/src/app/(dashboard)/dashboard/clinical/
  control-tower/page.tsx     # Atlas view — live AgentRoster + handoff pipeline
  scribe/page.tsx            # Doctor: record → transcript → SOAP → sign-off
  reception/page.tsx         # Reception intake companion
  inventory/page.tsx         # Store manager: stock + shortage alerts (Kiran)
  audit/page.tsx             # Audit log view + export
  layout.tsx                 # (optional) clinical sub-shell / guards industry===healthcare
```

## B2. Frontend — nav (extend the existing RBAC-filtered `NAV_ITEMS`)

In `app/(dashboard)/dashboard/layout.tsx`, add items gated by role **and** (new) by `tenant.industry`:

```tsx
// new clinical roles: 'doctor' | 'reception' | 'store_manager'  (tenant_admin = hospital admin)
{ label: 'Control Tower', href: '/dashboard/clinical/control-tower', roles: ['tenant_admin'],            industry: 'healthcare' },
{ label: 'Scribe',        href: '/dashboard/clinical/scribe',        roles: ['doctor'],                   industry: 'healthcare' },
{ label: 'Reception',     href: '/dashboard/clinical/reception',     roles: ['reception'],                industry: 'healthcare' },
{ label: 'Inventory',     href: '/dashboard/clinical/inventory',     roles: ['store_manager','tenant_admin'], industry: 'healthcare' },
{ label: 'Audit',         href: '/dashboard/clinical/audit',         roles: ['tenant_admin'],             industry: 'healthcare' },
```

Extend the `NavItem` interface with an optional `industry?: string`, and add one clause to the existing `visibleItems` filter:

```tsx
if (item.industry && tenant?.industry !== item.industry) return false;
```

## B3. Frontend — reuse the demo components as live views

`src/components/industry-demo/{ControlTower,AgentRoster,Governance,OperatingPicture}.tsx` are already built (currently fed by `src/data/mock` / `src/lib/demo`). Make them dual-source:

- Add a `source: 'mock' | 'live'` prop (or a `useAgentFeed()` hook in `lib/api.ts`).
- Public `agents/medical` → `mock` (unchanged marketing demo).
- Authenticated `clinical/control-tower` → `live`, calling the agent API (`/api/agent/...`).

This keeps one component powering both the pitch and the product.

## B4. Frontend — industry config becomes workspace config

`lib/industries/types.ts` — extend the `Industry` interface (which already has `agentDemoSlug`) with a live-workspace block:

```ts
workspace?: {
  enabled: boolean;
  roles: string[];                 // clinical roles this workspace introduces
  views: { key: string; href: string; roles: string[] }[];
};
```

Fill it in `lib/industries/medical.ts`. Now an industry isn't just marketing — it declares the workspace it provisions.

## B5. Backend — agent definition as a first-class object

The seam from Part A2. In `BackEnd/rach-dev_backend/src`:

- `models/agentDefinition.js` (new) + migration → table `agent_definitions` (`id, tenant_id, key, role, tools jsonb, guardrails jsonb, provider, model, prompt, enabled`). This *is* the persisted `AgentSpec`.
- `routes/agent.js` (exists) → add CRUD: `GET/POST/PUT /api/agent/definitions` (builder), consumed by both the portal builder and the workspace.
- `controllers/agentController.js` (exists) → introduce a **provider layer**: read `definition.provider` and route to Claude SDK (now) or the on-prem gateway (later). This replaces the hardcoded Anthropic client with an `AgentSpec`-driven resolver.

## B6. Backend — clinical roles + RBAC

- `middleware/role.js` + the user model → add roles `doctor`, `reception`, `store_manager`. Reuse `tenant_admin` as hospital admin.
- Gate the new endpoints with the existing `authorize(...)` helper (already used in `routes/agent.js`).

## B7. Backend — inventory (Kiran) data + notify

From `phase1-ai-architecture.md` §10:

- Tables: `drug_stock (drug, qty, reorder_threshold, unit)`, `stock_transaction (drug, delta, encounter_id, ts)`, `reorder_alert (drug, qty_suggested, status, ts)`.
- Endpoints: `POST /api/agent/inventory/consume` (called on approved Rx), `GET /api/agent/inventory/alerts`, `POST /api/agent/inventory/reorder` (stage-only, manager approves).
- Notify: reuse existing `services/sms.js` + `services/brevo.js` for the store-manager shortage alert.

## B8. Deployment profile switch

One config/env flag drives cloud vs on-prem, no code fork:

```
DEPLOY_PROFILE=cloud        # multi-tenant, provider=claude, billing on
DEPLOY_PROFILE=onprem       # single-tenant, provider=vllm (Sarvam/IndicWhisper), egress off, billing off
```

Read it in backend config + the `AgentSpec` provider default. The on-prem profile also swaps ASR to IndicWhisper and disables outbound network for PHI paths.

## B9. Sprint-1 build checklist (the seam, before the agents)

1. `models/agentDefinition.js` + migration (persisted `AgentSpec`).
2. Provider layer in `agentController.js` (`provider: claude` wired; `vllm` stubbed).
3. Clinical roles in `middleware/role.js` + user model.
4. `NavItem.industry` + the one filter clause; add the 5 clinical nav items.
5. Scaffold the 5 `dashboard/clinical/*` route files (empty shells).
6. `workspace` block on the `Industry` type + `medical.ts`.
7. `useAgentFeed()` in `lib/api.ts` + `source` prop on `ControlTower`.

That is the minimum "one product" seam. The POC agents (Nora, Ava, Kiran) then fill these shells in Sprint 2–3 — and everything built here is reusable platform code, not demo scaffolding.
