# Rach Platform — Engineering Guide

Repo overview, local dev, and how we run/deploy on **Vercel** (frontends) and
**Railway** (backends).

---

## 1. What this repo is

A monorepo for two products that share one core:

- **RachDev** — AI Agent Builder (`apps/rachdev-*`)
- **RachBase** — Cloud Management / BaaS (`apps/rachbase-*`)

They are **two independently deployable services** that share six versioned
`@rach/*` packages. RachBase is the platform (identity, billing, infra, the
deploy API); RachDev is a consumer of it.

```
packages/                         apps/
  @rach/core      db, config,        rachbase-backend   Cloud/BaaS API (:8080)
                  middleware,        rachdev-backend    Agent Builder API (:8081)
                  email/SMS          rachbase-web       Dashboard + marketing (:3002)
  @rach/identity  auth, users,       rachdev-web        Agent builder UI (:3001)
                  RBAC, tenancy
  @rach/billing   payments + credits
  @rach/deploy    deploy engine + SSH + GitHub App
  @rach/llm       LLM gateway + provider adapters
  @rach/ui        React design system + client foundation
```

### Dependency graph (who imports whom)

```
  @rach/core  ◄── @rach/identity ◄── @rach/billing ◄── @rach/llm
       ▲               ▲                  ▲
       └──────── @rach/deploy             │
                                          │
  rachbase-backend  → core, identity, billing, deploy         (owns infra)
  rachdev-backend   → core, identity, billing, llm            (calls RachBase over HTTP)
  rachbase-web      → @rach/ui
  rachdev-web       → @rach/ui
```

Golden rule: **the dependency arrow only points RachDev → RachBase, never back.**
RachDev has no `@rach/deploy` and no `node-ssh`; it asks RachBase to do deploys.

---

## 2. The two things that couple the services

Both must be configured identically across the two backends:

1. **JWT secrets** — RachBase issues tokens, RachDev validates them. Set the same
   `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in both.
2. **Service token** — RachDev calls RachBase's `/internal/*` deploy API with an
   `x-service-token` header. Set the same `RACHBASE_SERVICE_TOKEN` in both, and
   set `RACHBASE_API_URL` (in RachDev) to RachBase's API URL.

If either drifts, auth or deploys break. Treat them as shared secrets.

---

## 3. Local development

### Prerequisites
- Node 20+, npm 9+ (workspaces), a Postgres 16 instance.

### Install (once, from repo root)
```bash
npm install          # installs every workspace + links @rach/* packages
```

### Environment
Each app has a `.env.example`. Copy and fill:
```bash
cp apps/rachbase-backend/.env.example apps/rachbase-backend/.env
cp apps/rachdev-backend/.env.example  apps/rachdev-backend/.env
cp apps/rachbase-web/.env.example     apps/rachbase-web/.env.local
cp apps/rachdev-web/.env.example      apps/rachdev-web/.env.local
```

### Migrate the database (once)
```bash
npm run core:migrate      # runs @rach/core src/db/migrate.js against your DB
```

### Run
```bash
# start RachBase first (it's the dependency)
npm run dev -w rachbase-backend     # :8080
npm run dev -w rachdev-backend      # :8081
npm run dev -w rachbase-web         # :3002
npm run dev -w rachdev-web          # :3001
```

Or everything at once with Docker:
```bash
docker compose up --build           # db + both backends + both webs
```

---

## 4. Working in the monorepo

### Changing a shared package
Edit `packages/<pkg>` and both consumers pick it up immediately (workspace
symlinks — no publish step locally). Because a change to a shared package affects
**both** apps, treat these as high-blast-radius edits: run both apps' builds
before merging.

### Adding a UI component
Add it under `packages/ui/src/components/ui/`, export it (named export), and it
flows through the barrel (`packages/ui/index.ts`) to both web apps via
`import { X } from "@rach/ui"`.

### Versioning
`@rach/*` are private workspace packages (`"version"` in each `package.json`).
A breaking change to a shared package is a **major** bump — bump it deliberately
so reviewers know both apps are affected.

### The seam rule (enforced in review)
RachDev must not import `@rach/deploy`, `node-ssh`, or touch infra tables for
mutations. Anything that provisions/deploys/execs goes through `RachBaseClient`
→ RachBase `/internal/*`.

---

## 5. Deployment

We deploy **frontends on Vercel** and **backends on Railway**. The Dockerfiles /
`docker-compose.yml` in this repo are for local + optional self-hosting; Vercel
and Railway build directly from the repo.

### 5a. Frontends on Vercel (two projects)

Create **two Vercel projects** from the same GitHub repo:

| Project | Root Directory | Env |
|---|---|---|
| `rachdev-web` | `apps/rachdev-web` | `NEXT_PUBLIC_API_URL` = RachDev API URL |
| `rachbase-web` | `apps/rachbase-web` | `NEXT_PUBLIC_API_URL` = RachBase API URL |

Settings for each:
- **Root Directory:** the app folder (above). Enable *"Include source files
  outside the Root Directory"* so Vercel can see `packages/` — the apps import
  `@rach/ui` from the workspace.
- **Framework preset:** Next.js (auto-detected).
- **Install Command:** `npm install` (runs at the workspace root; the committed
  root `package-lock.json` drives it).
- **Build Command:** `next build` (default). `@rach/ui` compiles via
  `transpilePackages` — no separate package build needed.
- **Node version:** 20.x.

Commit the root `package-lock.json` — Vercel needs it to resolve workspaces.

### 5b. Backends on Railway (two services + Postgres)

Create a Railway project with **three services**:

1. **Postgres** (Railway plugin) — provides connection vars.
2. **rachbase-backend** — deploy first.
3. **rachdev-backend** — depends on RachBase.

For each backend service (both build from the repo root so `@rach/*` resolves):

| Setting | Value |
|---|---|
| Root Directory | `/` (repo root — do **not** set to the app folder, or `@rach/*` won't resolve) |
| Build Command | `npm install` |
| Start Command | `npm run start -w rachbase-backend` (resp. `rachdev-backend`) |

Set env vars per service from the matching `.env.example`. Critically:
- Both backends: **same** `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
  `RACHBASE_SERVICE_TOKEN`.
- `rachdev-backend`: `RACHBASE_API_URL` = the RachBase service's URL (use the
  Railway private/internal URL if both are in the same project).
- `PORT`: Railway injects `$PORT`; our servers already read `process.env.PORT`.

#### Railway + Postgres gotcha (read this)
Railway's Postgres plugin exposes `DATABASE_URL` (and `PG*` vars), but
`@rach/core`'s `config/db.js` currently reads **individual** `DB_HOST` / `DB_PORT`
/ `DB_NAME` / `DB_USER` / `DB_PASSWORD`. Two options:

- **Quick:** map Railway's Postgres vars to ours in the service env
  (`DB_HOST=${{Postgres.PGHOST}}`, `DB_PORT=${{Postgres.PGPORT}}`, etc.).
- **Better (small code change):** make `config/db.js` prefer `DATABASE_URL`:
  ```js
  const { Pool } = require('pg');
  const pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    : new Pool({ host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
                 user: process.env.DB_USER, password: process.env.DB_PASSWORD });
  ```
  `env.js` already treats `DATABASE_URL` as satisfying the DB requirement, so this
  aligns the two.

#### Migrations on Railway
Run once against the Railway DB (one-off command or a release step):
`npm run core:migrate`.

### 5c. Deploy order & domains

**Order (first deploy and every cutover):** Postgres → **rachbase-backend** →
rachdev-backend → web apps. RachBase is the identity provider and deploy API, so
it must be live before RachDev is useful.

| Brand | Vercel (frontend) | Railway (API) |
|---|---|---|
| RachBase | `app.rachbase.example` | `api.rachbase.example` |
| RachDev | `rachdev.example` | `api.rachdev.example` |

Point each Vercel project's `NEXT_PUBLIC_API_URL` at the matching Railway API
domain. On rename from the old `rach-dev` app, add 301 redirects and refresh
`sitemap.ts` / `robots.ts`.

See `DEPLOYMENT.md` for the full cutover + rollback sequence.

---

## 6. CI suggestions (not yet wired)

- **PR checks:** `npm install`, then `npm run build -w rachdev-web`,
  `npm run build -w rachbase-web`, and a boot smoke test of both backends.
- **Path-filtered deploys:** Vercel/Railway can auto-deploy only the service whose
  files changed; a shared-package change should trigger **all** dependents.
- **Guardrail test:** assert RachDev has no `@rach/deploy` / `node-ssh` import
  (protects the seam).

---

## 7. Quick reference

| App | Port | Deploys to | Key env |
|---|---|---|---|
| rachbase-backend | 8080 | Railway | DB, JWT, RAZORPAY, GITHUB_APP, DEPLOY_SSH, RACHBASE_SERVICE_TOKEN |
| rachdev-backend | 8081 | Railway | DB, JWT, ANTHROPIC_API_KEY, RACHBASE_API_URL, RACHBASE_SERVICE_TOKEN |
| rachbase-web | 3002 | Vercel | NEXT_PUBLIC_API_URL |
| rachdev-web | 3001 | Vercel | NEXT_PUBLIC_API_URL |

Planning/architecture docs live in `docs/` — start with `docs/00_MASTER_ROADMAP.md`.
