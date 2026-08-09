'use strict';

const { Router } = require('express');
const { authenticate, authorize } = require('@rach/identity');
const { asyncHandler } = require('@rach/core');
const ctrl = require('../controllers/auditController');

const router = Router();
router.use(authenticate);

// Governance surface — org admins and platform admins review the trail.
const viewer = authorize('tenant_admin', 'admin');

router.get('/',        viewer, asyncHandler(ctrl.list));
router.get('/summary', viewer, asyncHandler(ctrl.summary));

module.exports = router;
