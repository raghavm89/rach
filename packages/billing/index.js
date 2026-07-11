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
const paymentController = require('./src/controllers/paymentController');
const razorpay         = require('./src/services/razorpay');
const credits          = require('./src/services/credits');

const Plan         = require('./src/models/plan');
const Order        = require('./src/models/order');
const Payment      = require('./src/models/payment');
const Subscription = require('./src/models/subscription');

module.exports = {
  // router
  paymentRoutes,
  paymentController,

  // services
  razorpay,
  credits,          // { CREDIT_PACKS, TOKENS_PER_CREDIT, getOrCreateBalance, deductCredits, addCredits }

  // models
  Plan,
  Order,
  Payment,
  Subscription,
};
