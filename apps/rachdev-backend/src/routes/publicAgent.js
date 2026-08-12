'use strict';

/**
 * Public single-agent runtime routes. Unauthenticated, CORS-open (embeddable),
 * rate-limited + credit-gated in the controller. Mounted ahead of the app's
 * origin-locked CORS block.
 */

const { Router } = require('express');
const express = require('express');
const { asyncHandler, rateLimit, ApiKey } = require('@rach/core');
const ctrl = require('../controllers/publicAgentController');

const { publicWidgetLimiter, apiKeyLimiter } = rateLimit;

// Optional API key: Authorization: Bearer sk_… or x-api-key. A valid key raises
// the caller to the API tier; a provided-but-invalid key is rejected.
async function resolveApiKey(req, res, next) {
  const h = req.headers.authorization;
  const bearer = h && /^Bearer\s+(.+)$/i.test(h) ? h.replace(/^Bearer\s+/i, '').trim() : null;
  const provided = req.headers['x-api-key'] || bearer;
  if (!provided) return next();
  const key = await ApiKey.verify(provided);
  if (!key) return res.status(401).json({ error: 'Invalid API key' });
  req.apiKey = key;
  next();
}
// Anonymous → widget tier; authenticated → API tier.
const tieredLimiter = (req, res, next) => (req.apiKey ? apiKeyLimiter : publicWidgetLimiter)(req, res, next);

const router = Router();
router.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
router.use(express.json({ limit: '16kb' }));

router.get ('/:token/widget.js', ctrl.script);
router.get ('/:token/config',    publicWidgetLimiter, asyncHandler(ctrl.config));
router.post('/:token/message',   asyncHandler(resolveApiKey), tieredLimiter, asyncHandler(ctrl.message));

module.exports = router;
