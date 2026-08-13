'use strict';

const { Router } = require('express');
const { authenticate, authorize, roles } = require('@rach/identity');
const { HEALTHCARE } = roles;
const { asyncHandler } = require('@rach/core');
const ctrl = require('../controllers/scribeController');

const router = Router();
router.use(authenticate);

// Scribe is a clinical surface — doctors author; tenant_admin/admin may view.
const clinician = authorize(...HEALTHCARE.clinician);
// Reception may VIEW notes (read-only) but not author/sign them.
const viewer = authorize(...HEALTHCARE.viewer);

router.get ('/notes',          viewer,    asyncHandler(ctrl.list));
router.post('/notes',          clinician, asyncHandler(ctrl.create));
router.get ('/notes/:id',      viewer,    asyncHandler(ctrl.get));
router.patch('/notes/:id',     clinician, asyncHandler(ctrl.update));
router.delete('/notes/:id',    clinician, asyncHandler(ctrl.remove));
router.post('/notes/:id/sign', authorize(...HEALTHCARE.signer), asyncHandler(ctrl.sign));
router.post('/notes/:id/prescribe', clinician, asyncHandler(ctrl.prescribe));
router.post('/interactions',   clinician, asyncHandler(ctrl.checkInteractions));

module.exports = router;
