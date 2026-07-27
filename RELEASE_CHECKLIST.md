# RachBase — First Release Checklist & Audit

Audit of `rachbase-web` (frontend) and `rachbase-backend` (API) for the first
production release. Grouped by severity. The good news first: the backend is in
good shape — env-allowlist CORS, `helmet`, `/health` + `/ready` probes,
`validateEnv()` fail-fast on boot, rate limiters (`@rach/core`), graceful
shutdown, and a hard refusal to boot with `ALLOW_UNVERIFIED_PAYMENTS=true` in
production. Most items below are configuration and content, not code defects.

---

## 🔴 Blockers — do before going live

- [ ] **Set real production secrets** in `apps/rachbase-backend/.env` (never
      commit it — it's correctly gitignored). At minimum: `JWT_ACCESS_SECRET`,
      `JWT_REFRESH_SECRET`, `RAZORPAY_KEY_ID` (live), `RAZORPAY_KEY_SECRET`,
      `RAZORPAY_WEBHOOK_SECRET`, `GOOGLE_CLIENT_ID/SECRET`,
      `GITHUB_CLIENT_ID/SECRET`, `GITHUB_APP_ID/PRIVATE_KEY`,
      `RACHBASE_SERVICE_TOKEN`, `RACHBASE_KEY_ENC_SECRET`, `BREVO_API_KEY`,
      `GODADDY_API_KEY/SECRET`, and a strong `DB_PASSWORD`.
- [ ] **`validateEnv` won't catch `change_me` placeholders.** It rejects only
      `your_*`-style values, but `.env.example` ships `change_me*`. A forgotten
      `change_me_access` secret will boot and be insecure. Either update the
      placeholder list in `packages/core/src/.../validateEnv` to include the
      `change_me*` values, or triple-check every secret is real.
- [ ] **Match shared secrets across backends.** Per `DEPLOYMENT.md`,
      `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` and `RACHBASE_SERVICE_TOKEN`
      must be **identical** in `rachbase-backend` and `rachdev-backend`, or
      cross-service auth breaks.
- [ ] **DB password.** `docker-compose.yml` and `.env.example` both use
      `change_me`. Set a strong password and, if using managed Postgres, wire
      `DATABASE_URL` (already supported by `validateEnv`).
- [ ] **CORS_ORIGINS** — set to the real frontend origin(s), not the
      `*.example` placeholders. Do **not** use `*` (the code allows it, but with
      `Allow-Credentials: true` that's unsafe).
- [ ] **`NEXT_PUBLIC_API_URL`** for `rachbase-web` must point at the real API
      domain (build-time env). It's a placeholder `api.rachbase.example` today.
- [ ] **Set `NEXT_PUBLIC_SITE_URL`** to the real domain. `metadataBase` (OG /
      canonical URLs), `sitemap.xml`, and `robots.txt` now all read from it via
      `src/config/site.ts` — so one env var fixes all three. Defaults to the
      `rachbase.example` placeholder until set.
- [ ] **Run migrations** against the production DB before first boot:
      `npm run migrate` (from `rachbase-backend`, uses `@rach/core`).
- [ ] **Run a clean production build** of `rachbase-web` (`next build`) and the
      backend image, end to end. I could not run the full Next build in this
      session — treat it as a required gate (verifies the new `/features`
      routes and every page compile). Deploy order: backend → web.

## 🟠 Should-fix — strongly recommended for launch quality

- [~] **Dashboard mock data in chrome components** — partially done.
      - [x] `components/dashboard/layout/TopBar.tsx` — FIXED. Now uses the real
        authenticated user via `useAuth()`; Profile/Preferences link to
        `/dashboard/profile` and Log out calls `logout()`.
      - [ ] `components/dashboard/layout/ProjectSwitcher.tsx` → `mockProjects`
      - [ ] `components/dashboard/database/SchemaViewer.tsx` → `mockTables`
      Decide: wire the remaining two to real endpoints, or accept for a soft
      launch.
- [x] **Razorpay webhook secret** — CONFIRMED set in `.env` to a real value
      (all three Razorpay vars set). At launch also verify it **matches** the
      secret configured on the webhook in the Razorpay dashboard, and that the
      webhook URL points at prod `…/api/payments/webhook`.
- [ ] **`RACHBASE_KEY_ENC_SECRET`.** If unset, per-VM SSH key rotation is
      disabled (server warns at boot). Set it if VMs/SSH are part of launch.
- [x] **Brand logo + Favicon / app icons / OG image** — DONE. Adopted the new
      RachBase bolt logo (`public/brand/rachbase-logo.png`); `BrandLogo` now
      renders it across Navbar, Footer, auth, and dashboard sidebar, and the
      dark admin sidebar uses `public/brand/rachbase-mark.png`. Regenerated all
      icons from the bolt mark: `app/icon.svg`, `app/icon.png`, `app/favicon.ico`,
      `app/apple-icon.png`, plus `app/opengraph-image.png` / `app/twitter-image.png`.
      Next auto-wires them. NOTE: the OG image's absolute URL still depends on
      `NEXT_PUBLIC_SITE_URL` (set the real domain — see blockers).
- [x] **`robots.ts` / `sitemap.ts`** — DONE. Added `app/sitemap.ts` (static
      marketing routes + all `/features/[slug]`, excludes the delinked
      `/changelog`) and `app/robots.ts` (disallows `/dashboard`, `/api`, auth
      routes; points to the sitemap). Both read the origin from
      `src/config/site.ts` (`NEXT_PUBLIC_SITE_URL`). Just set that env var.
- [x] **API URL fallback port bug** — DONE. Changed the `localhost:3000`
      fallback to `localhost:8080` in `Terminal.tsx`, `AgentChat.tsx`,
      `@rach/ui/lib/api`, and `@rach/ui/.../auth/OAuthButtons.tsx` (a 4th spot
      found during the fix). Verified zero `localhost:3000` references remain.
      Deployed envs still override via `NEXT_PUBLIC_API_URL`.

## 🟡 Verify / nice-to-have

- [ ] **Legal pages** still name **Rach Dev LLP** as the contracting entity
      (kept intentionally). Confirm that's the correct registered entity for
      RachBase's Terms/DPA/Privacy, or update.
- [ ] **Docs page** is a "Coming soon" placeholder — fine if intended.
- [ ] **Health probes** — point your load balancer / orchestrator at `/health`
      (liveness) and `/ready` (DB check). Already implemented.
- [ ] **Auto-domains** — if `<name>.rachbase.com` auto-domains are live at
      launch, ensure production GoDaddy keys + `RACHBASE_DOMAIN` are set.
- [ ] **Monitoring** — `PROMETHEUS_URL` set; `alertMonitor` and
      `endpointProber` auto-start. Confirm Prometheus is reachable in prod.

---

## Already solid (no action needed)
- `helmet`, env-allowlist CORS, raw-body webhook handling, `express.json` limits
- `validateEnv()` fail-fast; refuses `ALLOW_UNVERIFIED_PAYMENTS=true` in prod
- Rate limiters for login/register/OTP/refresh/deploy (`@rach/core`)
- Graceful shutdown (SIGTERM/SIGINT, DB pool drain, 10s force-kill)
- `.env` files gitignored and untracked (only `.env.example` committed)
- Next `output: "standalone"` + Dockerfiles for both apps
