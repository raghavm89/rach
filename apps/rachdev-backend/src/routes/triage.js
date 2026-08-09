'use strict';

const { Router } = require('express');
const { authenticate, authorize } = require('@rach/identity');
const { asyncHandler, parseId } = require('@rach/core');
const ctrl = require('../controllers/triageController');

const router = Router();
router.use(authenticate);

// Triage is a front-desk / clinical safety surface.
const clinical = authorize('reception', 'doctor', 'tenant_admin', 'admin');

router.get ('/',                  clinical, asyncHandler(ctrl.list));
router.post('/',                  clinical, asyncHandler(ctrl.create));
router.get ('/:id',               parseId(), clinical, asyncHandler(ctrl.get));
router.post('/:id/acknowledge',   parseId(), authorize('doctor', 'tenant_admin', 'admin'), asyncHandler(ctrl.acknowledge));

module.exports = router;
