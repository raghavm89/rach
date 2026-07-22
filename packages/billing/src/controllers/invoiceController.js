'use strict';

/**
 * Invoice API.
 *
 * Read + download only. Invoices are issued as a side effect of a captured
 * payment, never by direct client request — otherwise anyone could mint a tax
 * document. Admins can void, which is the only mutation.
 */

const asyncHandler = require('@rach/core').asyncHandler;
const { paginated } = require('@rach/core').paginate;
const { pool } = require('@rach/core');
const invoiceService = require('../services/invoice');
const { renderInvoicePdf, pdfFilename } = require('../services/invoice/pdf');
const { calculateTax } = require('../services/tax');

/** Admins see everything; everyone else sees only their own. */
function canRead(invoice, user) {
  if (user.role === 'admin') return true;
  if (invoice.user_id === user.id) return true;
  // tenant_admin may see invoices billed to their tenant.
  if (user.role === 'tenant_admin' && invoice.tenant_id && invoice.tenant_id === user.tenant_id) return true;
  return false;
}

// GET /api/invoices
async function listInvoices(req, res) {
  const { rows, total } =
    req.user.role === 'admin'
      ? await invoiceService.listAll(req.pagination)
      : await invoiceService.listForUser(req.user.id, req.pagination);
  return res.json(paginated(rows, total, req.pagination));
}

// GET /api/invoices/:id
async function getInvoice(req, res) {
  const found = await invoiceService.findById(req.params.id);
  if (!found) return res.status(404).json({ error: 'Invoice not found' });
  if (!canRead(found.invoice, req.user)) return res.status(403).json({ error: 'Forbidden' });
  return res.json(found);
}

// GET /api/invoices/:id/pdf
async function downloadInvoicePdf(req, res) {
  const found = await invoiceService.findById(req.params.id);
  if (!found) return res.status(404).json({ error: 'Invoice not found' });
  if (!canRead(found.invoice, req.user)) return res.status(403).json({ error: 'Forbidden' });

  // Rendered on demand from the immutable snapshot rather than served from a
  // stored blob — same bytes every time, and no file storage to keep in sync.
  const pdf = await renderInvoicePdf(found);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${pdfFilename(found.invoice)}"`);
  res.setHeader('Content-Length', pdf.length);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  return res.end(pdf);
}

// POST /api/invoices/quote
// Tax preview for the checkout review step. Prices nothing — the caller supplies
// server-priced lines and gets back the tax treatment that would apply.
async function quoteTax(req, res) {
  const { lines, currency = 'USD', billing = {} } = req.body;

  if (!Array.isArray(lines) || !lines.length) {
    return res.status(400).json({ error: 'lines is required' });
  }
  if (lines.length > 50) {
    return res.status(400).json({ error: 'Too many lines' });
  }

  const normalized = [];
  for (const l of lines) {
    const qty = Number.isInteger(l.quantity) && l.quantity > 0 ? l.quantity : 1;
    const unit = l.unit_price_minor;
    if (!Number.isSafeInteger(unit) || unit < 0) {
      return res.status(400).json({ error: 'unit_price_minor must be a non-negative integer (minor units)' });
    }
    normalized.push({
      description: String(l.description || 'Item').slice(0, 200),
      quantity: qty,
      unit_price_minor: unit,
      subtotal_minor: unit * qty,
    });
  }

  const buyer = invoiceService.buildBuyer(
    { ...req.user, gstin: billing.gstin ?? req.user.gstin },
    billing
  );

  const tax = await calculateTax({ lines: normalized, currency, buyer });

  return res.json({
    currency,
    subtotal_minor : tax.subtotal_minor,
    tax_total_minor: tax.tax_total_minor,
    total_minor    : tax.total_minor,
    treatment      : tax.treatment,
    place_of_supply: tax.place_of_supply,
    notes          : tax.notes,
    // Aggregated components for display: [{ name: 'IGST', rate_bps, amount_minor }]
    components: aggregateComponents(tax.lines),
    lines: tax.lines.map((l) => ({
      description     : l.description,
      quantity        : l.quantity,
      unit_price_minor: l.unit_price_minor,
      subtotal_minor  : l.subtotal_minor,
      tax_rate_bps    : l.tax_rate_bps,
      tax_amount_minor: l.tax_amount_minor,
      total_minor     : l.total_minor,
    })),
  });
}

function aggregateComponents(lines) {
  const map = new Map();
  for (const l of lines) {
    for (const b of l.tax_breakdown ?? []) {
      const key = `${b.name}|${b.rate_bps}`;
      const cur = map.get(key) ?? { name: b.name, rate_bps: b.rate_bps, amount_minor: 0 };
      cur.amount_minor += b.amount_minor;
      map.set(key, cur);
    }
  }
  return [...map.values()];
}

// POST /api/invoices/:id/void  — admin only
async function voidInvoice(req, res) {
  const voided = await invoiceService.voidInvoice(req.params.id, req.body?.reason);
  if (!voided) return res.status(404).json({ error: 'Invoice not found or already void' });
  return res.json({ message: 'Invoice voided', invoice: voided });
}

// ── Tax registrations (admin) ────────────────────────────────────────────────

// GET /api/invoices/tax/registrations
async function listRegistrations(req, res) {
  const { rows } = await pool.query(
    'SELECT * FROM tax_registrations ORDER BY country_code, region_code NULLS FIRST'
  );
  return res.json({ registrations: rows });
}

// POST /api/invoices/tax/registrations
async function createRegistration(req, res) {
  const {
    country_code, region_code = null, registration_number = null,
    provider = 'manual', rate_bps = null, tax_name = null,
    effective_from = null,
  } = req.body;

  if (!country_code || String(country_code).length !== 2) {
    return res.status(400).json({ error: 'country_code must be a 2-letter ISO code' });
  }
  if (!['manual', 'stripe_tax', 'taxjar'].includes(provider)) {
    return res.status(400).json({ error: 'provider must be manual, stripe_tax or taxjar' });
  }
  if (provider === 'manual' && !Number.isInteger(rate_bps)) {
    return res.status(400).json({ error: 'rate_bps (integer basis points) is required for provider=manual' });
  }

  const { rows } = await pool.query(
    `INSERT INTO tax_registrations
       (country_code, region_code, registration_number, provider, rate_bps, tax_name, effective_from)
     VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7::date, CURRENT_DATE))
     RETURNING *`,
    [
      String(country_code).toUpperCase(),
      region_code ? String(region_code).toUpperCase() : null,
      registration_number, provider, rate_bps, tax_name, effective_from,
    ]
  );

  return res.status(201).json({ message: 'Tax registration created', registration: rows[0] });
}

// DELETE /api/invoices/tax/registrations/:id  — deactivate, never hard-delete
async function deactivateRegistration(req, res) {
  const { rows } = await pool.query(
    `UPDATE tax_registrations
        SET is_active = FALSE, effective_to = CURRENT_DATE, updated_at = NOW()
      WHERE id = $1 RETURNING *`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Registration not found' });
  return res.json({ message: 'Registration deactivated', registration: rows[0] });
}

module.exports = {
  listInvoices:           asyncHandler(listInvoices),
  getInvoice:             asyncHandler(getInvoice),
  downloadInvoicePdf:     asyncHandler(downloadInvoicePdf),
  quoteTax:               asyncHandler(quoteTax),
  voidInvoice:            asyncHandler(voidInvoice),
  listRegistrations:      asyncHandler(listRegistrations),
  createRegistration:     asyncHandler(createRegistration),
  deactivateRegistration: asyncHandler(deactivateRegistration),
};
