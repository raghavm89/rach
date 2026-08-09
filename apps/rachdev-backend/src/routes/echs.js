'use strict';

const { Router } = require('express');
const { authenticate, authorize } = require('@rach/identity');
const { asyncHandler, parseId } = require('@rach/core');
const ctrl = require('../controllers/integrationsController');

const router = Router();
router.use(authenticate);

const frontdesk = authorize('reception', 'doctor', 'tenant_admin', 'admin');
const coder = authorize('doctor', 'tenant_admin', 'admin');

router.post('/eligibility',              frontdesk, asyncHandler(ctrl.verifyEligibility));
router.get ('/eligibility/:patientId',   parseId('patientId'), frontdesk, asyncHandler(ctrl.latestEligibility));
router.post('/preauth',                  coder, asyncHandler(ctrl.preAuth));

module.exports = router;
