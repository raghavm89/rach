'use strict';

/**
 * Public OAuth callback for connector authorization (Phase D). The provider
 * redirects the user's browser here after they approve; there is no auth session
 * on this request, so trust comes entirely from the signed `state`. Mounted
 * ahead of the authenticated /api/integrations router.
 */

const { Router } = require('express');
const { asyncHandler, rateLimit } = require('@rach/core');
const ctrl = require('../controllers/connectionsController');

const { oauthLimiter } = rateLimit;

const router = Router();
router.get('/callback', oauthLimiter, asyncHandler(ctrl.oauthCallback));

module.exports = router;
