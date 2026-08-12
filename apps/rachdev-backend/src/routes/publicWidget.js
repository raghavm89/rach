'use strict';

/**
 * Public website-widget routes (Phase C). Mounted BEFORE the app's origin-locked
 * CORS block because the embed is loaded by arbitrary third-party sites — these
 * routes must accept any origin. They are unauthenticated but rate-limited and
 * credit-gated in the controller. No cookies/credentials are used or accepted.
 */

const { Router } = require('express');
const express = require('express');
const { asyncHandler, rateLimit } = require('@rach/core');
const ctrl = require('../controllers/publicWidgetController');

const { publicWidgetLimiter } = rateLimit;

const router = Router();

// Permissive CORS for the embed surface only (no credentials).
router.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
router.use(express.json({ limit: '16kb' }));

router.get ('/:token/widget.js', ctrl.script);            // embed script (no limiter)
router.get ('/:token/config',    publicWidgetLimiter, asyncHandler(ctrl.config));
router.post('/:token/message',   publicWidgetLimiter, asyncHandler(ctrl.message));

module.exports = router;
