'use strict';

const { Router } = require('express');
const { authenticate, authorize } = require('@rach/identity');
const { asyncHandler, parseId } = require('@rach/core');
const ctrl = require('../controllers/coordinationController');

const router = Router();
router.use(authenticate);

// Coordination is a clinical/front-desk logistics surface.
const staff = authorize('reception', 'doctor', 'tenant_admin', 'admin');
const clinician = authorize('doctor', 'tenant_admin', 'admin');

// Beds / OT
router.get  ('/beds',            staff, asyncHandler(ctrl.listBeds));
router.post ('/beds',            authorize('tenant_admin', 'admin'), asyncHandler(ctrl.upsertBed));
router.patch('/beds/:id',        parseId(), staff, asyncHandler(ctrl.updateBed));

// Referrals
router.get  ('/referrals',       staff, asyncHandler(ctrl.listReferrals));
router.post ('/referrals',       staff, asyncHandler(ctrl.createReferral));
router.patch('/referrals/:id',   parseId(), staff, asyncHandler(ctrl.updateReferral));

// Discharge summaries (AI draft → clinician sign)
router.post ('/discharge',       clinician, asyncHandler(ctrl.generateDischarge));
router.get  ('/discharge/:id',   parseId(), staff, asyncHandler(ctrl.getDischarge));
router.patch('/discharge/:id',   parseId(), clinician, asyncHandler(ctrl.updateDischarge));
router.post ('/discharge/:id/sign', parseId(), clinician, asyncHandler(ctrl.signDischarge));

// Follow-up scheduling
router.post ('/follow-up',       staff, asyncHandler(ctrl.scheduleFollowUp));

module.exports = router;
