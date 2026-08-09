'use strict';

const { Router } = require('express');
const { authenticate, authorize } = require('@rach/identity');
const { asyncHandler, parseId } = require('@rach/core');
const ctrl = require('../controllers/journeyController');

const router = Router();
router.use(authenticate);

router.get('/:patientId', parseId('patientId'), authorize('reception', 'doctor', 'tenant_admin', 'admin'), asyncHandler(ctrl.get));

module.exports = router;
