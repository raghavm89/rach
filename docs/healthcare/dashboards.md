# RachDev — two dashboards, one shell

Per request, `/dashboard` serves **both** dashboards, chosen by role (not two separate route trees):

- **RachDev Admin** (`role: admin`) → **Organizations**, **Users**, **Agent Templates**.
- **Organization** (tenant users: `tenant_admin`, `doctor`, `reception`, `store_manager`) → the clinical workspace + **Settings**.

The `/dashboard` index (`page.tsx`) redirects on login: `admin` → `/dashboard/orgs`; tenant users → their role's view (or Settings if the org has no industry yet). The nav (`layout.tsx`) is role-gated, so an admin never sees clinical items and vice-versa.

## Admin views

| View | Route | Backend | Notes |
|---|---|---|---|
| Organizations | `/dashboard/orgs` | `GET /api/admin/orgs`, `PATCH /api/admin/orgs/:id` | List all tenants (+ user counts); set each org's industry/workspace (flip to Healthcare from the platform side). |
| Users | `/dashboard/users` | shared `@rach/identity` `/api/users` (reused) | List all users across orgs; change role (incl. clinical roles). |
| Agent Templates | `/dashboard/agents` | `GET/POST/PUT /api/admin/agent-templates` | Platform `agent_definitions` (tenant_id = NULL) that every org inherits; edit name/provider/model/prompt/enabled. |

All admin routes are `authorize('admin')`. New code lives in `apps/rachdev-backend` (`adminController` + `routes/admin.js`) and `apps/rachdev-web/src/app/dashboard/{orgs,users,agents}`; admin API methods added to `@rach/ui` (`admin.*`). RachBase untouched.

## RachBase-style dashboard port (differences maintained)

RachDev's dashboard now mirrors RachBase's look (recreated `PageHeader` / `StatsCard` in `apps/rachdev-web/src/components/dashboard`, shared design tokens) with these deliberate differences:

- **Org Admin, not Tenant Admin.** RachDev's UI drops the word "tenant" — `tenant_admin` is shown as **Org Admin**, `admin` as **RachDev Admin** (label map in the dashboard layout; the underlying role value is unchanged, so shared identity/RachBase are untouched).
- **Agent Monitor replaces VM Monitor** (org admin) — `GET /api/agent-monitor`, page at `/dashboard/agent-monitor`. Shows summary cards (active agents, runs today, notes signed, drafts pending), a per-agent table (status, runs, signed, success %, last run, model), a recent-activity feed, and health/errors (models in use, drafts pending, disabled agents). Aggregated from `clinical_notes` / `agent_chat_*` / `agent_definitions`, scoped to the org.
- **Support / tickets** (`/dashboard/support`, everyone) — reuses the shared `tickets` tables + `@rach/ui` `support` API; new rachdev-backend `supportController` + `/api/support` routes (role-scoped: admin all, org admin their org, others own). Categories tailored to RachDev (agent / account / other). No support bot.
- **No Billing page.** **No VM Monitor** for RachDev Admin (or anyone). **Organizations** and **Agent Templates** remain RachDev-only.

Nav by role: **RachDev Admin** → Organizations · Users · Agent Templates · Support. **Org Admin** → Agent Monitor · (clinical workspace when Healthcare) · Support · Settings.

Migrations were renumbered off a collision the team introduced: my `043_clinical_roles` → **047**, `044_agent_definitions` → **048** (the team added `043_github_multi_installation` / `044_support_tickets`).

## Verify
- Backend **35/35** node:test (admin, support ticket + agent-monitor guards, scribe, scaffold).
- `rachdev-web` **0 real type errors**. RachBase **untouched**.

Sign in as an `admin` → land on Organizations. Flip an org to Healthcare there (or set your own in Settings as tenant_admin), assign a user the `doctor` role in Users, and that org's clinical workspace comes to life.
