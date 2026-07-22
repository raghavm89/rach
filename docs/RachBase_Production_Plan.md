# RachBase — Production Launch Plan

**Date:** 2026-07-14
**Companion to:** `RachBase_Production_Audit.md`
**Scope decided:** RachBase-only MVP · Hosting on **Vercel (frontends) + Railway (backends + Postgres)** · **Production-grade** quality gates (real tests, CI/CD, security review, load test, observability before launch).

Out of scope for this launch: RachDev agent builder, the container substrate / sellable CaaS (roadmap Stages 2 & 5). RachBase is the identity provider and platform, so it can ship standalone; RachDev slots in later without rework.

---

## 0. Definition of "production-ready" (exit criteria)

Launch is allowed only when all of these are true:

- Both `next build`s pass and all RachBase services boot against a real Postgres.
- The launch dashboard surface reads **live API data** — no `data/mock` imports on shipped pages.
- CI runs on every PR: install, lint, both builds, backend boot smoke test, seam guardrail, and the test suite — all green.
- Core happy paths are covered by automated tests (auth, billing/webhook, deploy, tenants).
- A security review and a load test have been completed with no unresolved critical findings.
- Real secrets are provisioned in Railway/Vercel; env validation passes; no `change_me` values.
- Observability is live: metrics, structured logs, error tracking, uptime checks, and an alert destination that has fired at least once in staging.
- A staging environment has run the full flow, and rollback has been rehearsed once.

---

## Phase 1 — Prove it boots (make the current code real)

Goal: eliminate the biggest unknown — nothing has been built or booted end-to-end.

1. **Local end-to-end boot.** From repo root: `npm install`, stand up Postgres 16, `npm run core:migrate`, then boot `rachbase-backend` and `rachbase-web`. Fix whatever breaks (missing exports, env, import paths).
2. **Build both frontends.** `next build` for `rachbase-web` (and `rachdev-web` if kept in the repo, so shared-package changes don't silently break it). Resolve any `@rach/ui` transpile / workspace-resolution issues.
3. **Apply the Railway DB fix.** Make `@rach/core/config/db.js` prefer `DATABASE_URL` (per ENGINEERING.md §5b) so Postgres connects on Railway. Verify locally with a `DATABASE_URL` too.
4. **Pick one package manager.** Choose npm (a `package-lock.json` already exists) and remove `pnpm-workspace.yaml`, or commit fully to pnpm. Avoid dual-lockfile drift in CI.
5. **Smoke-test the happy paths by hand:** sign up → verify → log in → view dashboard → create a project/service → a payment order (test keys) → a `/internal/deploy` call with the service token. Note every break.

**Exit:** every RachBase service boots locally, both builds pass, and the manual happy path works against a real DB.

---

## Phase 2 — Wire the dashboard to real data

Goal: no shipped page shows mock numbers.

1. **Inventory mock usage.** The four `rachbase-web` files importing `src/data/mock/*` — map each to its real API endpoint.
2. **Replace with the real API client** (React Query is already a dependency) hitting `NEXT_PUBLIC_API_URL`. Add loading/empty/error states.
3. **Triage the ~198 TODO/FIXME markers.** Tag each launch-blocking / post-launch. Fix the launch-blocking set (concentrated in profile, billing checkout, users, login).
4. **Decide the launch dashboard surface.** Any page not ready (e.g. `containers`, which has no backend) is hidden behind a flag or removed from nav for MVP — not shipped half-working.
5. **Subscription invoicing — send on create *and* every renewal.** An invoice email must be generated and sent for every subscription's first payment and for every renewal billing cycle, to the **tenant admin email** and to **raghav@rachdev.com**.
   - *Reuse, don't rebuild:* `sendInvoiceEmail` already exists in `@rach/core/services/brevo.js` and already CC's raghav@rachdev.com. Today it's only called from `expansionController` (the custom-order flow) — the main subscription paths never invoice.
   - *Wire it into the two real hooks in `@rach/billing` `paymentController.webhook`:* `subscription.activated`/`subscription.authenticated` (first cycle) and `subscription.charged` (every renewal — this handler already creates the `Order` + `Payment` rows, so the invoice slots in right after, fire-and-forget). Optionally also on the initial `subscribe` confirmation.
   - *Recipient fix:* resolve the **tenant admin** email from the subscription's tenant (not just the subscribing user's `customerEmail`), so the invoice always reaches the tenant admin plus raghav@rachdev.com. Confirm the admin-copy address is a config value, not hardcoded, before launch.
   - *Idempotency:* invoices must not double-send on webhook retries — gate on the existing `WebhookEvent.claim` de-dupe (already covers the charged handler) and/or an `invoice_sent` marker per order.

6. **Customer US tax number at checkout — alongside the existing India GSTIN.** US customers must be able to enter a US tax number (EIN/TIN) at checkout, mirroring how Indian customers already enter a GSTIN, and it must appear on their invoice.
   - *Follow the existing GSTIN pattern in `billing/checkout/page.tsx`:* the form already has a `gstin` field shown when `country === 'India'`, with format validation, a review-summary display, and prefill from the user profile. Add a parallel `us_tax_number` field shown for US customers, with its own light validation, review display, and prefill.
   - *Persist it:* extend the billing/business profile (and the order/invoice payload) to store the US tax number the same way GSTIN is stored, so it survives renewals.
   - *Surface both on the invoice:* the current `sendInvoiceEmail` doesn't print the customer's tax id at all — add a "Billed to" tax-id line that shows GSTIN for Indian customers and the US tax number for US customers (ties into point 5).
   - *Scope note:* this is the **buyer's** tax id only. Whether to also print the **seller's** GST/US registration on invoices is a separate decision (flagged under cross-cutting decisions).

7. **Pricing-page ↔ billing-page parity (single source of truth).** Everything shown on the public pricing page must match what appears on the billing/checkout pages — same products, specs, prices, bundles, and inclusions.
   - *Root cause:* the catalog is currently hard-coded in **three independent places** with no shared import — `PricingSection` in `@rach/ui` (pricing page), `dashboard/billing/page.tsx`, and `dashboard/billing/checkout/page.tsx`. They mostly agree today but will drift.
   - *Known discrepancy already:* the pricing page lists a **"Service" ($15/mo)** line item that the checkout catalog omits. Reconcile these before launch.
   - *Fix:* consolidate to one source of truth. Preferred is **backend-driven** (the `plans` / `service_units` / `vm_packages` tables + a plans API already exist) so pricing, billing, and checkout all read the same catalog — which also aligns with wiring the dashboard off mock data (points 1–2). Minimum acceptable is a single shared `@rach/ui` (or `@rach/*`) catalog module imported by all three surfaces.
   - *Guard it:* add a check/test asserting the pricing surface and the billing/checkout surface resolve to the same product+price set, so they can't silently diverge again.

**Exit:** every page in the shipped nav renders live data or is intentionally hidden; a new subscription and a renewal each produce exactly one invoice email to the tenant admin + raghav@rachdev.com; US customers can enter a US tax number at checkout and it appears on their invoice next to where GSTIN appears for Indian customers; the pricing page and billing/checkout pages show an identical product/price catalog drawn from one source.

---

## Phase 3 — Test suite + CI/CD (production-grade gate)

Goal: a safety net that runs automatically. This is the phase that distinguishes "production-grade" from "MVP-and-hope."

1. **Test harness.** Add a runner (Jest or Vitest + Supertest for the backend) at the workspace root.
2. **Backend integration tests** against a throwaway Postgres (Testcontainers or a CI Postgres service): auth flow (register/login/refresh/reset), billing (order create + **webhook signature verification** + credit grant), **subscription invoicing** (a `subscription.activated` and a `subscription.charged` webhook each trigger exactly one invoice to tenant admin + raghav@rachdev.com, and a retried webhook does *not* re-send), deploy `/internal/*` token auth (401 without token, happy path with it), tenants + RBAC boundaries.
3. **Shared-package unit tests** for the highest-risk logic: `@rach/billing` credit math, `@rach/identity` token issue/validate, `@rach/core` middleware (idempotency, rate limit).
4. **Frontend checks.** `next lint` clean; a couple of smoke tests on critical components; optionally one Playwright happy-path (login → dashboard).
5. **Seam guardrail test.** Assert RachDev has no `@rach/deploy` / `node-ssh` import (protects the architecture even while RachDev is out of scope).
6. **Pricing↔billing parity test.** Assert the pricing page and the billing/checkout pages resolve to the same product + price + bundle set (Phase 2 point 7), so the two surfaces can't silently diverge.
7. **GitHub Actions CI** on every PR: install → lint → both builds → backend boot smoke → test suite. Block merge on red.
8. **CD.** Path-filtered auto-deploy: Vercel per frontend, Railway per backend; a shared-package change triggers all dependents. Migrations run as a Railway release step, not by hand.

**Exit:** CI is green and required on `main`; core happy paths are covered.

---

## Phase 4 — Harden for production

Goal: close the security, secrets, and ops gaps.

1. **Secrets provisioning.** Generate real JWT secrets, Razorpay live keys + webhook secret, Google/GitHub OAuth apps, GitHub App ID + private key, deploy SSH key, Brevo key. Store in Railway/Vercel env — never in the repo. Confirm env validation passes and rejects placeholders.
2. **Dockerfile hardening** (kept for self-host/parity even though Railway builds from source): `npm ci` not `npm install`, multi-stage prune, non-root user, in-image `HEALTHCHECK`.
3. **Security review.** Run the repo's `security-review` over the diff; manual pass on: CORS allow-list correctness, helmet config, rate-limit coverage on auth/payment routes, webhook signature verification, SSRF/command-injection risk in `/internal/run-command`, secret handling in logs, SQL parameterization.
4. **Load test.** Exercise auth, dashboard reads, and a deploy trigger at expected peak (k6 or Artillery). Confirm rate limits behave, Postgres connection pool holds, no N+1 blowups.
5. **Observability.** Confirm Prometheus scrape works in prod; add error tracking (Sentry) to both backend and frontend; structured JSON request logs; uptime/synthetic checks on `/health` + `/ready`; wire alerting to a real destination (email/Slack) and prove one alert fires.
6. **Backups & DR.** Enable Railway Postgres automated backups; document restore steps; confirm migrations are forward-only for the launch set.

**Exit:** security review and load test pass with no open criticals; secrets live; monitoring + alerting + backups verified.

---

## Phase 5 — Stage & rehearse

Goal: run the real cutover once, safely, before it counts.

1. **Provision staging** on Railway (Postgres + `rachbase-backend`) and Vercel (`rachbase-web`), mirroring prod config with test-mode payment keys.
2. **Deploy in the documented order:** Postgres → migrations → `rachbase-backend` (verify `/health`, `/ready`) → `rachbase-web` (pointed at the API via `NEXT_PUBLIC_API_URL`).
3. **Full flow on staging:** signup → billing (test) → project/service → deploy → monitoring, plus the `/internal/*` seam (401 without token, 200 with). Verify subscription invoicing end-to-end with Razorpay test-mode webhooks: a first charge and a simulated renewal each deliver one invoice to the tenant admin inbox and raghav@rachdev.com.
4. **Rehearse rollback** once (roll back web, then backend; DB stays — no destructive migrations in the launch set).

**Exit:** staging runs the full flow green; rollback rehearsed.

---

## Phase 6 — Launch

1. **DNS & domains** — `app.rachbase.*` (web) and `api.rachbase.*` (API); point Vercel `NEXT_PUBLIC_API_URL` at the Railway API domain.
2. **SEO hygiene** — 301s from any legacy `rach-dev` URLs, refresh `sitemap.ts` / `robots.ts`, keep slugs.
3. **Production deploy** in the same order as staging; migrations as a release step.
4. **Parallel run** behind DNS/flags; watch dashboards and error tracking through the first traffic.
5. **Go/no-go** against the §0 exit criteria; retire the old monolith only after the parallel run is clean.

---

## Cross-cutting decisions to settle early

- **Payments currency** — VM pricing is USD, Razorpay settles INR (`USD_TO_INR` env). Confirm the launch display/settlement currency.
- **Which dashboard pages ship** for MVP vs. hide (esp. `containers`, which has no backend).
- **Keep `rachdev-*` in the repo but undeployed** (recommended — it keeps builds honest for shared-package changes) vs. branch it out.
- **Alert + on-call destination** for production incidents.
- **Seller tax registration on invoices** — the invoice currently shows only "Rach Dev LLP" with no GSTIN/EIN. Decide whether a compliant launch needs the *company's* India GSTIN + US Tax ID printed on every invoice (separate from the buyer's tax id added in Phase 2 point 6), and whether the sender identity should be RachBase- rather than Rach Dev–branded.

---

## Suggested ordering & parallelism

Phases 1 → 2 are sequential (can't wire real data before it boots). Phase 3 (tests/CI) can start as soon as Phase 1 lands and runs in parallel with Phase 2. Phase 4 hardening overlaps Phase 3. Phase 5 requires 1–4 done. Critical path: **1 → 2 → 5 → 6**, with 3 and 4 as parallel gates that must be green before 5 completes.

**First meaningful milestone:** end of Phase 2 — RachBase runs on real data locally. **Launch-ready milestone:** end of Phase 5 — staging green, rollback rehearsed.
