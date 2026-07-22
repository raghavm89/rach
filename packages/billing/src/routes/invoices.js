'use strict';

const { Router } = require('express');
const authenticate = require('@rach/identity').authenticate;
const authorize = require('@rach/identity').authorize;
const parseId = require('@rach/core').parseId;
const { paginate } = require('@rach/core').paginate;
const {
  listInvoices,
  getInvoice,
  downloadInvoicePdf,
  quoteTax,
  voidInvoice,
  listRegistrations,
  createRegistration,
  deactivateRegistration,
} = require('../controllers/invoiceController');

const { listServices, listBundles, catalog } = require('../catalog');

const router = Router();

// ── Public catalog ───────────────────────────────────────────────────────────
// Declared before `authenticate` — the price list is public. Serving it from
// the same catalog.json the server prices from means the displayed price and
// the charged price cannot diverge.
router.get('/catalog', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    currency: catalog.currency,
    services: listServices(),
    bundles : listBundles(),   // savings computed, never stored
    usage_based: catalog.usage_based,
    included: catalog.included,
    footnotes: catalog.footnotes,
  });
});

router.use(authenticate);

// ── Tax registrations (admin) ────────────────────────────────────────────────
// Declared before /:id so "tax" isn't parsed as an invoice id.
router.get('/tax/registrations',        authorize('admin'), listRegistrations);
router.post('/tax/registrations',       authorize('admin'), createRegistration);
router.delete('/tax/registrations/:id', authorize('admin'), parseId(), deactivateRegistration);

// ── Tax quote for checkout ───────────────────────────────────────────────────
router.post('/quote', quoteTax);

// ── Invoices ─────────────────────────────────────────────────────────────────
// There is deliberately no POST /invoices: invoices are issued as a side effect
// of a captured payment, never on client request.
router.get('/',            paginate({ defaultLimit: 20, maxLimit: 100 }), listInvoices);
router.get('/:id',         parseId(), getInvoice);
router.get('/:id/pdf',     parseId(), downloadInvoicePdf);
router.post('/:id/void',   authorize('admin'), parseId(), voidInvoice);

module.exports = router;
