'use strict';

const { Router } = require('express');
const { authenticate, authorize, roles } = require('@rach/identity');
const { HEALTHCARE } = roles;
const { asyncHandler, parseId } = require('@rach/core');
const ctrl = require('../controllers/integrationsController');

const router = Router();
router.use(authenticate);

const frontdesk = authorize(...HEALTHCARE.frontdesk);

router.post('/patients/:id/abha', parseId(), frontdesk, asyncHandler(ctrl.linkAbha));

module.exports = router;
