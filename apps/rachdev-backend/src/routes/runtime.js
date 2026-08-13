'use strict';

/**
 * Runtime phone-home routes (`/api/runtime/v1`). Authenticated by a per-deployment
 * runtime token (Authorization: Bearer rt_… or x-runtime-token). CORS-open (the
 * agent runs anywhere) and mounted ahead of the origin-locked CORS block.
 * Rate-limited at the API tier. Outbound-only from the customer's side.
 */

const { Router } = require('express');
const express = require('express');
const { asyncHandler, rateLimit, AgentDeployment } = require('@rach/core');
const ctrl = require('../controllers/runtimeController');

const { apiKeyLimiter } = rateLimit;

const AUTH_ERR = { error: 'Missing or invalid runtime token', code: 'invalid_runtime_token' };

// Required runtime-token auth → req.deployment = the deployment row.
async function requireRuntimeToken(req, res, next) {
  const h = req.headers.authorization;
  const bearer = h && /^Bearer\s+(.+)$/i.test(h) ? h.replace(/^Bearer\s+/i, '').trim() : null;
  const provided = req.headers['x-runtime-token'] || bearer;
  if (!provided) return res.status(401).json(AUTH_ERR);
  const deployment = await AgentDeployment.verifyRuntimeToken(provided);
  if (!deployment) return res.status(401).json(AUTH_ERR);
  req.deployment = deployment;
  next();
}

const router = Router();
router.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-runtime-token');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
router.use(express.json({ limit: '32kb' })); // telemetry is small metadata
router.use(asyncHandler(requireRuntimeToken));
router.use((req, res, next) => apiKeyLimiter(req, res, next));

router.get('/spec', asyncHandler(ctrl.spec));
router.post('/telemetry', asyncHandler(ctrl.telemetry));

module.exports = router;
