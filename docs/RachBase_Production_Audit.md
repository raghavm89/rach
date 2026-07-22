# RachBase — Production Readiness Audit

**Date:** 2026-07-14
**Scope:** The `rach-platform` monorepo (`packages/*` + `apps/*`), focused on getting **RachBase** (and the shared core it depends on) to production. RachDev is the downstream consumer and is noted where relevant.

---

## 1. Verdict in one line

The platform is **structurally complete but never proven in production** — the code, schema, docs, and deploy config exist and are coherent, but nothing has been built end-to-end, there are no tests or CI, and parts of the dashboard still run on mock data. This is a "wire it up and harden it" journey, not a "build it" one.

---

## 2. What's solid (green)

**Shared core** — six `@rach/*` packages, all populated from real code, with a clean dependency graph and an enforced seam (RachDev → RachBase only):
`core` (db pool, config, middleware, migrations), `identity` (auth, OAuth, users, RBAC, tenancy), `billing` (Razorpay + credits), `deploy` (deploy runner, SSH key, GitHub App), `llm` (gateway + Anthropic adapter), `ui` (design system).

**RachBase backend** is substantively built, not scaffolded: auth/oauth/users, payments + webhooks (raw-body handling done right), deployment, monitoring, tenants, expansion, plans, Railway-style projects→services, VM assignment, alerting + Prometheus, a WS/SSH terminal server, and a token-guarded `/internal/*` service API (`deploy`, `run-command`, `usage`, `alerts/evaluate`) that is real, not a stub.

**Database** — 27 sequential migrations with a real schema (users, tenants, VMs, orders, subscriptions, deployments, agent chat, service alerts, etc.) and a migration runner in `@rach/core`.

**Web apps** — full Next.js 14 apps (standalone output configured). `rachbase-web` has a real dashboard surface (projects, tenants, VMs, monitoring, billing/checkout, containers, orders, infrastructure, team, users) plus marketing, docs, pricing, and complete legal pages (privacy/terms/DPA/SLA/cookies).

**Deploy config & docs** — per-app `.env.example`, Dockerfiles, `docker-compose.yml` with correct boot order, env validation that fails fast and rejects placeholder secrets, `/health` + `/ready` endpoints, and a documented Vercel (frontends) + Railway (backends) cutover with rollback and a clear roadmap.

---

## 3. Gaps and risks (what stands between here and production)

### Blockers — must clear before a real launch

1. **No end-to-end build/boot has ever run.** README explicitly lists "run the full `next build` / live end-to-end boot on a real machine" as remaining. Until both web apps build and all four services boot against a real Postgres, production readiness is unverified.
2. **Zero tests.** No unit, integration, or smoke tests anywhere in the repo. High-blast-radius shared packages change both apps with no safety net.
3. **No CI/CD.** No `.github/workflows`. ENGINEERING.md §6 lists CI as "not yet wired." Deploys, migrations, and the seam guardrail are all manual today.
4. **Dashboard partly on mock data.** Four files in `rachbase-web` still import `src/data/mock/*`; a real API client exists but coverage is incomplete. Users would see fake numbers.
5. **Secrets not provisioned.** Every `.env.example` is full of `change_me` / `rzp_live_xxx` placeholders — JWT, Razorpay (keys + webhook secret), Google/GitHub OAuth, GitHub App private key, deploy SSH key, Brevo. Real secrets + a place to store them are required.

### High priority — fix during hardening

6. **Railway Postgres var mismatch.** `@rach/core/config/db.js` reads individual `DB_*` vars; Railway exposes `DATABASE_URL`. Documented in ENGINEERING.md with a recommended small code change — apply it so the DB actually connects in prod.
7. **~198 TODO/FIXME/placeholder markers**, concentrated in dashboard pages (profile, billing checkout, users, login). Triage: which are launch-blocking vs. later.
8. **Backend Dockerfiles are minimal.** `npm install` (not `npm ci`), no build/prune stage, runs as root, no in-image healthcheck. Fine for a smoke test; tighten before prod.
9. **Observability/ops gaps.** Prometheus URL is expected but wiring isn't confirmed; no error tracking (e.g. Sentry), no structured request logging beyond morgan, no alerting destination proven.
10. **Tooling drift.** Both npm and pnpm workspace configs are committed, but only `package-lock.json` exists. Pick one package manager to avoid resolution drift in CI/deploys.

### Scope-dependent (may be out of launch scope)

11. **Container substrate (roadmap Stage 2) not built.** The `containers` dashboard page exists, but the CaaS backend runtime is not implemented. Sellable containers are Stage 5 — likely post-launch.
12. **RachDev backend is thin by design** — agent chat, credits, and a deploy proxy only; agent build/templates are later-stage. Fine if RachBase launches first (it's the dependency).
13. **No security review or load testing** yet — rate limiting exists but hasn't been validated under load or adversarially.

---

## 4. Suggested production sequencing (preview — full plan next)

1. **Prove it boots** — build both web apps, boot all services against a real Postgres, run migrations, exercise auth → billing → deploy happy paths.
2. **Wire the dashboard to real APIs** — remove mock-data dependence on the launch surface.
3. **Harden** — apply the `DATABASE_URL` fix, provision real secrets, tighten Dockerfiles, add smoke tests + minimal CI.
4. **Stage** — deploy RachBase first (Postgres → backend → web) to a staging env on the documented Vercel + Railway path; verify `/health`, `/ready`, and the `/internal/*` seam.
5. **Launch** — DNS, redirects, sitemaps, observability + error tracking on; parallel-run behind flags before cutover.

The detailed, task-level plan follows once scope is confirmed (see the questions raised alongside this audit).
