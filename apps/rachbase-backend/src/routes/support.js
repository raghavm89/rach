'use strict';

/**
 * Support tickets. Any authenticated user can raise and view their own tickets;
 * role-based visibility and support-only actions are enforced in the controller.
 */

const { Router } = require('express');
const { authenticate } = require('@rach/identity');
const { asyncHandler, parseId } = require('@rach/core');
const { chatLimiter } = require('@rach/core').rateLimit;
const ctrl = require('../controllers/supportController');
const agent = require('../controllers/supportAgentController');

const router = Router();
router.use(authenticate);

// Scoped support assistant (free / un-metered, rate-limited per user).
router.post ('/chat',                 chatLimiter, asyncHandler(agent.chat));

router.post ('/tickets',              asyncHandler(ctrl.createTicket));
router.get  ('/tickets',              asyncHandler(ctrl.listTickets));
router.get  ('/tickets/:id',          parseId(), asyncHandler(ctrl.getTicket));
router.post ('/tickets/:id/messages', parseId(), asyncHandler(ctrl.addMessage));
router.patch('/tickets/:id',          parseId(), asyncHandler(ctrl.updateTicket));

module.exports = router;
