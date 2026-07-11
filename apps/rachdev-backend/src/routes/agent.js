'use strict';

const { Router } = require('express');
const { authenticate, authorize } = require('@rach/identity');
const { asyncHandler } = require('@rach/core');
const ctrl = require('../controllers/agentController');

const router = Router();
router.use(authenticate);

// Credits
router.get ('/credits',          authorize('tenant_admin', 'tenant_user', 'developer'), asyncHandler(ctrl.getCredits));
router.post('/credits/purchase', authorize('tenant_admin'), asyncHandler(ctrl.purchaseCredits));
router.post('/credits/verify',   authorize('tenant_admin'), asyncHandler(ctrl.verifyPurchase));

// Usage
router.get ('/usage',           asyncHandler(ctrl.getUsageSummary));
router.get ('/credits/history', asyncHandler(ctrl.getCreditHistory));
router.get ('/usage/sessions',  asyncHandler(ctrl.getSessionUsage));

// Sessions
router.get ('/sessions',              asyncHandler(ctrl.listSessions));
router.post('/sessions',              asyncHandler(ctrl.createSession));
router.get ('/sessions/:id/messages', asyncHandler(ctrl.getMessages));

// Chat (streaming) + agent tools
router.post('/sessions/:id/chat',           asyncHandler(ctrl.chat));
router.post('/sessions/:id/trigger-deploy', asyncHandler(ctrl.triggerDeploy));
router.post('/sessions/:id/run-command',    asyncHandler(ctrl.runCommand));

module.exports = router;
