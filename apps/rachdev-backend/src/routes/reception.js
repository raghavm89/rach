'use strict';

const { Router } = require('express');
const { authenticate, authorize, roles } = require('@rach/identity');
const { HEALTHCARE } = roles;
const { asyncHandler, parseId } = require('@rach/core');
const ctrl = require('../controllers/receptionController');
const opd = require('../controllers/opdController');

const router = Router();
router.use(authenticate);

// Reception is a front-desk surface — reception staff use it; doctor/admin may view.
const frontdesk = authorize(...HEALTHCARE.frontdesk);

// AI intake (Asha)
router.get   ('/encounters',              frontdesk, asyncHandler(ctrl.list));
router.post  ('/encounters',              frontdesk, asyncHandler(ctrl.create));
router.get   ('/encounters/:id',          parseId(), frontdesk, asyncHandler(ctrl.get));
router.patch ('/encounters/:id',          parseId(), frontdesk, asyncHandler(ctrl.update));
router.post  ('/encounters/:id/confirm',  parseId(), frontdesk, asyncHandler(ctrl.confirm));
router.delete('/encounters/:id',          parseId(), frontdesk, asyncHandler(ctrl.remove));

// OPD reception — patients, doctors, visits (registration / token / queue / appts)
router.get   ('/patients',      frontdesk, asyncHandler(opd.searchPatients));
router.post  ('/patients',      frontdesk, asyncHandler(opd.upsertPatient));
router.get   ('/patients/:id',          parseId(), frontdesk, asyncHandler(opd.getPatient));
router.get   ('/patients/:id/consent',  parseId(), frontdesk, asyncHandler(opd.getConsent));
router.post  ('/patients/:id/consent',  parseId(), frontdesk, asyncHandler(opd.recordConsent));
router.get   ('/doctors',       frontdesk, asyncHandler(opd.listDoctors));
router.get   ('/visits',            frontdesk, asyncHandler(opd.listVisits));
router.post  ('/visits',            frontdesk, asyncHandler(opd.createVisit));
router.get   ('/visits/:id',        parseId(), frontdesk, asyncHandler(opd.getVisit));
router.post  ('/visits/:id/assign', parseId(), frontdesk, asyncHandler(opd.assignDoctor));
router.patch ('/visits/:id',        parseId(), frontdesk, asyncHandler(opd.updateVisit));

module.exports = router;
