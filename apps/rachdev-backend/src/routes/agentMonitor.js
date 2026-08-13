'use strict';

const { Router } = require('express');
const { authenticate, authorize, roles } = require('@rach/identity');
const { HEALTHCARE } = roles;
const { asyncHandler } = require('@rach/core');
const ctrl = require('../controllers/agentMonitorController');

const router = Router();
router.use(authenticate);

// Org-admin view (and platform admin). tenant_admin is RachDev's "Org Admin".
router.get('/', authorize(...HEALTHCARE.clinician), asyncHandler(ctrl.overview));

// Conversations inbox — any signed-in workspace member can review their runs.
router.get('/conversations', asyncHandler(ctrl.conversations));

module.exports = router;
