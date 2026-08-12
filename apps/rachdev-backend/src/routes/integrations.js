'use strict';

const { Router } = require('express');
const { authenticate, authorize } = require('@rach/identity');
const { asyncHandler } = require('@rach/core');
const ctrl = require('../controllers/connectionsController');

const router = Router();
router.use(authenticate);
const gate = authorize('tenant_admin', 'admin');

router.get('/',                  gate, asyncHandler(ctrl.list));
router.get('/:id/oauth/start',   gate, asyncHandler(ctrl.oauthStart));
router.post('/:id/connect',      gate, asyncHandler(ctrl.connect));
router.post('/:id/disconnect',   gate, asyncHandler(ctrl.disconnect));

module.exports = router;
