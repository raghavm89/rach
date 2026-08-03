'use strict';

const { Router } = require('express');
const { authenticate, authorize } = require('@rach/identity');
const { asyncHandler } = require('@rach/core');
const ctrl = require('../controllers/scribeController');

const router = Router();
router.use(authenticate);

// Scribe is a clinical surface — doctors use it; tenant_admin/admin may view.
const clinician = authorize('doctor', 'tenant_admin', 'admin');

router.get ('/notes',          clinician, asyncHandler(ctrl.list));
router.post('/notes',          clinician, asyncHandler(ctrl.create));
router.get ('/notes/:id',      clinician, asyncHandler(ctrl.get));
router.patch('/notes/:id',     clinician, asyncHandler(ctrl.update));
router.post('/notes/:id/sign', authorize('doctor', 'admin'), asyncHandler(ctrl.sign));

module.exports = router;
