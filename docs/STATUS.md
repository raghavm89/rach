# Where we are — Rachbase work status

A plain-language summary of everything done and everything left. Written to cut
through the confusion of a long multi-session effort.

**The one thing to know first:** none of this is committed to git or deployed.
It all lives in the working tree — 69 changed files against last commit
`7c979f5`. So in *production* right now, nothing below has taken effect yet.
That's the top of the "what's left" list, not a problem with the code.

---

## The big picture

Three areas were worked on, in order:

1. **Authentication** — audited and rebuilt
2. **Billing & pricing** — audited and rebuilt
3. **Tax & invoicing** — built from scratch

Each has a detailed doc. This page is the map above them.

| Area | Detail doc |
|---|---|
| Auth | `AUTHENTICATION.md`, `AUTH_AUDIT.md` |
| Billing | `BILLING.md`, `BILLING_AUDIT.md` |
| Tax & invoices | `BILLING_TAX_INVOICING.md` |

---

## 1. Authentication — DONE (code), not deployed

**What was wrong:** password reset, OAuth signup and change-password all wrote to
a database column (`password_hash`) that didn't exist — all three were broken in
production. OAuth redirected to a 404, issued no refresh token, and the callback
called the wrong function. Sessions expired silently. The OTP rate limiter was
keyed on a field the requests didn't send.

**What's done:**
- `password` → `password_hash` column rename (migration 027) + nullable for OAuth accounts
- OAuth rebuilt: CSRF `state`, refresh cookie, correct callback route, no credentials in the URL, provider-identity table, verified-email checks
- Silent token refresh driven by the server's real token lifetime
- Email normalization, hashed reset tokens, constant-time OTP, per-registration attempt cap
- Login page split into components; `/signup` unified; password strength meter; terms acceptance
- Hourly cleanup of abandoned signups, expired OAuth state, dead tokens

**Left:** deploy (needs migration 027). One known-open item: login still reveals
whether an email is registered — a deliberate product tradeoff, documented.

---

## 2. Billing & pricing — DONE (code), not deployed

**What was wrong (the serious part):** anyone with an account could get any
service free or for any price. Three independent holes — the client set the
price, signature verification could be skipped by omitting a field, and a
signature was treated as proof of payment. Prices were copy-pasted in four
places and had drifted (Managed PostgreSQL was $200 on the site, $100
server-side). Bundle savings were overstated. And there were **two parallel
billing systems**, which meant subscription renewals recorded nothing —
Razorpay charged customers monthly and Rachbase saw none of it after the first
payment.

**What's done:**
- **One shared catalog** (`catalog.json`) is the single price authority; the server prices every cart and ignores client amounts
- **One shared purchase service** — every payment path goes through it
- Signature verification is mandatory + constant-time; payments are confirmed captured/amount/currency with Razorpay
- The two billing systems consolidated: `/api/expansion` delegates to the core; renewals now record orders, payments and invoices; a dead subscription now updates its status
- Duplicate + double-clicked subscriptions prevented; abandoned checkouts cancelled hourly
- Credits purchase (a *third* money path, in the other app) folded into the same service — it previously granted credits on signature alone with no invoice
- Integer-cents money everywhere; honest bundle savings; pricing page got a working CTA
- Dead endpoints and dead code removed

**Left:** deploy (migrations 028, 029). Small open items in §5 below.

---

## 3. Tax & invoicing — DONE (code), needs config + deploy

**What was wrong:** the app collected a GSTIN and promised tax invoices, but no
tax was ever calculated and no invoice ever generated.

**What's done:**
- Pluggable tax engine. **India GST**: CGST 9% + SGST 9% within your state, IGST
  18% to other states, zero-rated export under LUT for non-India buyers. **US**:
  nexus-driven, charges nothing until registered (Stripe Tax / TaxJar adapters ready)
- Real PDF tax invoices — sequential gapless numbering per financial year,
  immutable seller/buyer snapshots, emailed with the PDF attached, downloadable
  from an Invoices tab
- Issued automatically whenever a payment is captured; idempotent
- Tax shown in checkout before payment

**Left — this area needs three things before it's live:**
1. Deploy migration 028 (creates the invoices + tax tables)
2. Put the real GSTIN in `.env` (currently a `09XXX…` placeholder) and run
   `npm run setup-tax`. **Until this row exists, GST is charged at 0%.**
3. Fill in `SELLER_ADDRESS` etc. for the invoice header

---

## The production one-off (your live subscription)

Your one production subscription (VM #4, Jena McCaslin, ₹9,400/mo) predates all
this and is affected by the renewal bug — Razorpay charged it in June *and* July,
Rachbase recorded only June.

- `adopt-legacy-subscription.js` — reconciles it against Razorpay and links it
  into the new system so future renewals record correctly
- `generate-invoice.js` — produces the June/July invoice PDFs; you said you have
  the invoice, so this is optional

---

## What's actually LEFT

### A. Ship it (not coding — this is the real blocker)
1. **Commit** the working tree (69 files)
2. **Run the 3 migrations** — `npm run migrate` (027, 028, 029). Note: 027
   aborts if you have case-duplicate emails; fix those first
3. **Configure tax** — real GSTIN in `.env`, run `npm run setup-tax --commit`
4. **Adopt** the production subscription — `npm run adopt-legacy-subscription`

Until this happens, production still has the broken auth and the old billing.

### B. Config hygiene (found in your `.env`)
- **Live Razorpay keys with `NODE_ENV=development`** — the prod safety guards
  (secure cookie, unverified-payment refusal) don't fire in dev mode. Split dev
  vs prod configs with test keys in dev.

### C. The test suite (started, not finished)
Everything above was verified with ~100 throwaway assertions that no longer
exist. A permanent `node:test` suite was scoped (tasks for catalog, tax,
payment security, invoicing) but not written. **This is the recommended next
coding task.**

### D. Small open items (low priority, all documented)
- Static `USD_TO_INR` rate; drifts (94 in June, 95 now), not recorded per txn
- Double-cancelling a subscription throws a 502
- Five backend route surfaces never audited (deployment, monitoring, projects,
  tenants, vmAssignment, internal)

### E. Explicitly decided NOT to do
- **Refunds** — handled outside the system (your call). Note: refunding in the
  Razorpay dashboard leaves the local order `paid` and the invoice valid;
  reconcile by hand
- **`createCustomOrder` hardening (5.6/5.8)** — the endpoint is unreachable from
  the UI; fix or delete when that path is revived

---

## One-line status

**Code: essentially complete across auth, billing and tax.
Deployment: nothing is live yet.
Next: ship the migrations + config, then write the test suite.**
