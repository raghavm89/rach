# Rachbase — Billing & Pricing Audit

> **STATUS: RESOLVED (most findings).** All P0 findings and the majority of P1–P2
> have been implemented. See **[BILLING.md §8](./BILLING.md#8-audit-resolution)**
> for a finding-by-finding resolution table and what remains open.
>
> This document is kept as the record of what was found and why it mattered.
> The vulnerable code it quotes no longer exists.

Scope: `packages/billing` (paymentController, routes, models, razorpay, credits),
`apps/rachbase-backend/src/controllers/expansionController.js`,
`apps/rachbase-backend/src/{routes/expansion.js,routes/plans.js,controllers/planController.js,services/serviceBilling.js}`,
`packages/core/src/db/migrations/{004,008,011,012,022_agent_credits,025}`,
`apps/rachbase-web/src/app/pricing/page.tsx`,
`apps/rachbase-web/src/app/dashboard/billing/{page.tsx,checkout/page.tsx}`,
`packages/ui/src/components/sections/PricingSection.tsx`.

---

## Executive summary

**Anyone with an account can currently obtain any service for any price they choose,
or for free.** There are three independent ways to do it, all reachable from a
normal authenticated session. These are not theoretical — they're the ordinary
request shapes of the live checkout with one field changed or removed.

There is also a **second, dead billing implementation** (`/api/payments/*`) that
is unreachable due to a role bug, and whose existence hides the fact that the
real money path (`/api/expansion/*`) has none of its protections.

Read §1 before anything else.

---

## 1. P0 — Revenue-critical

### 1.1 The client sets the price

`expansionController.createSubscriptionOrder` (line 437) and
`verifyCustomPayment` (line 386) both take `total_cents` **straight from the
request body** and never compare it to a catalog:

```js
const { items, description, total_cents, currency = 'USD', billing_country } = req.body;
if (!total_cents || !description) return res.status(400).json({ error: '...' });
// ...
monthlyAmountSmall = total_cents;            // ← becomes the Razorpay plan amount
const plan = await razorpay.plans.create({
  item: { name: description, amount: monthlyAmountSmall, currency: billingCurrency, description },
});
```

The web checkout computes the total in the browser
(`checkout/page.tsx:129 → totalCents: totalDollars * 100`) and POSTs it. Change
that number and the Razorpay plan is created at the new price.

**Exploit:** `POST /api/expansion/subscriptions` with
`{"items":[...Scale bundle...],"description":"Scale Bundle","total_cents":1}`
→ a $1,270/mo bundle billed at $0.01/mo, indefinitely.

The fix is to price the cart server-side from `items` and ignore any
client-supplied total — which is exactly what `createCustomOrder` already does
one function above (§1.3 covers why that one is still wrong).

### 1.2 Signature verification is optional — omit a field, skip the check

The same pattern appears in **three** handlers:

| Handler | Line |
|---|---|
| `verifyExpansionPayment` | 139 |
| `verifyCustomPayment` | 394 |
| `activateSubscription` | 537 |

```js
// Verify signature if Razorpay payment IDs are present
if (razorpay_order_id && razorpay_payment_id && razorpay_signature) {
  const expected = crypto.createHmac('sha256', ...).digest('hex');
  if (expected !== razorpay_signature) {
    return res.status(400).json({ error: 'Payment signature verification failed' });
  }
}
// ← falls through here and provisions when the block is skipped
```

The guard makes verification conditional on the attacker supplying the very
fields being verified. Omit `razorpay_signature` and control flow proceeds
directly to the `INSERT`.

**Exploit:** `POST /api/expansion/subscriptions/activate` with
`{"description":"Scale Bundle","total_cents":127000}` and no Razorpay fields at
all → a row in `vm_expansion_requests` with `subscription_status: 'active'`,
no payment, no gateway involvement.

This is worse than 1.1: it doesn't require paying anything.

**Fix:** signature fields must be *required*, and verification must be
unconditional. If a legitimate dev-mode path needs to bypass the gateway, gate
it on an explicit server-side flag (`ALLOW_UNVERIFIED_PAYMENTS`, default off,
refused when `NODE_ENV=production`) — never on the shape of user input.

### 1.3 Server-side price for Managed PostgreSQL is half the advertised price

`expansionController.js:331`:

```js
// Prices in cents — single source of truth shared with the frontend catalog
const SERVICE_PRICES = { vm: 10000, lb: 2500, db: 10000 };  // db = $100
```

| Service | Advertised | Server | Delta |
|---|---:|---:|---|
| VM | $100.00 | $100.00 | ok |
| Load Balancer | $25.00 | $25.00 | ok |
| **Managed PostgreSQL** | **$200.00** | **$100.00** | **−$100 per unit per month** |
| Additional Disk | $0.15 | — | rejected: "Unknown service" |
| Additional Public IP | $10.00 | — | rejected |
| VM Observability | $25.00 | — | rejected |
| Workload Monitoring | $25.00 | — | rejected |
| Service (unit) | $15.00 | — | rejected |

Two separate problems: every custom order containing a database undercharges by
$100/month, and five of the eight advertised services **cannot be ordered at
all** through `createCustomOrder` — it returns `400 Unknown service`.

The comment calling this "single source of truth shared with the frontend
catalog" is the tell: nothing enforces that sharing, and it has already drifted.

### 1.4 Checkout is closed to every normal user (`/api/payments/*`)

`packages/billing/src/routes/payments.js` guards `subscribe`, `orders`, and
`verify` with:

```js
authorize('customer', 'admin')
```

`customer` is the **legacy** role name, replaced by `tenant_user` in migration
007. `authorize` does a strict `roles.includes(req.user.role)`, and
self-registration assigns `tenant_user`. So every ordinary account gets `403`
on all three endpoints.

This is why the whole `/api/payments` surface appears unused — the web app
routes around it via `/api/expansion`. Which means **the maintained, protected
implementation is dead and the live one is the unprotected one.** Decide which
is canonical and delete or fix the other; keeping both guarantees the fixes in
§1.1–1.2 get applied to only one.

---

## 2. P1 — Payment integrity

### 2.1 `verifyPayment` never checks the payment actually succeeded

`paymentController.js:159`:

```js
const rzPayment = await razorpay.payments.fetch(razorpay_payment_id);
// ... only rzPayment.method is ever read
await Order.updateStatus(razorpay_order_id, 'paid');
```

The fetched payment's `status` and `amount` are ignored. A payment in
`authorized` (not captured), `refunded`, or `failed` state marks the order
`paid`. Assert `rzPayment.status === 'captured'`, `rzPayment.amount === order.amount`,
and `rzPayment.currency === order.currency`.

### 2.2 Non-constant-time signature comparison

The webhook handler does this correctly (`crypto.timingSafeEqual`, length check —
`paymentController.js:210`). Every other comparison uses `!==`:

- `paymentController.verifyPayment:154`
- `expansionController` lines 144, 399, 542

`serviceBilling.verifyPayment` also does it correctly. Three different standards
in one codebase; standardise on the `timingSafeEqual` helper.

### 2.3 `createOrder` trusts a client amount (`/api/payments`)

`paymentController.createOrder:90` takes `amount` from the body with only
`isInt({gt:0})` validation and passes it to `razorpay.orders.create`. Same class
of bug as §1.1. Currently unreachable because of §1.4 — it becomes exploitable
the moment that role bug is fixed. **Fix both together.**

### 2.4 Credits can go negative

`packages/billing/src/services/credits.js:39`:

```js
await pool.query(
  `UPDATE tenant_credits SET balance = balance - $1 WHERE tenant_id = $2`,
  [credits, tenantId]
);
```

No `WHERE balance >= $1`, no check of the result, no transaction around the
balance update and the ledger insert. A tenant at zero keeps consuming, and a
failed ledger insert silently desynchronises balance from history.

Wrap both statements in a transaction and make the deduction conditional,
returning the updated row so the caller can reject when it's insufficient.

### 2.5 No ownership check in `verifyPayment`

`paymentController.verifyPayment` looks the order up by `razorpay_order_id` and
never confirms `order.user_id === req.user.id`. Any authenticated user can drive
verification of another user's order. Impact is limited (the payment is
attributed to the order's owner), but it's a free cross-tenant write.

### 2.6 Webhook can downgrade a paid order

`payment.failed` (line 289) unconditionally sets the order to `attempted`. A
late-arriving failure for an order already marked `paid` will regress it. Guard
the transition on current status.

---

## 3. P2 — Money representation and currency

### 3.1 Floating-point money, end to end

The frontend catalog stores dollars as floats, including `price: 0.15` for disk,
then multiplies:

```ts
// checkout/page.tsx:127-129
const totalDollars = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
return { ..., totalCents: totalDollars * 100 };
```

`0.15 * 7 * 100` → `104.99999999999999`. That non-integer reaches
`razorpay.orders.create({ amount })`, which requires an integer in the minor
unit. Store and compute in integer cents throughout; format for display only.

### 3.2 Currency is inconsistent in four places

| Location | Currency |
|---|---|
| `orders` table default (migration 004) | `USD` |
| `Order.create` default | `USD` |
| `plans` table / `Plan.create` default | `INR` |
| `planController.createPlan` default | `USD`, with the comment `amount, // in paise` |
| `payments.js` validator message | "positive integer (in paise)" |
| `dashboard/billing/page.tsx:214` | `r.currency ?? 'INR'` |
| `dashboard/billing/page.tsx:181` | hardcoded `'USD'` |
| Pricing page | "All prices in USD" |

Paise is the INR minor unit; cents is the USD minor unit. The product is priced
in USD. Pick one storage currency, store the minor unit as an integer, and make
every default explicit rather than positional.

### 3.3 Hardcoded FX rate

`expansionController.js:454`:

```js
const USD_TO_INR = parseFloat(process.env.USD_TO_INR || '90');
```

A stale env var silently mis-bills every Indian customer, and the rate at
capture time isn't recorded on the row — so a later reconciliation can't tell
what rate was actually charged. Persist the rate and the converted amount
alongside the order.

### 3.4 Country detection drives billing currency, IP first

`customerCountry = ipCountry || formCountry` — the IP wins over what the customer
typed on the billing form. A VPN or a mis-resolving IP changes the billing
currency against the customer's stated country. Prefer the explicit form value;
use IP only as a fallback. (Also relevant to tax residency.)

---

## 4. P2 — Pricing page correctness

### 4.1 Two of the three bundles overstate the savings

Computed from the advertised per-service prices on the same page:

| Bundle | Contents | True list | Shown as | Claimed saving | Actual saving |
|---|---|---:|---:|---:|---:|
| Starter | 1 VM + 1 LB + 1 DB | $325 | $325 ✅ | $30 | $30 |
| **Growth** | 3 VM + 1 LB + 2 DB + 3 IP + 3 OBS | **$830** | **$880** ❌ | $80 | $30 |
| **Scale** | 5 VM + 1 LB + 3 DB + 5 IP + 5 OBS | **$1,300** | **$1,400** ❌ | $130 | $30 |

The `originalPrice` fields for Growth and Scale are inflated by $50 and $100.
Every bundle actually saves exactly $30; the page advertises up to $130.

Overstated strike-through pricing is a consumer-protection exposure in most
jurisdictions (India's CCPA rules on misleading advertisement, FTC pricing
guidance in the US), independent of the engineering issue. Worth a decision from
whoever owns pricing: correct the `originalPrice`, or change the bundle contents
to justify it.

The same wrong numbers are duplicated in `dashboard/billing/page.tsx:156,168`
and `checkout/page.tsx:49,50`.

### 4.2 The catalog is copy-pasted in four places

| File | What |
|---|---|
| `packages/ui/src/components/sections/PricingSection.tsx` | Marketing catalog + bundles |
| `apps/rachbase-web/src/app/dashboard/billing/page.tsx:54-170` | Same catalog + bundles |
| `apps/rachbase-web/src/app/dashboard/billing/checkout/page.tsx:37-50` | Same again |
| `apps/rachbase-backend/.../expansionController.js:331` | `SERVICE_PRICES` (already drifted, §1.3) |

Plus `credits.js CREDIT_PACKS` duplicated at `dashboard/billing/page.tsx:452`
(the frontend copy adds a `bonus: '+10%'` field the backend doesn't know about).

This is the root cause of §1.3 and §4.1. One catalog module, imported by both
sides, with the server as the pricing authority.

### 4.3 The pricing page cannot sell anything

The bundle cards in `PricingSection.tsx` render price and contents but have **no
CTA** — no button, no link. The only conversion path on `/pricing` is "Contact
Sales" in the enterprise callout. A logged-out visitor reading the Growth bundle
has nowhere to click.

### 4.4 Misc

- `pricing/page.tsx` metadata says "Starter, Growth, and Scale plans" — fine —
  but the description mentions "AI agents bundled in one bill", which no longer
  matches the infrastructure-only catalog on the page.
- `data/mock/billing.ts` (mock plan "Growth" at `price: 79`) is dead code — not
  imported anywhere. It contradicts the real $800 Growth bundle; delete it before
  someone wires it up.
- The FAQ hardcodes every price in prose ("$100/month", "$0.15/GB",
  "$200/month"). These will drift from the catalog on the next price change.

---

## 5. P3 — Gaps and hygiene

| # | Issue |
|---|---|
| 5.1 | **No refund handling anywhere** — no endpoint, no `refund.*` webhook case, no state |
| 5.2 | **No invoices** — `mock/billing.ts` defines an `Invoice` type; nothing implements it. GST-registered Indian customers will need them |
| 5.3 | No tax/GST calculation, despite a `gstin` field on the billing form and in the user profile |
| 5.4 | `subscribe` doesn't check for an existing active subscription — a user can create several |
| 5.5 | `cancelSubscription` calls Razorpay unconditionally; cancelling twice throws a 502 |
| 5.6 | `expansionController` has no idempotency, while `/api/payments` routes use `idempotency()`. Double-clicking checkout creates duplicate Razorpay plans |
| 5.7 | `RAZORPAY_WEBHOOK_SECRET` isn't validated at boot; if unset, `createHmac` throws on every webhook and Razorpay sees 500s |
| 5.8 | `createCustomOrder` swallows Razorpay failures (`console.warn`) and returns `200` with `razorpay_order_id: null` — the UI can't distinguish success from a gateway outage |
| 5.9 | `expansion` writes go to `vm_expansion_requests` with `status: 'pending'` and require manual admin fulfilment — worth documenting as intentional, since nothing provisions automatically after payment |
| 5.10 | `dashboard/billing/page.tsx` is 1,410 lines and `checkout/page.tsx` is 928, both mixing catalog data, Razorpay SDK loading, and presentation |

---

## 6. Suggested order of work

1. **§1.2** — unconditional signature verification in all three handlers. Smallest diff, stops free provisioning.
2. **§1.1 + §2.3** — price every cart server-side; never accept `total_cents`.
3. **§1.3 + §4.2** — one shared catalog module as the pricing authority; fixes the DB underpricing and the missing services.
4. **§1.4** — decide between `/api/payments` and `/api/expansion`; delete the loser.
5. **§2.1, §2.2, §2.4** — payment status assertion, constant-time compares, transactional credits.
6. **§3.1, §3.2** — integer cents and a single currency convention.
7. **§4.1** — pricing decision on the bundle savings, then correct all three copies.
8. **§4.3** and the P3 list.

Steps 1–3 are the ones that should not wait for a release cycle.

---

## 7. Verification notes

Claims in this document were checked against the source rather than inferred:

- Bundle arithmetic recomputed from the per-service prices in `PricingSection.tsx`
- `SERVICE_PRICES` compared field-by-field against the advertised catalog
- `authorize()` semantics confirmed in `packages/identity/src/middleware/role.js`
  (strict `includes`), and `customer`'s replacement confirmed in migration 007
- Signature-bypass pattern located at three call sites by grep, each confirmed
  to fall through to a database write
- `req.rawBody` confirmed correctly captured in `apps/rachbase-backend/src/app.js:65`
  before `express.json`, so the webhook HMAC is sound

Not verified (would need a running environment): actual Razorpay API behaviour
for non-integer `amount`, and whether any production data already reflects the
$100 database underpricing.
