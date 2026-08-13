'use strict';

const { Router } = require('express');
const { authenticate, authorize, roles } = require('@rach/identity');
const { HEALTHCARE } = roles;
const { asyncHandler, parseId } = require('@rach/core');
const ctrl = require('../controllers/claimsController');

const router = Router();
router.use(authenticate);

// Coding & revenue surface — clinicians finalise coding; admins oversee revenue.
const coder = authorize(...HEALTHCARE.clinician);

router.get ('/',            coder, asyncHandler(ctrl.list));
router.post('/',            coder, asyncHandler(ctrl.generate));
router.get ('/:id',         parseId(), coder, asyncHandler(ctrl.get));
router.patch('/:id',        parseId(), coder, asyncHandler(ctrl.update));
router.post('/:id/submit',  parseId(), coder, asyncHandler(ctrl.submit));

module.exports = router;
