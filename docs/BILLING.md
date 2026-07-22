# Billing

How Rachbase prices, charges, and records money.

Companion documents:

- **[BILLING_TAX_INVOICING.md](./BILLING_TAX_INVOICING.md)** — tax engine, GST/US rules, invoices
- **[BILLING_AUDIT.md](./BILLING_AUDIT.md)** — the audit this implementation resolves

---

## 1. The two rules

Everything else follows from these.

### Rule 1 — the server prices every cart

**A client never sends a price.** It sends *what it wants* (`bundle_id`, or
`items: [{ id, qty }]`) and the server prices it from `packages/billing/catalog.json`.

This was the highest-severity finding in the audit. `total_cents` arrived in the
request body and was passed straight to `razorpay.plans.create`, so anyone could
order the $1,270/mo Scale bundle for one cent by editing a number in the
request.

Anything that computes an amount must go through
`packages/billing/src/catalog/index.js`. There is no second path.

### Rule 2 — money is integer minor units

Cents and paise, as `BIGINT` in the database and safe integers in JS. Tax rates
are basis points (`1800` = 18%).

The old checkout summed dollars as floats and multiplied by 100, so 7 GB of disk
at $0.15 produced `104.99999999999999` cents and sent it to Razorpay as an order
amount. `packages/billing/src/services/tax/money.js` is the only place
conversion happens.

---

## 1a. One money path

```
                    ┌──────────────────────────────────────┐
   /api/expansion ──┤                                      │
   (fulfilment)     │   services/purchase.js               │
                    │   THE money path                     │
   /api/payments ───┤                                      │
   (reads +         │   prices → Razorpay → persists       │
    webhook)        │   plans → subscriptions →            │
                    │   orders → payments → invoices       │
                    └──────────────────────────────────────┘
                                    ▲
                    Razorpay webhook │ drives every subscription's
                                     │ lifecycle, whichever surface
                                     │ created it
```

Rachbase used to have **two** billing implementations:

| | `/api/payments` | `/api/expansion` |
|---|---|---|
| Schema | `plans → subscriptions → orders → payments` | one `vm_expansion_requests` table |
| Webhook | yes — the only one | none |
| Called by the UI | **never** | always |

That was not merely duplication. The webhook resolves subscriptions through the
`subscriptions` table, so an expansion subscription was **invisible to it**:

- renewal charges recorded nothing — no order, no payment, **no invoice for
  cycle 2 onward**, while Razorpay kept charging the customer monthly;
- a failed or Razorpay-side-cancelled subscription still read `active` in
  Rachbase indefinitely;
- `next_charge_at` had no writer at all.

`subscription_status` had exactly two writers — activation and user-initiated
cancellation — and nothing else ever touched it.

### What changed

`packages/billing/src/services/purchase.js` is now the only thing that moves
money. `/api/expansion` keeps its URLs (no frontend churn) but delegates to it,
and its `vm_expansion_requests` row became what the name suggests — the
**fulfilment record** for the admin provisioning workflow — linked to the
billing rows by FK (migration 029).

Because the subscription is persisted *before* payment, the webhook can find it,
and `syncFulfilmentForSubscription` fans state changes back out to the
fulfilment rows.

Removed from `/api/payments`: `POST /subscribe`, `POST /orders`, `POST /verify`
— a second purchasing implementation nothing called. What remains is the webhook
plus read-only history.

### Adopting pre-029 subscriptions

`vm_expansion_requests` created before migration 029 have `subscription_id IS NULL`
and receive no webhook updates — renewals still record nothing for them.

```bash
# Reconcile against Razorpay and report. Writes nothing.
npm run adopt-legacy-subscription -w rachbase-backend

# Create the plans + subscriptions rows and link the fulfilment record.
npm run adopt-legacy-subscription -w rachbase-backend -- --commit

# Also record past charges as orders + payments.
npm run adopt-legacy-subscription -w rachbase-backend -- --commit --with-history
```

Razorpay is the source of truth: period, `paid_count` and status are read from
the live subscription, never inferred from our rows. The dry run prints every
charge Razorpay has taken alongside what Rachbase recorded, which is how you see
the gap.

`--with-invoices` additionally issues tax invoices for those past charges. It is
off by default deliberately — invoice numbers are allocated at issue time, so a
June supply invoiced today carries today's number and date. Under Indian GST a
tax invoice is due within 30 days of supply, so a materially late one is a
question for your accountant. Backfilled invoices are never emailed.

---

## 2. The catalog

`packages/billing/catalog.json` is the single price list.

| Consumer | How |
|---|---|
| Server pricing | `packages/billing/src/catalog/index.js` — the pricing authority |
| Frontend display | `packages/ui/src/lib/catalog.ts` — typed re-export of the same file |
| Public API | `GET /api/invoices/catalog` — unauthenticated |

It previously existed in **four** copies (marketing page, dashboard, checkout,
and a `SERVICE_PRICES` map in `expansionController`), and had drifted:

- Managed PostgreSQL was **$200** on the pricing page and **$100** server-side —
  every custom order with a database undercharged by $100/month.
- Five of eight advertised services (`disk`, `ip`, `obs`, `mon`, `svc`) were
  missing server-side and returned `400 Unknown service`.

### Bundle savings are derived, never stored

`list_price_cents` and `saving_cents` are computed from the bundle's contents.
The stored `originalPrice` values had been inflated by $50 (Growth) and $100
(Scale), advertising savings of $80 and $130 when every bundle actually saves
**$30**.

| Bundle | Contents worth | Charged | Saving |
|---|---:|---:|---:|
| Starter | $325 | $295 | $30 |
| Growth | $830 | $800 | $30 |
| Scale | $1,300 | $1,270 | $30 |

> **Open business decision.** The page now shows the true $30. If the larger
> advertised savings are wanted, the fix is to *add contents* to those bundles,
> not to restore the numbers — overstated strike-through pricing carries
> regulatory exposure in both India and the US.

### Changing a price

Edit `catalog.json`. Both sides pick it up. `validateCatalog()` runs at boot and
refuses to start on a non-integer price, a negative price, a bundle priced above
its contents, or a bundle referencing an unknown service.

---

## 3. Payment verification

`packages/billing/src/services/paymentSecurity.js` — one implementation,
replacing four that had drifted.

### Verification is unconditional

Three handlers wrapped their check like this:

```js
if (razorpay_order_id && razorpay_payment_id && razorpay_signature) {
  ...verify...
}
// ← fell through and provisioned when the block was skipped
```

Verification was conditional on the attacker supplying the fields being
verified. Omitting `razorpay_signature` skipped it and wrote an active
subscription with no payment.

Now: the fields are **required**, absence is a failure, and comparison is
constant-time.

The only bypass is `ALLOW_UNVERIFIED_PAYMENTS=true`, for local development
without Razorpay keys. It is ignored when `NODE_ENV=production`, and the server
**refuses to boot** if both are set.

### A signature is not proof of payment

`verifyOrderPayment` proves the two ids were issued together. It says nothing
about whether money moved. `assertPaymentMatches` then confirms with Razorpay
that the payment is:

- `status === 'captured'` — not `authorized`, `failed` or `refunded`
- the expected **amount** and **currency**
- attached to the expected **order**

Previously the code fetched the payment and read only `.method`, so an
uncaptured payment still marked the order paid.

### Signature formats differ

| Flow | Signed payload |
|---|---|
| One-time order | `order_id \| payment_id` |
| Subscription | `payment_id \| subscription_id` |

Note the reversal. Getting it backwards fails closed, but silently.

---

## 4. Payment flows

### Subscription checkout (what the web app uses)

```
POST /api/expansion/subscriptions   { bundle_id | items, billing_country }
   → server prices the cart from the catalog
   → creates a Razorpay plan + subscription at the SERVER price
   → returns { subscription_id, plan_id, razorpay_key_id, total_cents, lines, fx_rate }

   [ Razorpay checkout opens in the browser ]

POST /api/expansion/subscriptions/activate
     { razorpay_subscription_id, razorpay_payment_id, razorpay_signature,
       bundle_id | items, billing_country }
   → verifies the signature (required, constant-time)
   → RE-PRICES from the catalog — the round-tripped amount is not trusted
   → writes vm_expansion_requests
   → issues the tax invoice + emails the PDF
```

### 4a. Duplicate protection

Every call to `createSubscriptionPurchase` creates a Razorpay **plan and
subscription**. With no guard, a double-clicked checkout produced two live
subscriptions and the customer was billed twice — every month, indefinitely.

Two checks run before any gateway object is created, both keyed on a **cart
signature**: the plan's `(name, amount, currency)`. `plans.name` comes from the
priced cart description, which is deterministic for a given cart, so this
identifies "the same purchase" without an extra fingerprint column.

| Situation | Behaviour |
|---|---|
| Unfinished checkout for the same cart, < 30 min old | **Resumed.** The existing subscription is returned, no new Razorpay objects. Response carries `reused: true` |
| Already `active` / `authenticated` / `pending` for the same cart | **409 `duplicate_subscription`**, with the existing subscription id and `retry_with: { allow_duplicate: true }` |
| Same cart, caller sent `allow_duplicate: true` | Allowed — running two of the same thing is legitimate, it just has to be deliberate |
| A different cart | Never blocked |

Refusing is deliberately not the same as blocking: a customer may genuinely want
a second VM bundle. Only an *identical* purchase is treated as an accident.

### Abandoned checkouts

A subscription whose checkout was never completed sits in Razorpay's `created`
state. It costs nothing immediately — Razorpay doesn't charge until
authentication — but the object and its checkout link stay live, so a customer
returning to a stale tab days later could authenticate a purchase they had
walked away from.

`cancelAbandonedSubscriptions()` runs hourly from the existing cleanup job and
cancels anything still in `created` after 60 minutes, reconciling the local row
even when the Razorpay call fails.

### One-time order

```
POST /api/payments/orders   { bundle_id | items }
   → priced server-side, Razorpay order created
POST /api/payments/verify   { razorpay_order_id, razorpay_payment_id, razorpay_signature }
   → ownership check → signature → assertPaymentMatches → capture → invoice
```

### Webhook

`POST /api/payments/webhook` — HMAC over the raw body, constant-time, de-duped
by signature. `subscription.charged` issues an invoice for that cycle,
idempotent on the payment id.

`payment.failed` no longer downgrades an order that already reached `paid`: a
late failure event for a succeeded order used to regress it to `attempted`.

---

## 5. Authorization

| Route group | Roles |
|---|---|
| `/api/payments/*` (spend) | `tenant_user`, `tenant_admin`, `admin` |
| `/api/expansion/*` (spend) | `tenant_user`, `tenant_admin` |
| `/api/invoices` (read) | own; `tenant_admin` sees their tenant; `admin` sees all |
| `/api/invoices/catalog` | public |
| `/api/plans` (write), `/api/invoices/tax/registrations` | `admin` |

`/api/payments/*` was guarded with `authorize('customer', 'admin')`. `customer`
is the legacy role replaced by `tenant_user` in migration 007, and `authorize`
does a strict `includes` — so every ordinary account got a 403 and the entire
surface was unreachable. That is why the web app routes around it via
`/api/expansion`.

> **Still true:** there are two billing implementations. `/api/expansion` is
> what the UI uses. Both are now protected, but consolidating them remains
> worthwhile — see §8.

`verifyPayment` also checks `order.user_id === req.user.id`; any authenticated
user could previously drive verification of any order by id.

---

### Credit purchases

Buying agent credits was a **third money path**, missed in the first
consolidation because it lives in `apps/rachdev-backend` rather than
`rachbase-backend` — even though the Rachbase billing dashboard is what calls
it. It ran its own Razorpay SDK instance, its own `price_usd * rate * 100` float
conversion, a non-constant-time signature comparison, and granted credits on the
signature alone. No order row, no payment row, no invoice.

It now goes through `createCreditPurchase` / `verifyCreditPurchase` in the same
service as everything else, which means credits gained: constant-time mandatory
verification, a captured/amount/currency assertion against Razorpay, order and
payment rows, ownership checks, and a tax invoice.

`CREDIT_PACKS` carries `price_cents` as the authoritative figure. `price_usd`
remains for display only — never multiply it to get an amount to charge.

---

## 6. Credits

`packages/billing/src/services/credits.js`

Deduction is transactional and cannot go negative:

- `SELECT ... FOR UPDATE` locks the balance row, so concurrent deductions cannot
  both read the same balance and each conclude there is enough.
- Balance update and ledger insert are in one transaction — they could
  previously diverge if the second statement failed.
- Below-balance deductions throw `InsufficientCreditsError` (HTTP 402).
  `allowOverdraft: true` exists for trusted internal callers that must not fail
  mid-operation; the overdraft is still recorded.
- `hasSufficientCredits()` is a non-throwing pre-check.

`addCredits` is idempotent on `razorpay_payment_id`, so a webhook retry cannot
double-credit.

---

## 7. Currency and FX

The catalog is priced in **USD**. Indian customers are charged in **INR**,
converted at `USD_TO_INR` (default 90).

- Conversion is integer-only: `Math.round(total_cents * USD_TO_INR)`.
- The rate used is returned as `fx_rate` and logged, so a charge can be
  reconciled later.
- **The billing form's country wins over IP geolocation.** IP took precedence,
  so a VPN silently changed the billing currency against the customer's stated
  country — which is also what matters for tax residency.

`Order.create` now **requires** an explicit ISO currency. The old positional
default was `USD` while the `plans` table defaulted to `INR` and the validators
described amounts as "paise", leaving four disagreeing assumptions.

> `USD_TO_INR` is a static env var and goes stale. Anything beyond occasional
> use wants a rate feed with the rate stored per transaction.

---

## 8. Audit resolution

Against [BILLING_AUDIT.md](./BILLING_AUDIT.md):

| # | Finding | Status |
|---|---|---|
| 1.1 | Client sets the price | **Fixed** — catalog pricing, client amounts ignored |
| 1.2 | Signature verification skippable | **Fixed** — required, constant-time, prod-safe bypass |
| 1.3 | DB priced at half; 5 services unorderable | **Fixed** — shared catalog |
| 1.4 | Checkout closed by dead `customer` role | **Fixed** |
| 2.1 | Payment status never checked | **Fixed** — `assertPaymentMatches` |
| 2.2 | Non-constant-time comparison | **Fixed** — one implementation |
| 2.3 | `createOrder` trusts client amount | **Fixed** |
| 2.4 | Credits can go negative | **Fixed** — transactional + locked |
| 2.5 | No ownership check on verify | **Fixed** |
| 2.6 | Webhook downgrades paid orders | **Fixed** — `paid` is terminal |
| 3.1 | Float money | **Fixed** — integer cents throughout |
| 3.2 | Four currency assumptions | **Fixed** — explicit, catalog-driven |
| 3.3 | Hardcoded FX rate | **Partial** — integer-safe, rate recorded; still a static env var |
| 3.4 | IP overrode billing country | **Fixed** — form wins |
| 4.1 | Overstated bundle savings | **Fixed** — derived; *pricing decision open* |
| 4.2 | Catalog in four places | **Fixed** — one file |
| 4.3 | Pricing page had no CTA | **Fixed** — bundle cards link to checkout |
| 5.2 | No invoices | **Fixed** — see BILLING_TAX_INVOICING.md |
| 5.3 | No tax | **Fixed** — see BILLING_TAX_INVOICING.md |
| 5.7 | Webhook secret unvalidated | **Fixed** — warns at boot |
| 5.4 | Duplicate active subscriptions | **Fixed** — cart-signature check; §4a |
| — | **Two billing implementations** | **Fixed** — one purchase service; §1a |
| — | Double-click created two subscriptions | **Fixed** — in-flight checkout resumed; §4a |
| — | Abandoned checkouts left live in Razorpay | **Fixed** — hourly cancellation; §4a |
| — | **Credits were a third money path** | **Fixed** — routed through the purchase service; §5a |
| — | Credits granted on signature alone | **Fixed** — capture + amount assertion |
| — | Credit purchases produced no invoice | **Fixed** — tax invoice issued |
| — | **Renewals recorded nothing** | **Fixed** — webhook now reaches expansion subscriptions |
| — | `next_charge_at` never written | **Fixed** — written on activation and each charge |

### Still open

| # | Finding | Note |
|---|---|---|
| 5.1 | No refund handling | **Won't do** — product decision, refunds are handled outside the system. Note that refunding in the Razorpay dashboard leaves the order `paid`, the invoice valid and any credits granted; reconcile manually |
| 5.5 | Double-cancel throws 502 | Razorpay called unconditionally |
| 5.6 | No idempotency on custom orders | **Won't fix** — `createCustomOrder` is unreachable from the UI (routes mounted, API client exists, no page calls it). Fix it or delete it when that path is revived |
| 5.8 | `createCustomOrder` swallows gateway failures | **Won't fix** — same reason |
| 5.8 | `createCustomOrder` swallows gateway failures | Returns 200 with a null order id |
| 5.9 | Provisioning is manual | Paid orders sit `pending` until an admin fulfils |
| 5.10 | Billing pages are large | 1,410 and 928 lines |
| — | `data/mock/billing.ts` | Dead file, contradicts real pricing. Could not delete (sandbox permissions) — **please remove it** |
| — | Duplicate `022_*` migrations | Not renamed: the runner tracks by filename, so renaming re-runs them on deployed databases |

---

## 9. Configuration

| Variable | Default | Notes |
|---|---|---|
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | — | Required to charge |
| `RAZORPAY_WEBHOOK_SECRET` | — | Warns at boot if missing; webhooks fail without it |
| `USD_TO_INR` | `90` | Static rate for INR billing |
| `ALLOW_UNVERIFIED_PAYMENTS` | unset | Dev only. Ignored in production; boot fails if set there |

Seller identity and tax configuration are in
[BILLING_TAX_INVOICING.md §7](./BILLING_TAX_INVOICING.md).

---

## 10. Testing

The catalog and verification modules are pure — no database needed:

```js
const { catalog, paymentSecurity } = require('@rach/billing');

catalog.priceOrder({ bundle_id: 'scale', total_cents: 1 });   // → 127000, payload ignored
catalog.priceCart([{ id: 'db', qty: 1 }]).subtotal_cents;      // → 20000
paymentSecurity.verifyOrderPayment({ razorpay_order_id: 'o1' }); // → throws signature_missing
```

Covered by the verification run: price tampering, unknown/duplicate/negative/
fractional/absurd quantities, advertised-vs-charged parity, bundle savings,
signature omission on both flows, wrong signatures, production bypass refusal,
uncaptured/failed/refunded payments, amount/order/currency mismatch, and integer
money across mixed carts.
