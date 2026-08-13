'use strict';

const { Router } = require('express');
const { authenticate, authorize, roles } = require('@rach/identity');
const { HEALTHCARE } = roles;
const { asyncHandler, parseId } = require('@rach/core');
const ctrl = require('../controllers/triageController');

const router = Router();
router.use(authenticate);

// Triage is a front-desk / clinical safety surface.
const clinical = authorize(...HEALTHCARE.frontdesk);

router.get ('/',                  clinical, asyncHandler(ctrl.list));
router.post('/',                  clinical, asyncHandler(ctrl.create));
router.get ('/:id',               parseId(), clinical, asyncHandler(ctrl.get));
router.post('/:id/acknowledge',   parseId(), authorize(...HEALTHCARE.clinician), asyncHandler(ctrl.acknowledge));

module.exports = router;
