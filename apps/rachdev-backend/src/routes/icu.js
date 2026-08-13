'use strict';

const { Router } = require('express');
const { authenticate, authorize, roles } = require('@rach/identity');
const { HEALTHCARE } = roles;
const { asyncHandler, parseId } = require('@rach/core');
const ctrl = require('../controllers/icuController');

const router = Router();
router.use(authenticate);

// ICU is a clinical monitoring surface.
const clinical = authorize(...HEALTHCARE.clinician);

router.get ('/',                     clinical, asyncHandler(ctrl.board));
router.get ('/alerts',               clinical, asyncHandler(ctrl.listAlerts));
router.post('/observations',         clinical, asyncHandler(ctrl.recordObservation));
router.post('/alerts/:id/ack',       parseId(), clinical, asyncHandler(ctrl.acknowledge));
router.post('/alerts/:id/resolve',   parseId(), clinical, asyncHandler(ctrl.resolve));

module.exports = router;
