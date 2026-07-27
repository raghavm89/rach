'use strict';

/**
 * Agent credits + usage (billing half of /api/agent), served by rachbase-backend.
 * The AI runtime (chat / sessions create / run-command) stays in rachdev-backend.
 * Same authorization matrix as rachdev's agent routes.
 */

const { Router } = require('express');
const { authenticate, authorize } = require('@rach/identity');
const { asyncHandler } = require('@rach/core');
const ctrl = require('../controllers/agentCreditsController');
const rt   = require('../controllers/agentRuntimeController');

const router = Router();
router.use(authenticate);

// ── Credits (served locally via shared @rach/billing) ─────────────────────────
router.get ('/credits',          authorize('tenant_admin', 'tenant_user', 'developer'), asyncHandler(ctrl.getCredits));
router.post('/credits/purchase', authorize('tenant_admin'), asyncHandler(ctrl.purchaseCredits));
router.post('/credits/verify',   authorize('tenant_admin'), asyncHandler(ctrl.verifyPurchase));

// ── Usage / history ───────────────────────────────────────────────────────────
router.get ('/usage',           asyncHandler(ctrl.getUsageSummary));
router.get ('/credits/history', asyncHandler(ctrl.getCreditHistory));
router.get ('/usage/sessions',  asyncHandler(ctrl.getSessionUsage));

// ── Deploy Agent runtime (native — shared @rach/llm + local infra tools) ──────
const agentRoles = authorize('tenant_admin', 'developer');
router.get ('/sessions',                     agentRoles, asyncHandler(rt.listSessions));
router.post('/sessions',                     agentRoles, asyncHandler(rt.createSession));
router.get ('/sessions/:id/messages',        agentRoles, asyncHandler(rt.getMessages));
router.post('/sessions/:id/chat',            agentRoles, asyncHandler(rt.chat));
router.post('/sessions/:id/trigger-deploy',  agentRoles, asyncHandler(rt.triggerDeploy));
router.post('/sessions/:id/run-command',     agentRoles, asyncHandler(rt.runCommand));

module.exports = router;
