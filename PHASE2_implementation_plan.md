# RachBase — Phase 2 Implementation Plan

> **STATUS: Phase 2 dashboard features are built and type-clean.** See the
> "Phase 2 progress & deploy notes" section at the bottom for what shipped, the
> migration to run, and the two remaining (non-dashboard) follow-ups.

**Scope:** everything in `PHASE2_dashboard_backlog.md` ships in Phase 2. All items
are **equal priority**. This plan is ordered only by **technical dependency**, not
importance — so the structural pieces land first and the rest slot into them.

**Two things ship as headline outcomes:**
1. A **tabbed per-resource IA** with **Console** (SSH terminal) and **Data**
   (Postgres viewer + query runner) inside it.
2. **Apex-friendly custom domains via a stable IP** — the competitive win over
   Railway.

---

## 0. Decisions to lock before coding (two short spikes)

These block WS3 and WS4; do them first (1–2 days each).

- **Spike A — Stable ingress IP for custom domains (WS4).** Today auto-domains
  point `A → the VM's IP` (`godaddy.upsertARecord(sub, ip)` + `caddy.applyDomain`).
  A per-VM IP changes if the VM changes, so we need a **stable front**. Decide
  between: (a) a dedicated **ingress/edge VM with a static public IP** running
  Caddy that reverse-proxies by `Host` header to the right service VM; or (b) a
  cloud **load balancer with a fixed/anycast IP**. Output: the single IP (or
  small set) we publish for `A @`, and how TLS is terminated.
- **Spike B — Query-runner security model (WS3).** Running SQL from the dashboard
  against a customer DB. Decide: a **read-only DB role** per tenant DB, a
  **statement timeout**, forced `LIMIT`, allow/deny of DDL/DML (recommend
  read-only by default with an explicit "write mode" toggle), and **audit
  logging** of every query. Output: the connection strategy and guardrails.

---

## Build order (dependency graph)

```
WS1 Tabbed IA ──┬─► WS2 Console (terminal in a tab)
                ├─► WS3 Data viewer + query runner  (needs Spike B)
                └─► WS7 supporting tabs (Variables / Deployments-logs)
WS4 Apex domains (independent) ...... needs Spike A
WS5 Mock-data wire-ups (independent, quick)
WS6 Service-card grouping (independent)
```

Everything after WS1 can run in parallel across people.

---

## WS1 — Tabbed resource-view IA (structural foundation)

**Goal:** every resource (service, Postgres, VM) gets Railway's consistent tabbed
detail view, so Console/Data/Variables/etc. each have a home.

- **Frontend**
  - New shared component `components/dashboard/ResourceTabs.tsx` (tab bar +
    active state), driven by nested Next routes for deep-linking.
  - Refactor `app/dashboard/projects/[id]/services/[sid]/` into a **layout +
    tab segments**:
    `.../services/[sid]/layout.tsx` (header + `<ResourceTabs>`) and child routes
    `overview/`, `deployments/`, `variables/`, `metrics/`, `console/`,
    `domains/`, `settings/`.
  - Same pattern for a Postgres resource view (tabs: `data`, `backups`,
    `config`, `console`, `variables`, `settings`).
  - Move today's single-page service content into `overview/`.
- **Backend:** none new — tabs consume existing endpoints.
- **Acceptance:** each resource shows a consistent tab bar; each tab is a
  deep-linkable URL; existing content preserved under Overview.
- **Dependencies:** none. **Do first.**

## WS2 — Console (SSH terminal in a tab)

**Goal:** the working terminal, relocated into a per-service **Console** tab, with
"Copy SSH command."

- **Frontend**
  - Move `components/dashboard/Terminal.tsx` into `.../services/[sid]/console/`.
  - Add a "Copy SSH command" button (mirror Railway) and a Full-screen toggle.
- **Backend**
  - `services/terminalServer.js` already provides the WS shell — confirm it's
    **tenant-scoped and auth-checked** per connection (JWT + service ownership);
    add a short idle timeout.
- **Acceptance:** open service → Console → live shell; copy SSH command works;
  a user can't attach to another tenant's service.
- **Dependencies:** WS1.

## WS3 — Data (Postgres viewer + query runner)

**Goal:** replace the mock `SchemaViewer` with a real table browser + a `SELECT …`
query runner (the Railway "Data" tab).

- **Backend** (new, tenant-scoped, permission-guarded — see Spike B)
  - `GET  /api/deployment/services/:id/db/tables` — list tables + columns.
  - `GET  /api/deployment/services/:id/db/tables/:table?limit&offset` — paginated
    rows.
  - `POST /api/deployment/services/:id/db/query` — run SQL; **read-only role**,
    statement timeout, auto-`LIMIT`, result-size cap; audit every call.
  - Connects to the tenant's managed Postgres (via `postgresProvision` connection
    info). New controller e.g. `controllers/dbBrowserController.js` + route.
- **Frontend**
  - Rewrite `components/dashboard/database/SchemaViewer.tsx` to fetch real
    tables; add a query editor (Monaco/CodeMirror) + results grid + row/table
    browser under the **Data** tab.
  - Remove `@/data/mock/database` usage.
- **DB:** none of ours (reads the tenant DB). Optionally an `db_query_audit` table
  for logging.
- **Security:** the highest-risk item — enforce read-only by default, timeouts,
  LIMITs, and audit logging. "Write mode" is an explicit, logged opt-in.
- **Acceptance:** browse tables, run a SELECT, see results; writes gated + audited;
  no cross-tenant access.
- **Dependencies:** WS1, Spike B.

## WS4 — Apex-friendly custom domains via a stable IP ⭐

**Goal:** users add an apex domain with a simple `A @ <stable-ip>` (no
registrar CNAME dead-ends), with a copy-paste record card and live status — the
Railway-beater.

- **Backend**
  - Publish the **stable ingress IP** from Spike A; route custom hostnames
    through it to the right service (extend `caddyManager`/ingress).
  - Extend the domains API (`deploymentController`: `listDomains`/`addDomain`) to
    return the **exact records to add** (`{type:'A', name:'@', value:<stable-ip>}`
    and `{type:'CNAME', name:'www', value:<target>}`) plus a **status**
    (`pending_dns` → `dns_ok` → `ssl_issued` → `live`).
  - Add DNS-resolution polling + (optional) a `_rachbase-verify` TXT for
    ownership; drive `deployment_domains.status`.
  - Migration: add `verification_token`, `record_type` (and maybe `target`) to
    `deployment_domains`.
- **Frontend**
  - **Domains** tab: "Add domain" → **copy-paste record card** (detects apex vs
    `www` and shows the right rows), live status badges, remove. Show the actual
    IP (fixes the earlier "point A at the VM's IP" with no IP shown).
- **Acceptance:** add `example.com` → get `A @ <stable-ip>`; watch it go
  Pending → DNS OK → SSL Issued → Live; `www` gets the CNAME; works on GoDaddy
  with no apex-CNAME problem.
- **Dependencies:** Spike A. Independent of WS1 (but its UI lives in the Domains
  tab from WS1).

## WS5 — Remove remaining mock data (quick wins)

- `components/dashboard/layout/ProjectSwitcher.tsx` → fetch real `GET /api/projects`
  instead of `mockProjects`.
- `SchemaViewer` mock is retired by WS3.
- **Acceptance:** no `@/data/mock/*` value imports remain in dashboard chrome.
- **Dependencies:** none (ProjectSwitcher); SchemaViewer folds into WS3.

## WS6 — Service-card grouping

**Goal:** group/label related services on the canvas.

- **DB:** migration adding a `service_groups` table (`id, project_id, name,
  color, position`) + `group_id` on `deployment_services`, or reuse the existing
  canvas metadata (`034_service_types_canvas`).
- **Backend:** CRUD for groups; assign/reorder services.
- **Frontend:** grouped/labeled containers on the deployment canvas; drag a
  service into a group; persist positions.
- **Acceptance:** create a group, drag services in, reload persists.
- **Dependencies:** none.

## WS7 — Supporting tabs / UX (round out Phase 2)

Slot these into the WS1 tab structure:

- **Variables tab** — env var management: build-vs-runtime grouping, secret
  masking, and a "changed → redeploy" prompt.
- **Deployments tab** — live build/deploy **log streaming** + actionable
  error hints (duplicate-React, module resolution, port/host) surfaced inline.
- **Service linking + auto-CORS** — link web ↔ backend to auto-populate the API
  URL and the backend's `CORS_ORIGINS`.
- **Onboarding/empty states** — first-run guide: create service → add domain →
  deploy.
- **Acceptance:** each has a home tab and works end to end.
- **Dependencies:** WS1.

---

## Cross-cutting

- **Feature-flag** each workstream so Phase 2 can merge incrementally behind
  flags and flip on together at launch.
- **Migrations:** WS4 and WS6 add columns/tables — additive only, follow the
  `packages/core/src/db/migrations` numbering; run via `npm run migrate`.
- **Security review:** WS3 (query runner) and WS4 (ingress) get an explicit
  security pass before launch.
- **Testing:** unit + an e2e per workstream; verify tenant isolation on every new
  endpoint (WS2/WS3/WS4).
- **Docs:** update the customer help + a `VERCEL_rachbase-web.md`-style internal
  note for the new ingress/domains flow.

## Definition of done (Phase 2 launch)

- Tabbed IA live for services + Postgres; Console and Data tabs functional.
- Apex custom domains work end-to-end on a real registrar (GoDaddy) with a
  stable IP and live status → SSL.
- No mock data in the dashboard.
- Service grouping, Variables, and streaming logs shipped.
- Security review passed on the query runner and ingress; tenant isolation
  verified on all new endpoints.

---

# Phase 2 progress & deploy notes

_Status as built. All frontend changes are `tsc --noEmit` clean; all backend
controllers/routes load._

## What shipped (by workstream)

- **WS1 — Tabbed resource IA.** `components/dashboard/ResourceTabs.tsx`
  (reusable tab bar + `useResourceTab` synced to `?tab=`). Deep-linkable.
- **WS2 — Console.** SSH terminal in a per-service Console tab + "Copy SSH
  command" (reuses `components/dashboard/Terminal.tsx`).
- **WS3 — Data viewer + query runner.** `dbBrowserController.js`
  (`GET …/db/tables`, `POST …/db/query`) + `components/dashboard/database/DbConsole.tsx`.
  Read-only by default (Postgres `START TRANSACTION READ ONLY` + 5s
  `statement_timeout` + 1000-row cap + audit log); **Write mode** toggle commits
  in a normal transaction. Tenant-scoped.
- **WS4 — Apex-friendly domains.** `deploymentController.listDomains` now returns
  the ingress `target_ip`; new `…/domains/:domainId/check` resolves DNS.
  `components/dashboard/DomainsPanel.tsx` shows a copy-paste **A record** card
  (Name/Value=IP) + live "Check DNS" status, plus free `*.rachbase.com`.
- **WS5 — Reachability.** Live nav already has **VM Deployment** → the canvas;
  canvas service cards now have an **Open** link to the tabbed detail page
  `app/dashboard/deployment/services/[id]/page.tsx`.
- **WS6 — Service grouping.** Migration `039_service_groups.sql`
  (`service_groups` + `deployment_services.group_id`), `serviceGroupsController.js`
  (CRUD + `PATCH …/services/:id/group`), `GroupSelector.tsx` (name **optional →
  auto "Group N"**), and a colored group badge on canvas cards.
- **WS7 — Variables / Logs / Onboarding / Auto-CORS.**
  `VariablesPanel.tsx` (env editor + secret masking), `LogsPanel.tsx`
  (live-tailing runtime logs + deploy history), a first-service onboarding hint
  on the canvas, and `LinkServicePanel.tsx` + `deploymentController.linkService`
  (`POST …/services/:id/link`) which merges a linked service's origins into
  `CORS_ORIGINS`.

The `deployment_services` detail view now has tabs: **Overview** (+ Group + Link)
· **Data** (Postgres) · **Console** · **Logs** · **Domains** · **Variables**.

> Architecture note: features were built on `deployment_services` (where
> Postgres/domains/terminal actually work), NOT the newer projects `services`
> table. Reconciling the two service models is future work.

## Run before/at deploy

1. **Migrate:** `npm run migrate` — applies `039_service_groups.sql` (additive:
   new table + nullable `group_id`).
2. **Env:** `RACHBASE_KEY_ENC_SECRET` must be set — Variables and Auto-CORS seal
   values with it; without it those endpoints return 503.
3. **Security review (required):** the Data **query runner** reaches customer
   databases. Confirm the read-only default, write-mode gating, timeout, row cap,
   and audit logging meet policy before enabling broadly.
4. **Ship order unchanged:** backend → web. New endpoints are all under
   `/api/deployment/*` and tenant-scoped (`authorize('tenant_admin')`).

## Done — cleanup

- **Dead prototype shell removed.** ✅ Deleted `components/dashboard/layout/`
  (`Sidebar.tsx`, `TopBar.tsx`, `ProjectSwitcher.tsx`),
  `components/dashboard/database/SchemaViewer.tsx`,
  `components/dashboard/ActivityFeed.tsx`, and the whole `data/mock/` folder
  (8 files). Verified a closed, unreferenced cluster before deleting; project
  still type-checks with zero lingering references. No mock data remains in the
  dashboard.

## Remaining (not dashboard code)

- **Stable/anycast ingress IP (Spike A).** The Domains record card currently
  publishes the per-VM IP. Provision a stable edge/LB IP so `A @ <ip>` survives
  VM changes, then have `listDomains` return that IP instead.

## New files (reference)

Backend: `controllers/dbBrowserController.js`, `controllers/serviceGroupsController.js`,
`migrations/039_service_groups.sql`; new handlers in `deploymentController.js`
(`verifyDomain`, `linkService`) + routes.
Frontend: `components/dashboard/ResourceTabs.tsx`, `database/DbConsole.tsx`,
`DomainsPanel.tsx`, `VariablesPanel.tsx`, `LogsPanel.tsx`, `GroupSelector.tsx`,
`LinkServicePanel.tsx`, and `app/dashboard/deployment/services/[id]/page.tsx`.
