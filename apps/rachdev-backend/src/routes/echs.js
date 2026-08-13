'use strict';

const { Router } = require('express');
const { authenticate, authorize, roles } = require('@rach/identity');
const { HEALTHCARE } = roles;
const { asyncHandler, parseId } = require('@rach/core');
const ctrl = require('../controllers/integrationsController');

const router = Router();
router.use(authenticate);

const frontdesk = authorize(...HEALTHCARE.frontdesk);
const coder = authorize(...HEALTHCARE.clinician);

router.post('/eligibility',              frontdesk, asyncHandler(ctrl.verifyEligibility));
router.get ('/eligibility/:patientId',   parseId('patientId'), frontdesk, asyncHandler(ctrl.latestEligibility));
router.post('/preauth',                  coder, asyncHandler(ctrl.preAuth));

module.exports = router;
