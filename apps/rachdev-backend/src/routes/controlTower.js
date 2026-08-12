'use strict';

/**
 * Clinical control-tower overview (healthcare workspace). This is the original
 * fixed-persona roster + clinical activity view; the general Agent Monitor was
 * repurposed to the tenant's own built agents + teams, so the healthcare page
 * keeps its data here.
 */

const { Router } = require('express');
const { authenticate, authorize } = require('@rach/identity');
const { asyncHandler } = require('@rach/core');
const ctrl = require('../controllers/controlTowerController');

const router = Router();
router.use(authenticate);
router.get('/', authorize('tenant_admin', 'admin', 'doctor'), asyncHandler(ctrl.overview));

module.exports = router;
