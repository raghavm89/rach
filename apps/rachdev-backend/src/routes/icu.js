'use strict';

const { Router } = require('express');
const { authenticate, authorize } = require('@rach/identity');
const { asyncHandler, parseId } = require('@rach/core');
const ctrl = require('../controllers/icuController');

const router = Router();
router.use(authenticate);

// ICU is a clinical monitoring surface.
const clinical = authorize('doctor', 'tenant_admin', 'admin');

router.get ('/',                     clinical, asyncHandler(ctrl.board));
router.get ('/alerts',               clinical, asyncHandler(ctrl.listAlerts));
router.post('/observations',         clinical, asyncHandler(ctrl.recordObservation));
router.post('/alerts/:id/ack',       parseId(), clinical, asyncHandler(ctrl.acknowledge));
router.post('/alerts/:id/resolve',   parseId(), clinical, asyncHandler(ctrl.resolve));

module.exports = router;
