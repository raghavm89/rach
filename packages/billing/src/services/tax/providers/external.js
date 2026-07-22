'use strict';

/**
 * Adapters for external tax engines (Stripe Tax, TaxJar).
 *
 * Both conform to the same shape as the built-in providers, so
 * `tax_registrations.provider` selects between them with no call-site changes.
 *
 * They are intentionally thin: the whole point of delegating is that rates,
 * jurisdiction boundaries and SaaS taxability rules are somebody else's product
 * to maintain. We send an address and amounts, we get back tax.
 *
 * Failure policy: on any error we return null and the caller falls back to the
 * built-in provider, which charges zero and records why. Charging a guessed
 * rate would be worse than charging nothing — under-collection is a debt you
 * can settle, over-collection is money taken from a customer without authority.
 */

const { assertInt } = require('../money');

const TIMEOUT_MS = 5000;

async function withTimeout(promise, ms = TIMEOUT_MS) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`tax provider timeout after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// ── Stripe Tax ────────────────────────────────────────────────────────────────

/**
 * Uses Stripe's Tax Calculation API. Requires STRIPE_SECRET_KEY and Stripe Tax
 * enabled with your registrations declared in the Stripe dashboard.
 * https://docs.stripe.com/tax/calculating
 */
async function stripeTax({ lines, currency, buyer }) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.warn('[tax] provider=stripe_tax but STRIPE_SECRET_KEY is not set');
    return null;
  }

  const form = new URLSearchParams();
  form.set('currency', String(currency).toLowerCase());
  form.set('customer_details[address][country]', buyer.country_code || '');
  if (buyer.region_code)  form.set('customer_details[address][state]', buyer.region_code);
  if (buyer.postal_code)  form.set('customer_details[address][postal_code]', buyer.postal_code);
  if (buyer.city)         form.set('customer_details[address][city]', buyer.city);
  form.set('customer_details[address_source]', 'billing');

  lines.forEach((l, i) => {
    assertInt(l.subtotal_minor, `line[${i}].subtotal_minor`);
    form.set(`line_items[${i}][amount]`, String(l.subtotal_minor));
    form.set(`line_items[${i}][reference]`, `line-${i}`);
    // SaaS / cloud infrastructure. Adjust if you sell a different mix.
    form.set(`line_items[${i}][tax_code]`, process.env.STRIPE_TAX_CODE || 'txcd_10103001');
  });

  try {
    const res = await withTimeout(fetch('https://api.stripe.com/v1/tax/calculations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
    }));

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error('[tax] stripe_tax failed:', res.status, body?.error?.message);
      return null;
    }

    const calc = await res.json();
    return mapStripe(calc, lines);
  } catch (err) {
    console.error('[tax] stripe_tax error:', err.message);
    return null;
  }
}

function mapStripe(calc, originalLines) {
  const outLines = (calc.line_items?.data ?? []).map((li, i) => {
    const base = originalLines[i] ?? {};
    const breakdown = (li.tax_breakdown ?? []).map((b) => ({
      name: b.tax_rate_details?.display_name || 'Sales Tax',
      rate_bps: Math.round(parseFloat(b.tax_rate_details?.percentage_decimal ?? '0') * 100),
      amount_minor: b.amount ?? 0,
    }));
    return {
      ...base,
      sac_code: null,
      tax_rate_bps: breakdown.reduce((s, b) => s + b.rate_bps, 0),
      tax_amount_minor: li.amount_tax ?? 0,
      tax_breakdown: breakdown,
      total_minor: (base.subtotal_minor ?? li.amount ?? 0) + (li.amount_tax ?? 0),
    };
  });

  return {
    treatment: 'us_state_tax',
    place_of_supply: [calc.customer_details?.address?.state, calc.customer_details?.address?.country]
      .filter(Boolean).join(', '),
    tax_total_minor: calc.tax_amount_exclusive ?? 0,
    lines: outLines.length ? outLines : null,
    provider_reference: calc.id,
    notes: null,
  };
}

// ── TaxJar ────────────────────────────────────────────────────────────────────

/**
 * Uses TaxJar's /v2/taxes endpoint. Requires TAXJAR_API_KEY and a configured
 * nexus list on the TaxJar side. https://developers.taxjar.com/api/reference/
 *
 * TaxJar works in major units (dollars), so amounts are converted on the way
 * out and back — the only place in the billing code where that is allowed, and
 * the result is re-integerised immediately.
 */
async function taxJar({ lines, buyer }) {
  const key = process.env.TAXJAR_API_KEY;
  if (!key) {
    console.warn('[tax] provider=taxjar but TAXJAR_API_KEY is not set');
    return null;
  }

  const subtotalMinor = lines.reduce((s, l) => s + l.subtotal_minor, 0);

  const payload = {
    from_country: process.env.TAXJAR_FROM_COUNTRY || 'US',
    from_state:   process.env.TAXJAR_FROM_STATE   || undefined,
    from_zip:     process.env.TAXJAR_FROM_ZIP     || undefined,
    to_country:   buyer.country_code,
    to_state:     buyer.region_code,
    to_zip:       buyer.postal_code,
    to_city:      buyer.city,
    amount:       subtotalMinor / 100,
    shipping:     0,
    line_items: lines.map((l, i) => ({
      id: String(i),
      quantity: l.quantity ?? 1,
      unit_price: (l.unit_price_minor ?? l.subtotal_minor) / 100,
      product_tax_code: process.env.TAXJAR_PRODUCT_TAX_CODE || '30070', // SaaS
    })),
  };

  try {
    const base = process.env.TAXJAR_API_BASE || 'https://api.taxjar.com';
    const res = await withTimeout(fetch(`${base}/v2/taxes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }));

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error('[tax] taxjar failed:', res.status, body?.error);
      return null;
    }

    const { tax } = await res.json();
    if (!tax) return null;

    const totalTaxMinor = Math.round((tax.amount_to_collect ?? 0) * 100);
    const rateBps = Math.round((tax.rate ?? 0) * 10000);

    // TaxJar returns an order-level figure; distribute proportionally so line
    // totals still reconcile to the invoice total exactly.
    let allocated = 0;
    const outLines = lines.map((l, i) => {
      const isLast = i === lines.length - 1;
      const share = isLast
        ? totalTaxMinor - allocated
        : Math.round((l.subtotal_minor / subtotalMinor) * totalTaxMinor);
      allocated += share;
      return {
        ...l,
        sac_code: null,
        tax_rate_bps: rateBps,
        tax_amount_minor: share,
        tax_breakdown: share ? [{ name: `${buyer.region_code} Sales Tax`, rate_bps: rateBps, amount_minor: share }] : [],
        total_minor: l.subtotal_minor + share,
      };
    });

    return {
      treatment: 'us_state_tax',
      place_of_supply: `${buyer.region_code}, ${buyer.country_code}`,
      tax_total_minor: totalTaxMinor,
      lines: outLines,
      notes: null,
    };
  } catch (err) {
    console.error('[tax] taxjar error:', err.message);
    return null;
  }
}

module.exports = { stripeTax, taxJar };
