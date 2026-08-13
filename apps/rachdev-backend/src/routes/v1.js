'use strict';

/**
 * OpenAI-compatible Developer API routes (`/v1`). Authenticated with a workspace
 * API key (Authorization: Bearer sk_live_… or x-api-key), rate-limited at the
 * API tier. CORS-open so it can be called from anywhere, like OpenAI's own API.
 * Mounted ahead of the app's origin-locked CORS block.
 */

const { Router } = require('express');
const express = require('express');
const { asyncHandler, rateLimit, ApiKey } = require('@rach/core');
const ctrl = require('../controllers/openaiController');

const { apiKeyLimiter } = rateLimit;

const OPENAI_AUTH_ERR = {
  error: {
    message: 'Missing or invalid API key. Provide it as `Authorization: Bearer sk_live_…`.',
    type: 'invalid_request_error',
    code: 'invalid_api_key',
  },
};

// Required API-key auth → req.apiKey = { id, tenant_id }.
async function requireApiKey(req, res, next) {
  const h = req.headers.authorization;
  const bearer = h && /^Bearer\s+(.+)$/i.test(h) ? h.replace(/^Bearer\s+/i, '').trim() : null;
  const provided = req.headers['x-api-key'] || bearer;
  if (!provided) return res.status(401).json(OPENAI_AUTH_ERR);
  const key = await ApiKey.verify(provided);
  if (!key) return res.status(401).json(OPENAI_AUTH_ERR);
  req.apiKey = key;
  next();
}

const router = Router();
router.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-api-key');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
router.use(express.json({ limit: '256kb' })); // conversations can be large
router.use(asyncHandler(requireApiKey));
router.use((req, res, next) => apiKeyLimiter(req, res, next));

router.get('/models', asyncHandler(ctrl.listModels));
router.post('/chat/completions', asyncHandler(ctrl.chatCompletions));

module.exports = router;
