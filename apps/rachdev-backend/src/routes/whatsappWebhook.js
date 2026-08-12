'use strict';

/**
 * Public WhatsApp webhook routes (Phase E). Server-to-server from the BSP, so no
 * auth session — trust comes from the unguessable per-team token in the path
 * plus the Meta verify_token handshake. Mounted ahead of the authed routers.
 */

const { Router } = require('express');
const express = require('express');
const { asyncHandler, rateLimit } = require('@rach/core');
const ctrl = require('../controllers/whatsappController');

const { publicWidgetLimiter } = rateLimit; // reuse the per-IP+token bucket

const router = Router();
router.use(express.json({ limit: '64kb' }));

router.get ('/:token/webhook', asyncHandler(ctrl.verify));                       // Meta handshake
router.post('/:token/webhook', publicWidgetLimiter, asyncHandler(ctrl.inbound)); // inbound messages

module.exports = router;
