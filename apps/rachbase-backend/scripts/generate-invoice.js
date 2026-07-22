#!/usr/bin/env node
'use strict';

/**
 * Generate an invoice PDF from a JSON description, without touching the database.
 *
 * This exists for invoices that must be produced outside the normal flow —
 * historical charges taken before Rachbase had invoicing, corrections, or
 * anything raised manually. It uses the SAME renderer and the SAME tax engine
 * as live issuance, so a document produced here is identical in form to one the
 * app would have issued.
 *
 * What it does NOT do: allocate an invoice number from the live sequence or
 * write to the invoices table. Numbers are supplied in the input file, so this
 * cannot create a gap in, or a collision with, the production series. If you
 * want these recorded in the database, use adopt-legacy-subscription.js
 * --with-invoices instead.
 *
 * Usage:
 *   node scripts/generate-invoice.js invoices.json [outdir]
 *
 * See invoice-input.example.json for the input shape.
 */

const fs = require('fs');
const path = require('path');

const { renderInvoicePdf, pdfFilename } = require('@rach/billing').invoicePdf;
const { indiaGst, usSalesTax } = require('@rach/billing').tax;
const { applyRateBps, splitTax } = require('@rach/billing').money;

// ── Tax, computed locally so no DB/registration lookup is needed ──────────────

function computeTax({ lines, seller, buyer, gstRateBps = 1800, exportUnderLut = true }) {
  const sellerCountry = (seller.country_code || 'IN').toUpperCase();
  const buyerCountry = (buyer.country_code || '').toUpperCase();

  // No seller GSTIN → not registered → no tax, recorded as such.
  if (!seller.gstin) {
    return zero(lines, buyerCountry || 'unknown', 'no_registration',
      'No GST registration configured — no tax charged.');
  }

  if (sellerCountry === 'IN') {
    const prev = process.env.GST_EXPORT_UNDER_LUT;
    process.env.GST_EXPORT_UNDER_LUT = exportUnderLut ? 'true' : 'false';
    try {
      return indiaGst.calculate({
        lines,
        buyer,
        registration: { rate_bps: gstRateBps, provider: 'manual', tax_name: 'GST' },
        seller,
      });
    } finally {
      if (prev === undefined) delete process.env.GST_EXPORT_UNDER_LUT;
      else process.env.GST_EXPORT_UNDER_LUT = prev;
    }
  }

  if (sellerCountry === 'US') {
    return usSalesTax.calculate({ lines, buyer, registration: null });
  }

  return zero(lines, buyerCountry, 'no_registration', 'No tax engine for this seller country.');
}

function zero(lines, place, treatment, notes) {
  return {
    treatment,
    place_of_supply: place,
    tax_total_minor: 0,
    lines: lines.map((l) => ({
      ...l, sac_code: '998315', tax_rate_bps: 0, tax_amount_minor: 0,
      tax_breakdown: [], total_minor: l.subtotal_minor,
    })),
    notes,
  };
}

// ── Build one invoice ─────────────────────────────────────────────────────────

function buildInvoice(spec, seller, defaults) {
  const currency = (spec.currency || defaults.currency || 'INR').toUpperCase();

  const lines = spec.lines.map((l, i) => {
    const qty = Number.isInteger(l.quantity) && l.quantity > 0 ? l.quantity : 1;
    const unit = l.unit_price_minor;
    if (!Number.isSafeInteger(unit)) {
      throw new TypeError(
        `lines[${i}].unit_price_minor must be an integer in minor units ` +
        `(paise/cents) — received ${JSON.stringify(unit)}`
      );
    }
    return {
      line_no: i + 1,
      description: l.description,
      quantity: qty,
      unit_price_minor: unit,
      subtotal_minor: unit * qty,
    };
  });

  const buyer = spec.buyer || defaults.buyer;
  const tax = computeTax({
    lines,
    seller,
    buyer,
    gstRateBps: defaults.gst_rate_bps ?? 1800,
    exportUnderLut: defaults.export_under_lut !== false,
  });

  const subtotal = lines.reduce((s, l) => s + l.subtotal_minor, 0);
  const taxTotal = tax.tax_total_minor;

  // Same reconciliation guard the live engine applies.
  const lineSum = tax.lines.reduce((s, l) => s + (l.tax_amount_minor ?? 0), 0);
  if (lineSum !== taxTotal) {
    throw new Error(`Tax reconciliation failed for ${spec.invoice_number}: ${lineSum} != ${taxTotal}`);
  }

  const invoice = {
    invoice_number: spec.invoice_number,
    issued_at: spec.issued_at ? new Date(spec.issued_at) : new Date(),
    status: spec.status || 'paid',
    currency,
    subtotal_minor: subtotal,
    tax_total_minor: taxTotal,
    total_minor: subtotal + taxTotal,
    place_of_supply: tax.place_of_supply,
    tax_treatment: tax.treatment,
    seller_json: seller,
    buyer_json: buyer,
    tax_json: { treatment: tax.treatment, notes: tax.notes },
    razorpay_payment_id: spec.razorpay_payment_id || null,
    razorpay_order_id: spec.razorpay_order_id || null,
    razorpay_subscription_id: spec.razorpay_subscription_id || null,
    notes: spec.notes || tax.notes || null,
  };

  const pdfLines = tax.lines.map((l) => ({
    line_no: l.line_no,
    description: l.description,
    sac_code: l.sac_code,
    quantity: l.quantity,
    unit_price_minor: l.unit_price_minor,
    subtotal_minor: l.subtotal_minor,
    tax_rate_bps: l.tax_rate_bps,
    tax_amount_minor: l.tax_amount_minor,
    tax_breakdown: l.tax_breakdown,
    total_minor: l.total_minor,
  }));

  return { invoice, lines: pdfLines };
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const inputPath = process.argv[2];
  const outDir = process.argv[3] || path.join(process.cwd(), 'invoices-out');

  if (!inputPath) {
    console.error('Usage: node scripts/generate-invoice.js <input.json> [outdir]');
    process.exit(1);
  }

  const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const { seller, defaults = {}, invoices } = input;

  if (!seller) throw new Error('input.seller is required');
  if (!Array.isArray(invoices) || !invoices.length) throw new Error('input.invoices must be a non-empty array');

  fs.mkdirSync(outDir, { recursive: true });

  const fmt = (m, c) => new Intl.NumberFormat(c === 'INR' ? 'en-IN' : 'en-US',
    { style: 'currency', currency: c }).format(m / 100);

  console.log(`\nSeller: ${seller.legal_name}${seller.gstin ? `  GSTIN ${seller.gstin}` : '  (no GSTIN — no tax will be charged)'}\n`);

  for (const spec of invoices) {
    const built = buildInvoice(spec, seller, defaults);
    const pdf = await renderInvoicePdf(built);
    const file = path.join(outDir, pdfFilename(built.invoice));
    fs.writeFileSync(file, pdf);

    const i = built.invoice;
    const components = new Map();
    for (const l of built.lines) {
      for (const b of l.tax_breakdown || []) {
        components.set(b.name, (components.get(b.name) ?? 0) + b.amount_minor);
      }
    }
    const taxStr = components.size
      ? [...components].map(([n, a]) => `${n} ${fmt(a, i.currency)}`).join(' + ')
      : 'no tax';

    console.log(`  ${i.invoice_number}  ${new Date(i.issued_at).toISOString().slice(0, 10)}  ` +
                `${fmt(i.subtotal_minor, i.currency)} + ${taxStr} = ${fmt(i.total_minor, i.currency)}`);
    console.log(`    treatment: ${i.tax_treatment}   place of supply: ${i.place_of_supply}`);
    console.log(`    → ${file}\n`);
  }

  console.log(`Done. ${invoices.length} PDF(s) in ${outDir}\n`);
}

main().catch((err) => {
  console.error('\nFAILED:', err.message);
  process.exit(1);
});
