'use strict';

const { Router } = require('express');
const { authenticate, authorize, roles } = require('@rach/identity');
const { HEALTHCARE } = roles;
const { asyncHandler, parseId } = require('@rach/core');
const ctrl = require('../controllers/inventoryController');

const router = Router();
router.use(authenticate);

// Pharmacy store surface — store managers + org/platform admins.
const store = authorize(...HEALTHCARE.store);

router.get ('/stock',    store, asyncHandler(ctrl.listStock));
router.post('/stock',    store, asyncHandler(ctrl.upsertStock));
router.post('/dispense', store, asyncHandler(ctrl.dispense));
router.post('/restock',  store, asyncHandler(ctrl.restock));

router.get ('/alerts',              store, asyncHandler(ctrl.listAlerts));
router.post('/alerts/:id/resolve',  parseId(), store, asyncHandler(ctrl.resolveAlert));

module.exports = router;
