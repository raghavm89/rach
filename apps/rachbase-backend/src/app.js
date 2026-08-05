'use strict';

/**
 * rachbase-backend — the RachBase Cloud Management / BaaS API.
 *
 * Consumes the shared packages:
 *   @rach/core      — db pool, middleware, health
 *   @rach/identity  — auth + users (RachBase is the identity provider)
 *   @rach/billing   — payments (Razorpay) + plans
 *   @rach/deploy    — deploy engine (used by deployment + agent tools)
 *
 * Owns the cloud vertical: deployment, monitoring, tenants, expansion, plans,
 * VM assignment. (Containers/CaaS land here in a later stage.)
 */

const express      = require('express');
const cookieParser = require('cookie-parser');
const helmet       = require('helmet');
const morgan       = require('morgan');

const { pool } = require('@rach/core');
const { authRoutes, oauthRoutes, userRoutes, startAuthCleanup } = require('@rach/identity');
const { paymentRoutes, invoiceRoutes, catalog: billingCatalog } = require('@rach/billing');

const deploymentRoutes = require('./routes/deployment');
const monitoringRoutes = require('./routes/monitoring');
const tenantRoutes     = require('./routes/tenants');
const expansionRoutes  = require('./routes/expansion');
const planRoutes       = require('./routes/plans');
const vmAssignmentRoutes = require('./routes/vmAssignment');
const projectRoutes    = require('./routes/projects');   // Railway-style Project → Service model
const internalRoutes   = require('./routes/internal');   // service-to-service (RachDev → RachBase)
const cartRoutes       = require('./routes/cart');       // per-user persistent billing cart
const vmKeyRoutes      = require('./routes/vmKeys');     // per-VM SSH keypair admin
const agentRoutes      = require('./routes/agent');      // agent credits + usage (billing half)
const endpointRoutes   = require('./routes/endpoints');  // Application Workload Monitoring (HTTP checks)
const supportRoutes    = require('./routes/support');    // support tickets

const app = express();

// CORS
app.use((req, res, next) => {
  const allowed = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.origin || '';
  const allowAll = allowed.includes('*');
  const allow = allowAll ? (origin || '*') : (allowed.includes(origin) ? origin : false);
  if (allow) {
    res.setHeader('Access-Control-Allow-Origin', allow);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(helmet({ crossOriginResourcePolicy: false }));
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}
app.use(cookieParser());

// Raw-body webhooks (must parse raw before express.json)
app.use('/api/deployment/github/webhook', express.raw({ type: 'application/json', limit: '1mb' }), (req, res, next) => {
  req.rawBody = req.body;
  try { req.body = req.rawBody.length ? JSON.parse(req.rawBody.toString('utf8')) : {}; }
  catch { req.body = null; }
  next();
});
app.use('/api/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }), (req, res, next) => {
  req.rawBody = req.body;
  try { req.body = req.rawBody.length ? JSON.parse(req.rawBody.toString('utf8')) : {}; }
  catch { req.body = null; }
  next();
});

app.use(express.json({ limit: '100kb' }));

// Liveness / readiness
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'rachbase-backend' }));
app.get('/ready', async (req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok' }); }
  catch (err) { res.status(503).json({ status: 'unavailable', error: err.message }); }
});

// Fail fast on a malformed price list rather than mispricing an order.
billingCatalog.validateCatalog();

// Refuse to boot in production with the payment-verification bypass enabled.
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_UNVERIFIED_PAYMENTS === 'true') {
  throw new Error(
    'ALLOW_UNVERIFIED_PAYMENTS=true is set in production. This would let anyone ' +
    'provision services without paying. Remove it before starting the server.'
  );
}

// Razorpay's webhook HMAC throws on an undefined secret, turning every webhook
// into a 500 that Razorpay then retries.
if (process.env.RAZORPAY_KEY_ID && !process.env.RAZORPAY_WEBHOOK_SECRET) {
  console.warn('[billing] RAZORPAY_WEBHOOK_SECRET is not set — webhook verification will fail');
}

// Hourly purge of stale pending registrations, expired OAuth state and
// long-dead refresh tokens. RachBase is the identity provider, so it owns this.
if (process.env.NODE_ENV !== 'test') startAuthCleanup();

// Fulfil VM subscriptions off the Razorpay webhook too, so an order is provisioned
// even if the synchronous activation call never runs (browser closed after pay).
// The handler is idempotent, so it's safe alongside the activate handler and on
// every renewal.
require('@rach/billing').hooks.onSubscriptionCharged(({ razorpaySubId, paymentId, amountMinor, currency }) =>
  require('./controllers/expansionController').ensureSubscriptionFulfilment(razorpaySubId, { paymentId, amountMinor, currency })
);

// Shared identity + billing
app.use('/api/auth',     authRoutes);
app.use('/api/auth',     oauthRoutes);
app.use('/api/users',    userRoutes);
app.use('/api/users',    vmAssignmentRoutes);   // /:id/vms
app.use('/api/payments', paymentRoutes);
app.use('/api/invoices', invoiceRoutes);

// Cloud vertical
app.use('/api/deployment', deploymentRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/tenants',    tenantRoutes);
app.use('/api/expansion',  expansionRoutes);
app.use('/api/cart',       cartRoutes);
app.use('/api/vm-keys',    vmKeyRoutes);
app.use('/api/agent',      agentRoutes);
app.use('/api/plans',      planRoutes);
app.use('/api/projects',   projectRoutes);
app.use('/api/endpoints',  endpointRoutes);
app.use('/api/support',    supportRoutes);

// Internal service API (protected by service token, not user auth)
app.use('/internal', internalRoutes);

// 404 + error handler
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, req, res, next) => {
  console.error(`[${req.method} ${req.originalUrl}]`, err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message });
});

module.exports = app;
