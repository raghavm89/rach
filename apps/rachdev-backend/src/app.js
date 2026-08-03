'use strict';

/**
 * rachdev-backend — the RachDev agent-builder API.
 *
 * Consumes the shared packages:
 *   @rach/core      — db pool, middleware, health
 *   @rach/identity  — auth (RachDev validates RachBase-issued tokens; the auth
 *                     routes are mounted here so the app is self-contained in dev)
 *   @rach/billing   — credits (via the agent controller)
 *   @rach/llm       — model gateway (via the agent controller)
 *
 * Deploys/VM commands go to RachBase's internal API (RachBaseClient), not
 * in-process — this is what makes RachDev and RachBase separate services.
 */

const express      = require('express');
const cookieParser = require('cookie-parser');
const helmet       = require('helmet');
const morgan       = require('morgan');

const { pool } = require('@rach/core');
const { authRoutes, oauthRoutes, userRoutes } = require('@rach/identity');
const agentRoutes = require('./routes/agent');
const tenantRoutes = require('./routes/tenant');
const scribeRoutes = require('./routes/scribe');

const app = express();

// CORS (mirror the platform's manual preflight handling)
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
app.use(express.json({ limit: '100kb' }));

// Liveness / readiness
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'rachdev-backend' }));
app.get('/ready', async (req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok' }); }
  catch (err) { res.status(503).json({ status: 'unavailable', error: err.message }); }
});

// Shared identity (RachBase is the provider; mounted here for a self-contained dev app)
app.use('/api/auth',  authRoutes);
app.use('/api/auth',  oauthRoutes);
app.use('/api/users', userRoutes);

// RachDev agent builder
app.use('/api/agent', agentRoutes);
app.use('/api/tenant', tenantRoutes);
app.use('/api/scribe', scribeRoutes);

// 404 + error handler
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, req, res, next) => {
  console.error(`[${req.method} ${req.originalUrl}]`, err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message });
});

module.exports = app;
