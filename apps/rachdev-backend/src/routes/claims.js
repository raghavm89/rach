'use strict';

const { Router } = require('express');
const { authenticate, authorize } = require('@rach/identity');
const { asyncHandler, parseId } = require('@rach/core');
const ctrl = require('../controllers/claimsController');

const router = Router();
router.use(authenticate);

// Coding & revenue surface — clinicians finalise coding; admins oversee revenue.
const coder = authorize('doctor', 'tenant_admin', 'admin');

router.get ('/',            coder, asyncHandler(ctrl.list));
router.post('/',            coder, asyncHandler(ctrl.generate));
router.get ('/:id',         parseId(), coder, asyncHandler(ctrl.get));
router.patch('/:id',        parseId(), coder, asyncHandler(ctrl.update));
router.post('/:id/submit',  parseId(), coder, asyncHandler(ctrl.submit));

module.exports = router;
