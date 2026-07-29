'use strict';

/**
 * @rach/billing — payments (Razorpay) + credits/metering for RachDev & RachBase.
 *
 * Both brands bill through here: RachBase sells VMs/containers/plans, and both
 * the deploy agent and the RachDev LLM gateway spend credits via the shared
 * `credits` service.
 *
 *   const { paymentRoutes, credits } = require('@rach/billing');
 *   app.use('/api/payments', paymentRoutes);
 *   await credits.deductCredits(tenantId, userId, tokens, 'LLM call');
 *
 * Depends on @rach/core (db/middleware) and @rach/identity (authenticate/authorize).
 */

const paymentRoutes    = require('./src/routes/payments');
const invoiceRoutes    = require('./src/routes/invoices');
const paymentController = require('./src/controllers/paymentController');
const invoiceController = require('./src/controllers/invoiceController');
const razorpay         = require('./src/services/razorpay');
const credits          = require('./src/services/credits');

const catalogModule    = require('./src/catalog');
const paymentSecurity  = require('./src/services/paymentSecurity');
const purchase         = require('./src/services/purchase');
const hooks            = require('./src/hooks');
const tax     = require('./src/services/tax');
const money   = require('./src/services/tax/money');
const invoice = require('./src/services/invoice');
const invoicePdf = require('./src/services/invoice/pdf');
const issueInvoiceForPayment = require('./src/services/invoice/issueForPayment');

const Plan         = require('./src/models/plan');
const Order        = require('./src/models/order');
const Payment      = require('./src/models/payment');
const Subscription = require('./src/models/subscription');

module.exports = {
  // routers
  paymentRoutes,
  invoiceRoutes,
  paymentController,
  invoiceController,

  // services
  razorpay,
  catalog: catalogModule,   // THE pricing authority — { priceOrder, priceCart, priceBundle, ... }
  paymentSecurity,          // { verifyOrderPayment, verifySubscriptionPayment, assertPaymentMatches }
  purchase,                 // THE money path — every purchase flows through this
  hooks,                    // { onSubscriptionCharged } — host app registers fulfilment
  credits,          // { CREDIT_PACKS, TOKENS_PER_CREDIT, getOrCreateBalance, deductCredits, addCredits }
  tax,              // { calculateTax, findRegistration, hasAnyRegistration, SELLER }
  money,            // integer minor-unit helpers — use these, never floats
  invoice,          // { issueInvoice, findById, listForUser, voidInvoice, ... }
  invoicePdf,       // { renderInvoicePdf, pdfFilename }
  issueInvoiceForPayment,

  // models
  Plan,
  Order,
  Payment,
  Subscription,
};
