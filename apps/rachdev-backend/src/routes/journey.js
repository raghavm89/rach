'use strict';

const { Router } = require('express');
const { authenticate, authorize, roles } = require('@rach/identity');
const { HEALTHCARE } = roles;
const { asyncHandler, parseId } = require('@rach/core');
const ctrl = require('../controllers/journeyController');

const router = Router();
router.use(authenticate);

router.get('/:patientId', parseId('patientId'), authorize(...HEALTHCARE.frontdesk), asyncHandler(ctrl.get));

module.exports = router;
