'use strict';

const { Router } = require('express');
const { authenticate, authorize } = require('@rach/identity');
const { asyncHandler, parseId } = require('@rach/core');
const ctrl = require('../controllers/integrationsController');

const router = Router();
router.use(authenticate);

const frontdesk = authorize('reception', 'doctor', 'tenant_admin', 'admin');

router.post('/patients/:id/abha', parseId(), frontdesk, asyncHandler(ctrl.linkAbha));

module.exports = router;
