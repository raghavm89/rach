'use strict';

const { Router } = require('express');
const { asyncHandler } = require('@rach/core');
const serviceAuth = require('../middleware/serviceAuth');
const ctrl = require('./../controllers/internalController');
const agentRuntime = require('./../controllers/agentRuntimeController');

const router = Router();

// All internal routes require a valid service token.
router.use(serviceAuth('RACHBASE_SERVICE_TOKEN'));

router.post('/deploy',      asyncHandler(ctrl.deploy));
router.post('/run-command', asyncHandler(ctrl.runCommand));

// Service usage metrics + sustained-usage alerting (Step 5)
router.post('/usage',            asyncHandler(ctrl.recordUsage));
router.post('/alerts/evaluate',  asyncHandler(ctrl.evaluateAlerts));

// Agent Runtime Contract — RachDev pushes a published agent spec here to run it
// on RachBase-managed infra. Same serviceAuth guard as the rest of /internal.
router.post('/agent-runtime/deploy',  asyncHandler(agentRuntime.deploy));
router.post('/agent-runtime/status',  asyncHandler(agentRuntime.status));
router.post('/agent-runtime/metrics', asyncHandler(agentRuntime.metrics));
router.post('/agent-runtime/logs',    asyncHandler(agentRuntime.logs));
router.post('/agent-runtime/stop',    asyncHandler(agentRuntime.stop));

module.exports = router;
