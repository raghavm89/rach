'use strict';

const { Router } = require('express');
const { authenticate, authorize } = require('@rach/identity');
const { asyncHandler } = require('@rach/core');
const ctrl = require('../controllers/agentMonitorController');

const router = Router();
router.use(authenticate);

// Org-admin view (and platform admin). tenant_admin is RachDev's "Org Admin".
router.get('/', authorize('tenant_admin', 'admin', 'doctor'), asyncHandler(ctrl.overview));

module.exports = router;
