# RachDev Product Audit — Toward a Multi-Industry Agent SaaS

**Date:** 2026-08-05
**Scope:** `apps/rachdev-web` (Next.js marketing site + dashboard) and `apps/rachdev-backend` (agent-builder API). Shared `packages/*` are noted only where RachDev depends on them.
**Out of scope (per instruction):** no RachBase app code is touched. This is an audit only — no source files were edited.
**Goal:** make RachDev sellable as a multi-industry SaaS with agent capability. Healthcare is the first live vertical; the dashboard shell should stay identical across industries while content varies by industry.

---

## How to read this

Findings are grouped by workstream and tagged by priority and effort:

- **P0** — blocks selling / correctness / security. Do first.
- **P1** — materially improves the product or unblocks multi-industry.
- **P2** — polish, hygiene, nice-to-have.

Effort is a rough S / M / L (hours / a day / multi-day).

The single highest-leverage finding: **the pricing page sells cloud infrastructure, not agents** (P0-1). The single biggest architectural gap: **the dashboard has a healthcare-only content layer bolted to a generic shell** (P1-6). Both are detailed below.

---

## 1. Positioning & pricing

### P0-1 — Pricing page sells the wrong product
`src/app/pricing/page.tsx` renders `PricingSection` from `@rach/ui`, which reads the shared **cloud catalog** (`packages/ui/src/lib/catalog`): VMs, block storage, load balancers, IPs, Managed PostgreSQL, VM snapshots, observability. That is RachBase's infrastructure product. An "AI Agent Builder" prospect lands on `/pricing` and sees VM and database line-items — nothing about agents, seats, credits, or templates.

The FAQ (`src/data/pricing.ts`) is the same story end-to-end: "What is included in a Virtual Machine?", "Managed PostgreSQL", "VM snapshot retention". None of it matches the agent product the homepage sells.

Meanwhile the backend already has a **real agent monetization model** — credits, usage, sessions, `credits/purchase`, `credits/verify` (`apps/rachdev-backend/src/controllers/agentController.js`). The pricing page doesn't reflect any of it.

> **Recommend:** define a RachDev-native pricing model (e.g. per-seat or per-org tiers + agent credits/usage) and give RachDev its own catalog rather than borrowing RachBase's. The shared `PricingSection` component is fine to reuse; the **data** feeding it must be RachDev's. Effort: **M** (pricing design is the real work; wiring is small).

### P1-2 — Pricing metadata contradicts the page
`pricing/page.tsx` metadata says *"Backend infrastructure and AI agents bundled in one bill… Starter, Growth, and Scale plans."* But the catalog renders infra bundles, not Starter/Growth/Scale agent tiers. Copy and content disagree. Fix as part of P0-1. Effort: **S**.

### P1-3 — Three overlapping industry-keyed marketing sections
`/agents/[industry]`, `/industries/[slug]`, and `/templates/[industry]` are three separate industry-indexed sections. For a prospect this is confusing (which do I click?) and for you it is triple the content to maintain per new industry. Decide the canonical journey — likely **Industries** as the hub, with Agents and Templates as tabs/sections within an industry rather than parallel top-level trees. Effort: **M**.

### P2-4 — Page inventory: keep / fix / cut
Marketing routes are otherwise substantive (real content, not stubs) — good foundation. Notable exceptions:

| Route | State | Action |
|---|---|---|
| `/docs` | Stub — "Coming soon" | Hide from nav until real, or point to real docs |
| `/blog` | Real (MDX-driven) | Keep |
| `/changelog` | Hardcoded entries | Keep; wire to a source later |
| `/pricing` | Wrong product (P0-1) | Fix |
| `/about`, `/careers`, `/security`, `/integrations`, `/why-rach-dev`, `/contact` | Real content | Keep |
| `/demo`, `/products/agent-builder` | Real | Keep |

No pages are clearly "delete now," but `/docs` should not be advertised in the nav while it says "Coming soon." Effort: **S**.

---

## 2. Dashboard — multi-industry readiness

### P1-5 — The seam exists but only healthcare has content
Good news: the shell is already industry-aware. `src/app/dashboard/layout.tsx` gates nav items by `user.tenant_industry` (`NAV_ITEMS[].industry`), and the backend treats industry as a first-class tenant attribute (`PATCH /api/tenant/industry`, `tenantController.setIndustry`, admin `setOrgIndustry`). This is exactly the "same shell, content varies by industry" model you want — the foundation is there.

Gaps that make it healthcare-only in practice:

- **Only healthcare has workspace pages.** `dashboard/clinical/*` are the sole industry modules. A tenant with `industry = 'legal'` logs in to an essentially empty workspace (Support only, plus Settings/Agent Monitor if admin).
- **4 of the 5 clinical pages are 12-line placeholders.** Only `clinical/scribe` (300 lines) is real. `control-tower`, `reception`, `inventory`, `audit` render `ClinicalPlaceholder` ("implementation lands in Sprint 2–3"). So even the flagship vertical is ~80% scaffold.
- **Roles are hardcoded and healthcare-specific.** `doctor`, `reception`, `store_manager` appear in `ROLE_LABEL`, in `NAV_ITEMS` role gates, and in backend `authorize(...)` calls (e.g. `scribe.js` uses `authorize('doctor', ...)`, `agentMonitor.js` authorizes `'doctor'`). Adding an industry means editing role enums across web + backend.
- **Naming leaks the vertical.** The layout component is literally `ClinicalDashboardLayout`; the module folder is `clinical/`. Generic tenants inherit clinical vocabulary.

> **Recommend (matches your "shell same, content per industry" model):** introduce an **industry module registry** — a config keyed by industry id that declares its nav items, roles, and module routes — and drive `NAV_ITEMS` + route structure from it instead of hardcoding. Rename `clinical/` → an industry-scoped structure (e.g. `dashboard/workspace/[module]` resolved per industry, or `dashboard/(industry)/healthcare/*`). Move healthcare's `doctor/reception/store_manager` roles into the healthcare module definition rather than the global enum. Effort: **L** — this is the core refactor to make onboarding a new industry a config change, not a code change.

### P2-6 — Decide the fate of the placeholder clinical pages
The four placeholders keep routes navigable but ship "Coming soon" surfaces to real tenants. Either implement them or hide them behind a feature flag until their agents (Nora/Ava/Kiran per the placeholder copy) are real. Effort: **S** to gate, **L** to build.

---

## 3. Security

Overall the backend is in decent shape: `helmet`, `cookie-parser`, a JSON body limit (100kb), consistent `authenticate` middleware, and — importantly — **proper tenant isolation**. Every data query is scoped by `req.user.tenant_id` and parameterized ($1/$2), and session access checks ownership (`WHERE id = $1 AND tenant_id = $2`). No IDOR or SQL-injection patterns found in the routes reviewed. Real `.env` files are gitignored (only `.env.example` is tracked).

Issues to address:

### P0-7 — Arbitrary command execution available to every authenticated role
`POST /api/agent/sessions/:id/run-command` and `.../trigger-deploy` (`agent.js`) carry only `authenticate` — **no `authorize()`**. Any authenticated user of any role (including `tenant_user`, `doctor`, `reception`) can submit a `command` + `vm_id` and have RachBase SSH-exec it on the tenant's VM (`agentController.runCommand` → `rachbaseClient.runCommand`). Deploy/exec are the most privileged actions in the product and should be gated to `tenant_admin`/`developer` at minimum. Effort: **S** (add `authorize(...)`).

### P1-8 — run-command / trigger-deploy don't verify the session in the URL
Both handlers take `:id` in the path but never check that the session belongs to the caller's tenant (unlike `chat`, which does). Ownership of the target VM is delegated to RachBase, but the session-scoping inconsistency is a latent bug and an audit-trail gap. Verify `:id` → tenant like the other session routes. Effort: **S**.

### P1-9 — CORS can be configured wide open
`app.js` honors `CORS_ORIGINS='*'` and, with credentials enabled, reflects the caller's Origin. If `*` ever reaches production (or an env is misconfigured), it's an open credentialed CORS surface. Recommend refusing `*` when `NODE_ENV=production` and requiring an explicit allowlist. Effort: **S**.

### P2-10 — Known, documented auth tradeoff
Per `docs/STATUS.md`, login still reveals whether an email is registered (user-enumeration), flagged as a deliberate product decision. Fine to keep, but track it — it matters more once you sell to security-sensitive verticals (healthcare, legal, financial). Effort: **S** if you choose to close it.

> A dedicated deeper security pass (dependency CVEs, rate limiting on the agent/chat + credits endpoints, secret-rotation for `RACHBASE_SERVICE_TOKEN`) is worth doing before GA. Auth-specific findings already live in `docs/RACHDEV_AUTH_AUDIT.md`.

---

## 4. Dead code & hygiene

Low-risk deletions that shrink the surface:

### P1-11 — Unused mock data (~338 lines)
Seven of eight files in `src/data/mock/` are imported nowhere: `activity.ts`, `database.ts`, `logs.ts`, `metrics.ts`, `projects.ts`, `tenants.ts`, `users.ts`. Only `mock/agents.ts` is used (2 files). Delete the seven. Effort: **S**.

### P1-12 — Unused dependencies
Direct deps with zero references in `apps/rachdev-web/src`: `@tanstack/react-query`, `next-themes` (a local `contexts/ThemeContext` is used instead), and `framer-motion` (animation comes from `@rach/ui`). Remove from `package.json` to cut install/bundle weight. Verify against `@rach/ui` peer expectations before removing. Effort: **S**.

### P2-13 — Stray throwaway test script
`_rtest.js` at the repo root is an ad-hoc Express route-matching probe (hardcoded, uses `express` at root). It's not a real test. Delete. Effort: **S**.

### P2-14 — Duplicate theming concepts
A local `ThemeContext` plus the (unused) `next-themes` dep plus a dashboard `ThemeProvider` is more theme machinery than needed. Consolidate on one. Effort: **S–M**.

---

## Suggested sequence

1. **P0-1** Re-do pricing around the agent/credits model the backend already has — this is what unblocks selling.
2. **P0-7** Lock down `run-command` / `trigger-deploy` with role authorization.
3. **P1 dead code (11, 12, 13)** — quick wins, done in an hour, make everything after cleaner.
4. **P1-5 / P1-6** Industry module registry — the refactor that turns "add an industry" into a config change and delivers the multi-industry SaaS goal.
5. **P1-3** Consolidate the three industry-keyed marketing sections.
6. **P1-8, P1-9** Security follow-ups.
7. **P2** items as polish before GA.

---

## Open questions for you

- **Pricing model:** per-seat tiers, agent credits/usage, or a hybrid? This drives P0-1.
- **First 2–3 target industries** beyond healthcare — so the registry refactor (P1-6) is designed against real modules, not hypothetical ones.
- **Placeholder clinical pages:** build them out, or hide until their agents ship?
- Should I start on the quick wins (dead code + `run-command` authorization) now, or wait for pricing/industry decisions first?
