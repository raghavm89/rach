# First production deploy — Rachbase

A step-by-step checklist for standing up Rachbase in production for the **first
time**, against a **brand-new empty database**.

Because the database is empty:
- All 30 migrations run from scratch (`001` → `029`).
- The migration-027 duplicate-email guard cannot trip (there are no users yet).
- `adopt-legacy-subscription` is **not** run — there is no legacy subscription
  in this database. (Any subscription in an old environment stays there.)

Companion docs: `DEPLOYMENT.md` (service topology), `BILLING.md`,
`BILLING_TAX_INVOICING.md`, `AUTHENTICATION.md`.

---

## 0. Before you touch the server

- [ ] **Commit the working tree.** ~69 files are currently uncommitted. Deploy
      from a committed revision, not a dirty tree.
- [ ] Decide your two production domains, e.g. `api.rachbase.com` (backend) and
      `app.rachbase.com` (frontend).
- [ ] Have these ready: Postgres credentials, **live** Razorpay key/secret/webhook
      secret, Brevo API key, Google + GitHub OAuth client id/secret, your real
      **GSTIN** and registered address.

> Order of services: **rachbase-backend deploys first** — it is the identity
> provider and RachDev depends on it. (You may not be deploying RachDev at all;
> if so, ignore every RachDev reference below.)

---

## 1. Provision Postgres

- [ ] Create an empty database and a user with DDL rights.
- [ ] Confirm the app host can reach it (host, port, SSL if managed).
- [ ] Take note of the connection details for the `.env` below.

Nothing to migrate yet — the runner creates every table.

---

## 2. Write the production `.env` (rachbase-backend)

Start from `apps/rachbase-backend/.env.example`. **Do not reuse your dev `.env`** —
it has `NODE_ENV=development` and localhost URLs, which disable production
security. Set at minimum:

```bash
NODE_ENV=production            # REQUIRED. Activates the secure-cookie flag and
                               # the payment-safety boot guards.
PORT=8080

# URLs — real domains, WITH scheme, no trailing slash
APP_URL=https://app.rachbase.com          # frontend origin (OAuth + email links)
BACKEND_URL=https://api.rachbase.com       # this API's own public URL

# Database
DB_HOST=... DB_PORT=5432 DB_NAME=... DB_USER=... DB_PASSWORD=...

# JWT — generate fresh secrets; if deploying RachDev too, use the SAME values there
JWT_ACCESS_SECRET=...          # openssl rand -base64 32
JWT_REFRESH_SECRET=...
JWT_ACCESS_EXPIRES_IN=8h
JWT_REFRESH_EXPIRES_IN=30d

# Razorpay (LIVE)
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...     # must match what you set in the Razorpay dashboard (step 7)

# Currency
USD_TO_INR=95                  # keep current; see BILLING.md for the caveat

# Email
BREVO_API_KEY=...  BREVO_FROM_EMAIL=...  BREVO_FROM_NAME=Rach Dev LLP

# OAuth (register the prod callback URLs — step 6)
GOOGLE_CLIENT_ID=...  GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...  GITHUB_CLIENT_SECRET=...

# ── Tax invoices (seller identity) ──
SELLER_LEGAL_NAME=Rach Dev LLP
SELLER_GSTIN=09XXXXXXXXXXXZX    # your REAL 15-char GSTIN (Uttar Pradesh = starts 09)
SELLER_STATE_CODE=UP
SELLER_COUNTRY=IN
SELLER_ADDRESS=...              # registered address, printed on invoices
SELLER_EMAIL=billing@rachbase.com
INVOICE_SERIES=RB
GST_EXPORT_UNDER_LUT=true       # you hold an LUT → exports zero-rated

# Do NOT set ALLOW_UNVERIFIED_PAYMENTS in production — the app refuses to boot if you do.
```

Checklist:
- [ ] `NODE_ENV=production`
- [ ] `APP_URL` / `BACKEND_URL` are real https URLs
- [ ] Fresh JWT secrets
- [ ] Live Razorpay keys + webhook secret
- [ ] Real `SELLER_GSTIN` (not the `09XXX…` placeholder) and `SELLER_ADDRESS`
- [ ] `ALLOW_UNVERIFIED_PAYMENTS` is **absent**

If deploying RachDev too: set the **same** `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`
and `RACHBASE_SERVICE_TOKEN` in its `.env`, and point its `RACHBASE_API_URL` at
`BACKEND_URL`.

---

## 3. Install and build

- [ ] `npm ci` at the repo root (installs the workspace).
- [ ] Build the web app: `npm run build -w rachbase-web`.

---

## 4. Run migrations

```bash
npm run migrate -w rachbase-backend
```

- [ ] Output shows `001 … 029` applied, no errors.
- [ ] The runner records each in `schema_migrations` and wraps each in a
      transaction, so it is safe to re-run (already-applied ones are skipped).

Sanity check a couple of tables exist:

```sql
\dt   -- expect users, plans, subscriptions, orders, payments,
      --        invoices, invoice_line_items, tax_registrations, oauth_identities …
```

---

## 5. Enable GST collection

```bash
npm run setup-tax -w rachbase-backend            # dry run — validates + previews
npm run setup-tax -w rachbase-backend -- --commit
```

- [ ] Dry run prints your GSTIN, state, and the CGST+SGST / IGST / export treatment.
- [ ] It **refuses** if `SELLER_GSTIN` and `SELLER_STATE_CODE` disagree — fix `.env`
      and retry if so.
- [ ] `--commit` writes the `tax_registrations` row.

> Until this row exists, every sale is taxed at **0%** and recorded as
> `no_registration`. The app runs fine without it, but you under-collect GST — so
> do this before opening signups.

---

## 6. Register OAuth callback URLs

In the Google and GitHub OAuth app settings, add the production redirect URIs:

- [ ] Google: `https://api.rachbase.com/api/auth/google/callback`
- [ ] GitHub: `https://api.rachbase.com/api/auth/github/callback`

(These are `BACKEND_URL` + the path. Without them, OAuth sign-in fails on the
provider side.)

---

## 7. Point the Razorpay webhook at production

In the Razorpay dashboard → Webhooks:

- [ ] URL: `https://api.rachbase.com/api/payments/webhook`
- [ ] Secret: the same value as `RAZORPAY_WEBHOOK_SECRET` in `.env`
- [ ] Subscribe to: `subscription.activated`, `subscription.charged`,
      `subscription.halted`, `subscription.cancelled`, `subscription.completed`,
      `subscription.expired`, `payment.failed`

This is what records renewals and keeps subscription status current. Without it,
recurring charges won't be reflected in Rachbase.

---

## 8. Start the services

- [ ] Start `rachbase-backend`. Watch the logs on boot:
  - It validates the price catalog (fails fast if `catalog.json` is malformed).
  - It warns if `RAZORPAY_WEBHOOK_SECRET` is missing.
  - It refuses to start if `ALLOW_UNVERIFIED_PAYMENTS=true` — that flag must be absent.
- [ ] Start `rachbase-web` (frontend), with `NEXT_PUBLIC_API_URL=https://api.rachbase.com`.
- [ ] (Optional) `rachdev-backend` / `rachdev-web` after RachBase is healthy.

---

## 9. Smoke test (do this before announcing)

- [ ] `GET https://api.rachbase.com/health` → ok
- [ ] Create an account → receive the email OTP → verify → land on the dashboard
      (exercises the auth rebuild)
- [ ] `GET /api/invoices/catalog` returns the price list
- [ ] Sign in with Google and with GitHub (exercises OAuth + the callback route)
- [ ] Forgot-password → receive the email → reset → sign in with the new password
- [ ] A real ₹ purchase of the cheapest item, then confirm:
  - [ ] the invoice appears under the billing → Invoices tab and the PDF downloads
  - [ ] for an Indian buyer the invoice shows CGST+SGST (same state) or IGST
        (other state); for a non-India buyer it says zero-rated export
  - [ ] the Razorpay webhook shows a 2xx for the `subscription.charged` event

If all of that passes, you're live.

---

## 10. First admin

The app has no admin until you make one:

```bash
npm run create-admin -w rachbase-backend
```

---

## What you do NOT need on a fresh deploy

- ❌ `adopt-legacy-subscription` — only for a database that already contains
  pre-consolidation subscriptions. This one is empty.
- ❌ The duplicate-email pre-check — no existing users to collide.
- ❌ Any data backfill.

---

## If something goes wrong

- **App won't boot, "ALLOW_UNVERIFIED_PAYMENTS…"** → remove that env var.
- **App won't boot, catalog error** → `catalog.json` was edited to an invalid
  state; revert it.
- **Migrations fail partway** → each migration is transactional, so a failure
  rolls that one back. Fix the cause and re-run `npm run migrate`; applied ones
  are skipped.
- **OAuth returns to a broken page** → check `BACKEND_URL`/`APP_URL` have a scheme
  and no trailing slash, and that the provider callback URLs match step 6.
- **Invoices show no tax** → the `tax_registrations` row is missing (step 5) or
  `SELLER_GSTIN` is still the placeholder.
