'use strict';

const { Router } = require('express');
const { authenticate, authorize } = require('@rach/identity');
const { asyncHandler } = require('@rach/core');
const ctrl = require('../controllers/agentController');
const deploy = require('../controllers/deploymentController');

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

// Agent definitions (AgentSpec — builder ↔ operate seam)
router.get ('/definitions',             authorize('tenant_admin', 'admin'), asyncHandler(ctrl.listDefinitions));
router.post('/definitions',             authorize('tenant_admin', 'admin'), asyncHandler(ctrl.createDefinition));
router.put ('/definitions/:id',         authorize('tenant_admin', 'admin'), asyncHandler(ctrl.updateDefinition));
router.post('/definitions/:id/publish', authorize('tenant_admin', 'admin'), asyncHandler(ctrl.publishDefinition));
router.get ('/definitions/:id/versions',authorize('tenant_admin', 'admin'), asyncHandler(ctrl.listDefinitionVersions));

// Deploy a published version through the Agent Runtime Contract (agent verbs
// only). RachBase-managed target pushes; on-prem/BYOC targets pull. See
// docs/RACHDEV_RUNTIME_CONTRACT.md.
router.post('/definitions/:id/deploy',  authorize('tenant_admin', 'admin'), asyncHandler(deploy.deploy));
router.get ('/deployments',             authorize('tenant_admin', 'admin'), asyncHandler(deploy.list));
router.get ('/deployments/:id/status',  authorize('tenant_admin', 'admin'), asyncHandler(deploy.status));
router.get ('/deployments/:id/metrics', authorize('tenant_admin', 'admin'), asyncHandler(deploy.metrics));
router.get ('/deployments/:id/logs',    authorize('tenant_admin', 'admin'), asyncHandler(deploy.logs));
router.post('/deployments/:id/stop',    authorize('tenant_admin', 'admin'), asyncHandler(deploy.stop));

// Sessions
router.get ('/sessions',              asyncHandler(ctrl.listSessions));
router.post('/sessions',              asyncHandler(ctrl.createSession));
router.get ('/sessions/:id/messages', asyncHandler(ctrl.getMessages));

// Builder chat (streaming) — the AgentSpec builder assistant.
router.post('/sessions/:id/chat', asyncHandler(ctrl.chat));

// The DevOps `trigger-deploy` / `run-command` routes were retired in migration
// step #6 (VM ops are a RachBase concern). Agents are deployed via the Agent
// Runtime Contract routes above (/definitions/:id/deploy, /deployments/*).

module.exports = router;
