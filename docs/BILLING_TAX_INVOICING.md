# Tax & Invoicing

How Rachbase calculates tax and issues invoices.

> **Not tax advice.** This documents a rate engine. Rates, nexus thresholds and
> SaaS taxability rules change, and US economic nexus is a threshold you can
> cross without noticing. Confirm your position with an accountant — especially
> the LUT export position (§3) and your US registrations (§4).

---

## 0. What existed before

Worth stating plainly, because the starting point was misleading: the product
**collected** a GSTIN (profile page, checkout form, with format validation) and
told customers *"GSTIN will appear on your tax invoices"* — but no tax was
calculated anywhere and no invoice was ever generated. Migration 028 and the
`@rach/billing` tax/invoice services are the first implementation of either.

---

## 1. Design principles

**We only charge tax where a `tax_registrations` row says we are registered.**
With no rows, every sale is untaxed and the invoice records `no_registration` as
its treatment, so the reason is auditable afterwards rather than being an
invisible default. Under-collection is a debt you can settle; over-collection is
money taken from a customer without authority.

**All money is integer minor units.** Paise and cents, as `BIGINT` in the
database and safe integers in JS. Tax rates are basis points (`1800` = 18%).
`packages/billing/src/services/tax/money.js` is the only place conversion
happens. This is a direct response to the audit finding that
`0.15 * 7 * 100 = 104.99999999999999` was reaching Razorpay as an order amount.

**Invoices are immutable.** Seller and buyer are snapshotted into the row at
issue time. Rendering never joins to `users`, so a customer editing their
address cannot retroactively rewrite invoices already issued to them.
Corrections are a void plus a reissue, never an edit.

**Adding a jurisdiction is a data change, not a code change.**

---

## 2. Architecture

```
                       calculateTax(ctx)
                              │
              ┌───────────────┴───────────────┐
              │  resolve jurisdiction         │
              │  → tax_registrations lookup   │
              └───────────────┬───────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
  registration          cross-border,          no match
  in buyer's           not registered              │
  country              in destination              │
        │                     │                     │
        ▼                     ▼                     ▼
  buyer-country        seller's export        zero, recorded as
  provider             rules (§3)             'no_registration'
        │
   ┌────┴────┬──────────┬─────────┐
   ▼         ▼          ▼         ▼
india_gst  us_sales   stripe_   taxjar
           _tax       tax
```

| File | Role |
|---|---|
| `services/tax/index.js` | Dispatch, registration lookup, reconciliation guard |
| `services/tax/money.js` | Integer money + basis-point helpers |
| `services/tax/providers/indiaGst.js` | CGST/SGST/IGST, export zero-rating |
| `services/tax/providers/usSalesTax.js` | Nexus-driven; zero unless registered |
| `services/tax/providers/external.js` | Stripe Tax and TaxJar adapters |
| `services/invoice/index.js` | Issuance, snapshots, idempotency |
| `services/invoice/numbering.js` | Gapless per-FY serial allocation |
| `services/invoice/pdf.js` | PDF rendering (pdfkit) |
| `services/invoice/issueForPayment.js` | The hook payment paths call |

### Dispatch is not simply "the buyer's country"

Two jurisdictions can have a claim on one sale: the buyer's, if we are
registered there; and the seller's, whose export rules apply to every outbound
sale. An Indian seller shipping to a US customer is a **zero-rated export under
§16 IGST** — the amount is zero either way, but the invoice must carry the LUT
declaration. Dispatching on the buyer alone would label it `no_registration` and
silently omit that declaration.

Order of precedence:

1. Registered in the buyer's country → that country's provider.
2. Cross-border and *not* registered in the destination → the seller's export rules.
3. Neither → zero, recorded as `no_registration`.

---

## 3. India GST

Implemented for SaaS / cloud infrastructure under **SAC 998315**.

| Situation | Treatment | Components |
|---|---|---|
| Seller state == buyer state | `intra_state` | CGST 9% + SGST 9% |
| Seller state != buyer state | `inter_state` | IGST 18% |
| Buyer outside India, LUT held | `export_zero_rated` | none |
| Buyer outside India, no LUT | `export_taxable` | IGST 18%, refundable |
| Buyer state unknown | `inter_state` | IGST 18% (safe default) |

Place of supply is taken from the buyer's **GSTIN** first (authoritative for a
registered recipient) and falls back to the address. An unknown buyer state
defaults to IGST because it cannot under-collect and is correctable on a revised
invoice.

**Export zero-rating assumes you hold a Letter of Undertaking.** If you do not,
set `GST_EXPORT_UNDER_LUT=false` and exports will be charged IGST, refundable
later. Getting this wrong in the permissive direction means under-collecting on
every export.

### Rach Dev LLP's position

Registered in **Uttar Pradesh (GST state code 09)**, with an LUT on file:

| Buyer | Treatment |
|---|---|
| Uttar Pradesh | CGST 9% + SGST 9% |
| Any other Indian state | IGST 18% |
| Outside India | Zero-rated export under LUT |

The total is 18% either way for Indian buyers — the split only decides which
government is paid and how the customer claims input credit. Charging CGST+SGST
on an inter-state supply files GSTR-1 incorrectly and breaks the customer's ITC
reconciliation, which is why the seller's state is load-bearing.

### Enabling collection

```bash
# 1. Put the real GSTIN in .env (SELLER_GSTIN, SELLER_STATE_CODE=UP)
# 2. Dry run — validates and prints the resulting treatment
npm run setup-tax -w rachbase-backend

# 3. Write the registration row
npm run setup-tax -w rachbase-backend -- --commit
```

The script **refuses to proceed** if `SELLER_GSTIN` and `SELLER_STATE_CODE`
disagree. A mismatch does not fail at runtime — it quietly produces CGST+SGST
where IGST is due, or the reverse, on every Indian invoice. That is the single
easiest way to get this wrong, so it is checked rather than trusted.

Until the row exists, every sale is taxed at 0% and recorded as
`no_registration`.

---

## 4. US sales tax

**Current position: not registered anywhere, so no US tax is charged.**

US sales tax is not the mirror of GST and is deliberately not modelled as one:

- No federal sales tax. It is levied by states, counties and cities — roughly
  11,000 jurisdictions.
- You collect only where you have **nexus**: physical presence, or economic
  nexus once you cross a state threshold (commonly $100k in sales or 200
  transactions in a rolling 12 months — the numbers and the clock vary).
- **Whether SaaS is taxable at all varies by state.** Taxable in NY, TX, PA, WA,
  AZ and others; exempt in California, Florida and Georgia; business-buyer-only
  in some.

So this provider ships **no rate table**. It collects only where a registration
row exists, and for anything beyond a flat manual rate it delegates to Stripe
Tax or TaxJar, which maintain rates and taxability as a product.

### The nexus warning

When a sale goes to a state that generally taxes SaaS and no registration
exists, the engine logs:

```
[tax] Export to NY, US — a state that generally taxes SaaS — with no US
registration. No US tax collected. Track your US sales by state against
economic-nexus thresholds.
```

This is where silent liability accrues: cross a threshold unknowingly and you
owe the uncollected tax **out of your own pocket**, since you can rarely go back
to customers for it. Grep your logs for `[tax]` periodically, and track US
revenue by state.

### Turning collection on for a state

Flat rate (simple, you maintain it):

```sql
INSERT INTO tax_registrations
  (country_code, region_code, registration_number, provider, rate_bps, tax_name)
VALUES ('US', 'NY', '<permit id>', 'manual', 800, 'Sales Tax');
```

Delegated (recommended once you have more than one or two states — rooftop-level
rates, not one state-wide number):

```sql
INSERT INTO tax_registrations (country_code, region_code, provider, tax_name)
VALUES ('US', 'NY', 'stripe_tax', 'Sales Tax');
```

Then set `STRIPE_SECRET_KEY` (plus `STRIPE_TAX_CODE`, default `txcd_10103001` for
SaaS) or `TAXJAR_API_KEY`. Declare your registrations in that provider's
dashboard too — the adapter asks them what to charge.

If a delegated provider errors or times out (5s), the engine **falls back to
charging zero** rather than guessing a rate, and logs it.

Both adapters are also usable for any other country: point a registration row at
them and they handle it.

---

## 5. Invoices

### Numbering

`RB/2026-27/000123` — series, Indian financial year (1 April – 31 March), and a
six-digit serial. 15 characters, inside the 16-character limit in Rule 46.

A plain Postgres `SEQUENCE` is not usable here: sequences deliberately leak
values on rollback, which would put gaps in a series that must be unbroken.
Allocation instead takes a row lock on `(series, fiscal_year)` inside the
issuing transaction, so a failed issuance releases the number.

### Issuance

Invoices are **never** created by client request — only as a side effect of a
captured payment. There is deliberately no `POST /api/invoices`; otherwise
anyone could mint a tax document.

Hooked into three paths, all via `issueInvoiceForPayment`:

| Path | Trigger |
|---|---|
| `paymentController.verifyPayment` | one-time order captured |
| `paymentController` webhook | `subscription.charged` |
| `expansionController.activateSubscription` | checkout completed |

Idempotent per Razorpay payment: a partial unique index on
`razorpay_payment_id` means webhook retries and double-clicked checkouts return
the existing invoice.

`issueInvoiceForPayment` **never throws**. An invoice is a downstream artifact of
money that has already moved — if PDF rendering or email fails, the caller must
not fail and leave the customer thinking the payment didn't go through. Failures
are logged and returned in the result; the invoice stays downloadable from the
dashboard.

### PDF

Rendered on demand with pdfkit (pure JS, no headless browser) from the
snapshotted data, so regenerating years later produces the same document. Covers
the Rule 46 fields: supplier name/address/GSTIN, invoice number and date,
recipient details, SAC code, taxable value, rate and amount split by component,
place of supply, and total.

The header reads **TAX INVOICE** when tax was charged and **INVOICE** when it
was not — calling a zero-tax document a tax invoice would be wrong.

---

## 6. API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/invoices` | any | List (own; admin sees all) |
| `GET` | `/api/invoices/:id` | owner/admin | Invoice + line items |
| `GET` | `/api/invoices/:id/pdf` | owner/admin | Download PDF |
| `POST` | `/api/invoices/quote` | any | Tax preview for checkout |
| `POST` | `/api/invoices/:id/void` | admin | Void (never delete) |
| `GET` | `/api/invoices/tax/registrations` | admin | List registrations |
| `POST` | `/api/invoices/tax/registrations` | admin | Add a registration |
| `DELETE` | `/api/invoices/tax/registrations/:id` | admin | Deactivate |

`tenant_admin` can read invoices billed to their own tenant.

`/quote` prices nothing — it takes server-priced lines and returns the tax
treatment that would apply. The checkout review step calls it so the customer
sees the real total before paying.

---

## 7. Configuration

### Seller identity (required for correct invoices)

| Variable | Default | Notes |
|---|---|---|
| `SELLER_LEGAL_NAME` | `Rach Dev LLP` | Printed on the invoice |
| `SELLER_GSTIN` | — | **Required for GST.** Also sets the seller's state |
| `SELLER_STATE_CODE` | — | Fallback if GSTIN is unset; decides intra vs inter-state |
| `SELLER_COUNTRY` | `IN` | Drives export treatment |
| `SELLER_PAN` | — | Optional |
| `SELLER_ADDRESS` | — | Printed on the invoice |
| `SELLER_EMAIL` | `BREVO_FROM_EMAIL` | Printed on the invoice |

### Behaviour

| Variable | Default | Notes |
|---|---|---|
| `INVOICE_SERIES` | `RB` | Number prefix |
| `GST_EXPORT_UNDER_LUT` | `true` | `false` → charge IGST on exports |

### Delegated providers (only if used)

| Variable | Notes |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe Tax |
| `STRIPE_TAX_CODE` | Default `txcd_10103001` (SaaS) |
| `TAXJAR_API_KEY` | TaxJar |
| `TAXJAR_FROM_COUNTRY` / `_STATE` / `_ZIP` | Ship-from for TaxJar |
| `TAXJAR_PRODUCT_TAX_CODE` | Default `30070` (SaaS) |

---

## 8. Frontend

| Component | Purpose |
|---|---|
| `@rach/ui/components/billing/InvoiceList` | History + PDF download (billing → Invoices tab) |
| `@rach/ui/components/billing/TaxSummary` | Tax breakdown in the checkout review step |
| `api.ts → invoices` | `list`, `get`, `download`, `quote` |
| `api.ts → formatMinor` / `formatRateBps` | Display helpers |

PDF download goes through `fetch` + blob rather than a plain link, because the
endpoint requires an `Authorization` header.

**The client never computes tax**, and should not compute the total it sends for
payment. `TaxSummary` renders whatever `/quote` returned.

---

## 9. Known gaps

| Gap | Notes |
|---|---|
| **Client still sends `total_cents`** | Not fixed here. See `BILLING_AUDIT.md` §1.1 — the tax engine prices correctly at invoice time, but the Razorpay charge is still built from a client-supplied amount. **This remains the highest-severity open issue.** |
| No credit notes | Void + reissue is the only correction path. GST wants a credit note for post-supply reductions |
| No reverse charge | Not applicable to domestic Indian SaaS, but needed if you buy services from abroad |
| No e-invoicing / IRN | Mandatory above ₹5 crore turnover. Will need an IRP integration |
| No GSTR-1 export | Invoices are queryable, but there is no filing-format export |
| No VAT/GST for other regions | UK, EU, AU, CA all have their own rules. The provider interface accommodates them; nothing is implemented |
| GSTIN not validated against GSTN | Format is checked; the number is not verified as live |
| Historical rate changes | `effective_from`/`effective_to` exist, but issuance always uses today's rate — no backdated reissue support |

---

## 10. Testing

The tax engine is pure and testable without a database:

```js
const { indiaGst, usSalesTax } = require('@rach/billing').tax;
const reg = { rate_bps: 1800, provider: 'manual' };
const seller = { gstin: '27AAAAA0000A1Z5', region_code: 'MH' };
const lines = [{ description: 'VM', quantity: 1, unit_price_minor: 10000, subtotal_minor: 10000 }];

indiaGst.calculate({ lines, buyer: { country_code: 'IN', gstin: '27BB…' }, registration: reg, seller });
// → intra_state, CGST 900 + SGST 900

indiaGst.calculate({ lines, buyer: { country_code: 'US' }, registration: reg, seller });
// → export_zero_rated, tax 0
```

Covered by the verification run: money conversion (including the `0.15 × 7`
float case), rate application and rounding, odd-amount component splits,
intra/inter-state/export GST, US zero-collection and post-registration
collection, fiscal-year boundaries, line-to-header reconciliation, and
idempotent reissue.
