# RachDev — Local Runbook: build → publish → deploy

**Date:** 2026-08-05
**Purpose:** bring the agent loop up locally and click through it. This is the "make it real" step — the code from migration steps 4–7 exists but has to be migrated, run, and exercised.

---

## What's already proven

The backend loop was verified end-to-end against a **real Postgres 16** (not mocks):
- All 50 migrations applied cleanly, including `049_agentspec_v1.sql` and `050_agent_deployments.sql`.
- Loop ran: create draft → **publish v1** (the published spec passes full AgentSpec validation) → edit → **publish v2** → **deploy** → version history `[2,1]`.
- **Immutability confirmed:** the v1 snapshot stayed frozen after the draft was edited (`v1_immutable_after_edit: true`). That's the core versioning guarantee.

So the schema, models, validation, versioning, and deployment tracking are correct. What remains is running it in your environment and driving it from the UI.

---

## 1. Database + migrations

```bash
# from repo root, with a Postgres reachable via these env vars:
export DB_HOST=localhost DB_PORT=5432 DB_NAME=rach_db DB_USER=postgres DB_PASSWORD=...
npm run --prefix packages/core migrate      # applies through 050
```

`schema_migrations` tracks what's applied; re-running is safe (idempotent).

## 2. Backend (rachdev-backend, :8081)

```bash
cp apps/rachdev-backend/.env.example apps/rachdev-backend/.env   # fill DB_*, JWT_* (must match RachBase), ANTHROPIC_API_KEY
npm run --prefix apps/rachdev-backend dev
```

Minimum to exercise the builder loop: `DB_*`, `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`, and (for the builder chat only) `ANTHROPIC_API_KEY`. Razorpay/OAuth/Brevo aren't needed for build→publish→deploy.

## 3. Web (rachdev-web, :3001)

```bash
# apps/rachdev-web/.env
NEXT_PUBLIC_API_URL=http://localhost:8081
npm run --prefix apps/rachdev-web dev
```

## 4. Click the loop

1. Log in as a **tenant_admin** (Org Admin). You'll see **Agent Builder** in the sidebar (new in step 7's registry).
2. **Create draft** — name it, pick a model class, pick **Runtime = `onprem`** (see note), Create.
3. **Publish** — the row flips to `published v1` (an immutable snapshot is written to `agent_spec_versions`).
4. **Deploy** — a deployment appears. With `onprem` it shows `pending` (correct — pull target). Publish again after an edit to see `v2`.

---

## Runtime targets in the demo

- **`onprem` / `byoc`** → pull-based: deploy returns `pending` immediately, **no RachBase needed**. Use this to demo the full loop locally.
- **`rachbase`** → push-based: deploy calls RachBase's `POST /internal/agent-runtime/deploy`. This returns `502` until **RachBase implements the runtime endpoints** (`docs/RACHDEV_RUNTIME_CONTRACT.md` §5) — that's the RachBase-side task, out of scope for this window.

---

## Wired in this pass

- `@rach/ui/lib/api` — new `agentBuilder` client (`list`/`create`/`update`/`publish`/`versions`/`deploy`/`deployments`/`stop`) + AgentSpec types.
- `apps/rachdev-web/src/app/dashboard/agents-builder/page.tsx` — the Agent Builder screen (create → publish → deploy → deployments), gated to `tenant_admin` via the dashboard registry.

## Still to do to be production-real

- RachBase implements `/internal/agent-runtime/*` (unblocks the `rachbase` target).
- Pricing storefront (P0-1) — separate track, needs your pricing decisions.
- Commit the working tree (everything is currently uncommitted).
