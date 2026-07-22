'use strict';

/**
 * Catalog + server-side pricing.
 *
 * **This module is the only thing permitted to decide what a cart costs.**
 *
 * Before it existed, `total_cents` arrived in the request body and was passed
 * straight to `razorpay.plans.create` — so a client could order the $1,270/mo
 * Scale bundle for one cent by editing a number. Every pricing path now goes
 * through `priceCart` / `priceBundle`, which read `catalog.json` and ignore any
 * amount the client supplies.
 *
 * All amounts are integer cents.
 */

const catalog = require('../../catalog.json');

const SERVICES = new Map(catalog.services.map((s) => [s.id, s]));
const BUNDLES  = new Map(catalog.bundles.map((b) => [b.id, b]));

class PricingError extends Error {
  constructor(message, code = 'invalid_cart') {
    super(message);
    this.name = 'PricingError';
    this.code = code;
    this.status = 400;
  }
}

/** Retail total of a bundle's contents, from the per-service prices. */
function bundleListPriceCents(bundle) {
  return Object.entries(bundle.items).reduce((sum, [id, qty]) => {
    const svc = SERVICES.get(id);
    if (!svc) throw new PricingError(`Bundle "${bundle.id}" references unknown service "${id}"`);
    return sum + svc.unit_price_cents * qty;
  }, 0);
}

/**
 * A bundle with its savings computed rather than stored.
 *
 * The audit found the stored `originalPrice` inflated by $50 on Growth and $100
 * on Scale, overstating savings as $80/$130 when every bundle actually saves
 * $30. Deriving it makes that class of drift impossible.
 */
function describeBundle(bundle) {
  const listPriceCents = bundleListPriceCents(bundle);
  return {
    ...bundle,
    list_price_cents: listPriceCents,
    saving_cents: listPriceCents - bundle.price_cents,
    lines: Object.entries(bundle.items).map(([id, qty]) => {
      const svc = SERVICES.get(id);
      return { id, name: svc.name, qty, unit_price_cents: svc.unit_price_cents };
    }),
  };
}

function getService(id) {
  return SERVICES.get(id) ?? null;
}

function getBundle(id) {
  const b = BUNDLES.get(id);
  return b ? describeBundle(b) : null;
}

function listServices() {
  return catalog.services.map((s) => ({ ...s }));
}

function listBundles() {
  return catalog.bundles.map(describeBundle);
}

const MAX_QTY = 1000;

function normalizeQty(qty, label) {
  const n = typeof qty === 'string' ? Number(qty) : qty;
  if (!Number.isInteger(n) || n < 1) {
    throw new PricingError(`Invalid quantity for ${label}: must be a positive integer`);
  }
  if (n > MAX_QTY) {
    throw new PricingError(`Quantity for ${label} exceeds the maximum of ${MAX_QTY}`);
  }
  return n;
}

/**
 * Price an arbitrary basket.
 *
 * @param {Array<{id:string, qty:number}>} items — only `id` and `qty` are read.
 *        Any `price`, `amount` or `total_cents` on the input is ignored.
 * @returns {{ lines, subtotal_cents, description, currency }}
 */
function priceCart(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new PricingError('items must be a non-empty array');
  }
  if (items.length > 50) {
    throw new PricingError('Too many distinct items in one order');
  }

  const seen = new Set();
  const lines = [];
  let subtotal = 0;

  for (const item of items) {
    const id = String(item?.id ?? '').trim();
    const svc = SERVICES.get(id);

    if (!svc) throw new PricingError(`Unknown service: "${id}"`, 'unknown_service');
    if (svc.orderable === false) throw new PricingError(`"${svc.name}" is not orderable`, 'not_orderable');
    if (seen.has(id)) throw new PricingError(`Duplicate line for "${id}" — combine the quantities`);
    seen.add(id);

    const qty = normalizeQty(item.qty, svc.name);
    const lineTotal = svc.unit_price_cents * qty;
    subtotal += lineTotal;

    lines.push({
      id,
      name: svc.name,
      qty,
      unit_price_cents: svc.unit_price_cents,
      subtotal_cents: lineTotal,
      sac_code: catalog.sac_code,
    });
  }

  return {
    lines,
    subtotal_cents: subtotal,
    description: lines.map((l) => `${l.qty}× ${l.name}`).join(', '),
    currency: catalog.currency,
  };
}

/**
 * Price a bundle by id. The bundle's own discounted price wins; the expanded
 * contents are returned as line items for the invoice.
 */
function priceBundle(bundleId) {
  const bundle = getBundle(bundleId);
  if (!bundle) throw new PricingError(`Unknown bundle: "${bundleId}"`, 'unknown_bundle');

  const listCents = bundle.list_price_cents;
  const discount = listCents - bundle.price_cents;

  // Distribute the discount across lines proportionally so line totals still
  // reconcile exactly to the charged price.
  let allocated = 0;
  const lines = bundle.lines.map((l, i) => {
    const gross = l.unit_price_cents * l.qty;
    const isLast = i === bundle.lines.length - 1;
    const lineDiscount = isLast
      ? discount - allocated
      : Math.round((gross / listCents) * discount);
    allocated += lineDiscount;

    return {
      id: l.id,
      name: l.name,
      qty: l.qty,
      unit_price_cents: l.unit_price_cents,
      subtotal_cents: gross - lineDiscount,
      sac_code: catalog.sac_code,
    };
  });

  const subtotal = lines.reduce((s, l) => s + l.subtotal_cents, 0);
  if (subtotal !== bundle.price_cents) {
    throw new PricingError(
      `Bundle "${bundleId}" reconciliation failed: lines ${subtotal} != price ${bundle.price_cents}`
    );
  }

  return {
    lines,
    subtotal_cents: bundle.price_cents,
    list_price_cents: listCents,
    saving_cents: discount,
    description: `${bundle.name} (${bundle.lines.map((l) => `${l.qty}× ${l.name}`).join(', ')})`,
    currency: catalog.currency,
    bundle_id: bundleId,
  };
}

/**
 * Price whatever the checkout sent: a bundle id, or a basket of items.
 * Never reads an amount from the caller.
 */
function priceOrder({ bundle_id, items }) {
  if (bundle_id) return priceBundle(bundle_id);
  return priceCart(items);
}

/** Startup self-check — catches a malformed catalog before it can misprice. */
function validateCatalog() {
  const problems = [];

  for (const s of catalog.services) {
    if (!Number.isInteger(s.unit_price_cents) || s.unit_price_cents < 0) {
      problems.push(`service "${s.id}" has a non-integer or negative price`);
    }
  }

  for (const b of catalog.bundles) {
    if (!Number.isInteger(b.price_cents) || b.price_cents < 0) {
      problems.push(`bundle "${b.id}" has a non-integer or negative price`);
    }
    try {
      const list = bundleListPriceCents(b);
      if (b.price_cents > list) {
        problems.push(`bundle "${b.id}" costs more than its contents (${b.price_cents} > ${list})`);
      }
    } catch (err) {
      problems.push(err.message);
    }
  }

  if (problems.length) {
    throw new Error(`Invalid catalog.json:\n  - ${problems.join('\n  - ')}`);
  }
  return true;
}

module.exports = {
  catalog,
  PricingError,
  getService,
  getBundle,
  listServices,
  listBundles,
  priceCart,
  priceBundle,
  priceOrder,
  validateCatalog,
  bundleListPriceCents,
};
