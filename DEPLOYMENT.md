# Deployment & Cutover — Rach Platform

How to ship **RachDev** (agent builder) and **RachBase** (cloud / BaaS) as two
separate services. This is Stage 4 of `docs/00_MASTER_ROADMAP.md`.

## Services & ports

| Service | Role | Default port | Depends on |
|---|---|---|---|
| `db` (Postgres) | System of record (RachBase-owned) | 5432 | — |
| `rachbase-backend` | Cloud/BaaS API + identity provider + internal deploy API | 8080 | db |
| `rachdev-backend` | Agent builder API | 8081 | **rachbase-backend**, db |
| `rachbase-web` | Dashboard + BaaS marketing | 3002 | rachbase-backend |
| `rachdev-web` | Agent builder UI | 3001 | rachdev-backend |

**Dependency direction:** RachDev depends on RachBase (identity + the internal
deploy API), never the reverse. So RachBase always deploys first.

## The two coupling points between the services

1. **Shared JWT secrets.** RachBase issues tokens; RachDev validates them. Set
   the *same* `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` in both.
2. **Service token.** RachDev calls RachBase's `/internal/*` deploy API with
   `x-service-token`. Set the *same* `RACHBASE_SERVICE_TOKEN` in both, and set
   `RACHBASE_API_URL` in RachDev to RachBase's API URL.

## Domains (suggested)

| Brand | Marketing / app | API |
|---|---|---|
| RachBase | `app.rachbase.example` | `api.rachbase.example` |
| RachDev | `rachdev.example` | `api.rachdev.example` |

On rename, add 301 redirects from any legacy `rach-dev` URLs, refresh
`sitemap.ts` / `robots.ts`, and keep URL slugs where possible for SEO.

## Local / staging (Docker Compose)

```bash
cp apps/rachbase-backend/.env.example apps/rachbase-backend/.env   # then edit
cp apps/rachdev-backend/.env.example  apps/rachdev-backend/.env    # then edit
docker compose up --build
```

Compose already encodes the boot order (RachDev waits on RachBase) and points
`RACHBASE_API_URL` at the internal `rachbase-backend:8080`.

## Database migrations

Run once against the shared DB before first boot (the migration runner ships in
`@rach/core`):

```bash
npm run core:migrate            # uses @rach/core src/db/migrate.js
```

## Production cutover sequence

1. **Provision Postgres** and run migrations.
2. **Deploy `rachbase-backend` first** — it's the identity provider and the
   deploy API. Verify `/health` and `/ready`.
3. **Deploy `rachdev-backend`** with `RACHBASE_API_URL` + matching secrets/token.
   Verify it can reach RachBase (`/internal/deploy` returns 401 without the
   token, 200 path with it).
4. **Deploy the web apps**, each pointed at its own backend via
   `NEXT_PUBLIC_API_URL`.
5. **Rebrand**: apply RachBase naming/copy (see `docs/RachBase_Branding_and_Docs.md`),
   set DNS, add redirects.
6. **Parallel run** behind feature flags / DNS before retiring the old monolith.

## Rollback

Because RachBase is the dependency, roll back RachDev first, then RachBase. The
shared DB stays put (no destructive schema changes are part of the split).

## Build notes

- Backends: `docker build -f apps/<svc>/Dockerfile -t <svc> .` (context = repo root).
- Web apps: use Next `output: "standalone"` (already configured); the Dockerfile
  copies the standalone bundle into a slim runtime image.
- All images resolve `@rach/*` through npm workspaces — build context must be the
  repo root so `packages/` is present.
