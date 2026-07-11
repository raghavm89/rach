# Rach Platform Monorepo

Home of two brands sharing one core:

- **RachDev** — AI Agent Builder (`apps/rachdev-*`)
- **RachBase** — Cloud Management / BaaS (`apps/rachbase-*`)

## Layout

```
packages/
  core/      @rach/core       db, config, middleware, notifications   [PORTED]
  identity/  @rach/identity   auth, users, roles, tenancy             [PORTED]
  billing/   @rach/billing    payments (Razorpay) + credits           [PORTED]
  deploy/    @rach/deploy     deploy engine + GitHub App              [PORTED]
  llm/       @rach/llm        LLM gateway + provider adapters         [PORTED]
  ui/        @rach/ui         frontend design system                 [PORTED]
apps/
  rachbase-backend/                    Cloud / BaaS API               [SCAFFOLDED]
  rachbase-web/                        Cloud / BaaS UI                [SCAFFOLDED]
  rachdev-backend/                     Agent Builder API              [SCAFFOLDED]
  rachdev-web/                         Agent Builder UI               [SCAFFOLDED]
docs/        Planning: start at docs/00_MASTER_ROADMAP.md
```

## Workspaces

npm workspaces (root `package.json`) and pnpm (`pnpm-workspace.yaml`) are both
configured. Install from the root:

```bash
npm install        # or: pnpm install
```

## Status — split complete (roadmap Stages 1–4)

The monorepo is structurally complete: six `@rach/*` packages consumed by four
apps, two independent services talking over an authenticated contract.

- **Shared packages** — `@rach/core`, `@rach/identity`, `@rach/billing`,
  `@rach/deploy`, `@rach/llm`, `@rach/ui` — all populated from the real code.
- **Backends** — `rachbase-backend` (cloud/BaaS + identity provider + internal
  deploy API) and `rachdev-backend` (agent builder). RachDev calls RachBase's
  `/internal/*` deploy API over HTTP with a service token — no in-process infra.
- **Frontends** — `rachbase-web` and `rachdev-web`, both on `@rach/ui`.
- **Deploy** — per-app `.env.example`, Dockerfiles, `docker-compose.yml`, and
  `DEPLOYMENT.md` (cutover: RachBase first, since RachDev depends on it).

Remaining per the roadmap: run the full `next build` / live end-to-end boot on a
real machine, then the later stages (containers/CaaS, multi-provider LLM,
Kubernetes, BYOK). Source mapping: `docs/RachDev_RachBase_Shared_Core_Spec.md`.

Nothing in the live RachDev repo has been modified — this is a fresh scaffold.
