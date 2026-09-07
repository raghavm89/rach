# RachDev — Pre-Deploy Audit

**Date:** 2026-08-07
**Scope:** `apps/rachdev-web`, `apps/rachdev-backend`, and the shared `@rach/*` packages they consume.
**Verdict:** **Conditional go.** The code is sound — it builds, boots, and migrates cleanly — but there are a few **must-do configuration/ops steps** and two security fixes to make before it faces public traffic. None are deep code defects.

---

## ✅ What passed (verified, not assumed)

- **Backend boots.** `require('src/app.js')` resolves every route/controller/service — no missing modules.
- **Migrations apply cleanly.** All **81 migrations** run in order on a fresh Postgres → 83 tables, no errors.
- **Frontend typechecks.** No real TypeScript errors (only the sandbox's `@rach/*` resolution noise, which resolves in a real build).
- **No secrets in source.** No API keys, tokens, or private keys committed; no real `.env` committed (only `.env.example`).
- **Strong env validation.** `validateEnv()` runs at startup, `process.exit(1)` on any missing required var, **and rejects the placeholder values** from `.env.example` — so it can't boot with weak/default secrets.
- **Auth hardening in place.** Rate limiters on login/register/OTP/refresh/forgot/reset; `helmet`; 100 kb JSON body limit; `/health` + `/ready` endpoints; refresh cookie is `httpOnly`, `secure` in production, `sameSite=lax`.

---

## 🔴 Must do before deploy (blocking)

1. **Commit the working tree.** There are **~195 uncommitted changes** (last commit: `dark mode + ticketing support`). Deploy pipelines build from a commit — nothing ships until this is committed and pushed.
2. **Run the migrations on the production DB.** The app does **not** auto-migrate on boot. Run `npm run --prefix packages/core migrate` (or point `DATABASE_URL` at prod and run it) — all 81 must apply before first request.
3. **Set every required env var, with real values.** The backend exits on boot if any of these are missing or still placeholders: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `RAZORPAY_KEY_ID/KEY_SECRET/WEBHOOK_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET`, and DB (`DB_*` or `DATABASE_URL`).
   - ⚠️ **Note:** Razorpay + Google + GitHub are currently *required*. If you aren't using them yet, you must either supply real values or relax the `REQUIRED` list in `packages/core/src/config/env.js` — otherwise the app won't start.

---

## 🟠 Fix before public traffic (security)

4. ~~**Rate-limit `POST /api/leads`.**~~ ✅ **Done (2026-08-08).** Added `leadsLimiter` (5 / hour / IP) in `packages/core/src/middleware/rateLimit.js` and applied it in `apps/rachdev-backend/src/routes/leads.js`. Backend boots clean with it wired. (A honeypot field is still a nice-to-have but not blocking.)
5. **Set `CORS_ORIGINS` to an explicit allowlist** (your rachdev.com domains) — never `*`. The server reflects the origin and allows credentials, so `*` in production is unsafe. The allowlist logic already exists; just configure it.
6. **Serve over HTTPS.** The refresh cookie is `secure` in production, so it won't be sent over plain HTTP — TLS is required for auth to work at all.

---

## 🟡 Operational / expectations

7. **LLM config.** `ANTHROPIC_API_KEY` is *not* in the boot-required set, so the app starts without it — but every agent call then fails at runtime. Set a funded key. Also ensure **`LLM_MOCK` is unset/0 in production** (otherwise all agents return canned text).
8. **On-prem models are stubbed.** If an org's model is set to `sarvam-*` (on-prem), real calls error — the vLLM adapter isn't wired. Keep orgs on Claude models until it is.
9. **Demo data.** HR (and some clinical) screens render tenant-seeded demo data. Fine for launch; seed a tenant with the demo script if you want populated content, or wire real ingestion later.
10. **Deploy artifacts exist.** Dockerfiles for both apps and `docker-compose.yml` are present; the web app talks to the backend via `NEXT_PUBLIC_API_URL` (set it to your API domain).

---

## Go/No-Go checklist

- [ ] Working tree committed + pushed
- [ ] Prod env set (all required vars, real values, HTTPS domains in `CORS_ORIGINS`)
- [ ] Migrations run against prod DB
- [ ] `ANTHROPIC_API_KEY` set · `LLM_MOCK` off
- [x] `/api/leads` rate-limited
- [ ] TLS terminating in front of the backend
- [ ] Smoke test: login → dashboard → generate an agent output → contact form submits

Clear these and RachDev is ready to deploy.
