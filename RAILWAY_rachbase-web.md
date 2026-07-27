# Deploying `rachbase-web` on Railway

This app is part of an **npm-workspaces monorepo** (shares `@rach/*` packages),
built with a **Dockerfile** and Next.js **standalone** output. Two things make
or break the deploy:

1. **Build context = repo root.** The Dockerfile copies `packages/` and the
   root `package.json`, so Railway must build from the repository root, not from
   `apps/rachbase-web`.
2. **`NEXT_PUBLIC_*` are baked in at build time.** They're inlined into the
   browser bundle during `next build`, so they must be set as **build-time**
   variables. The Dockerfile now declares them as `ARG`s — setting them as
   Railway service Variables is enough. Changing them later needs a redeploy.

---

## 0. Prerequisites

- The **backend is deployed first** (per `DEPLOYMENT.md`, RachBase is the
  dependency). You need its public URL for `NEXT_PUBLIC_API_URL`.
- Decide the web app's own public URL (Railway gives you one; you can add a
  custom domain later) — this is `NEXT_PUBLIC_SITE_URL`.
- The Dockerfile change (build args + `HOSTNAME=0.0.0.0`) is already committed in
  `apps/rachbase-web/Dockerfile`. Push it before deploying.

## 1. Create the service

1. Railway → **New Project** → **Deploy from GitHub repo** → pick this repo.
   (Or add a service to an existing project: **+ New** → **GitHub Repo**.)
2. When it creates a service, open it → **Settings**.

## 2. Point Railway at the Dockerfile (repo root context)

In **Settings → Build**:

- **Root Directory:** leave empty / `/` (the repo root). **Do not** set it to
  `apps/rachbase-web` — that would break `COPY packages ./packages`.
- **Builder:** Dockerfile.
- **Dockerfile Path:** `apps/rachbase-web/Dockerfile`.

> This bypasses Nixpacks. It also sidesteps the stray `pnpm-workspace.yaml` in
> the repo, which can otherwise trick auto-detection into using pnpm (the repo
> actually uses npm — there's a root `package-lock.json`).

Optional: to avoid rebuilding on unrelated pushes, set **Watch Paths** to
`apps/rachbase-web/**` and `packages/**`.

## 3. Set variables

In **Settings → Variables**, add:

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<your-backend-domain>` | Public URL of `rachbase-backend`. **Build-time** — inlined into the client bundle. |
| `NEXT_PUBLIC_SITE_URL` | `https://<your-web-domain>` | This app's own public origin. Drives `metadataBase`, `sitemap.xml`, `robots.txt`. **Build-time.** |

You don't need to set `PORT` (Railway injects it) or `HOSTNAME` (the Dockerfile
sets `0.0.0.0`). `NODE_ENV=production` is set in the image.

> Chicken-and-egg: `NEXT_PUBLIC_SITE_URL` needs the domain from step 4. Easiest
> path: do step 4 first (generate the domain), paste it here, then deploy.

## 4. Networking / domain

**Settings → Networking → Generate Domain** (Railway gives
`something.up.railway.app`). Railway routes external traffic to the port it
injects via `PORT`; the Next standalone server reads `PORT` automatically — no
target-port config needed beyond what Railway detects.

Add a **Custom Domain** here later if you have one, then update
`NEXT_PUBLIC_SITE_URL` (and re-deploy, since it's build-time).

## 5. Deploy

Trigger a deploy (Railway auto-deploys on push, or use **Deploy** in the UI).
Watch **Build Logs** for `npm run build -w rachbase-web` succeeding and
**Deploy Logs** for the server starting.

## 6. Verify

- Open the domain → marketing site loads, favicon + logo show.
- `/<domain>/robots.txt` and `/<domain>/sitemap.xml` resolve and contain your
  real domain (confirms `NEXT_PUBLIC_SITE_URL` was set at build time).
- Log in / an API-backed dashboard action works → confirms `NEXT_PUBLIC_API_URL`
  points at the live backend (check the browser Network tab for the request host).
- Also confirm the backend's `CORS_ORIGINS` includes this web domain, or
  browser calls will be blocked.

---

## Troubleshooting

- **API calls hit `localhost:8080` in production** → `NEXT_PUBLIC_API_URL` wasn't
  present at build time. Confirm it's a service Variable and re-deploy (it's a
  build arg, not runtime).
- **Build fails on `COPY packages ./packages`** → Root Directory is wrong; set it
  back to the repo root.
- **Build uses pnpm / fails on lockfile** → make sure Builder is Dockerfile (not
  Nixpacks), so `pnpm-workspace.yaml` is ignored.
- **App builds but 502 / no response** → the container must listen on Railway's
  `PORT` on `0.0.0.0`. The image sets `HOSTNAME=0.0.0.0` and Next standalone uses
  `PORT`; don't hard-set `PORT` in Variables.
- **OG/canonical URLs or sitemap show `rachbase.example`** → `NEXT_PUBLIC_SITE_URL`
  wasn't set at build; set it and re-deploy.

## Note on migrations

Database migrations belong to the **backend** service, not this web app:
`npm run migrate` from `rachbase-backend` (uses `@rach/core`). Run them against
the DB before the backend's first boot.
