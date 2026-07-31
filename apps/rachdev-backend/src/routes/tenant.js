'use strict';

const { Router } = require('express');
const { authenticate, authorize } = require('@rach/identity');
const { asyncHandler } = require('@rach/core');
const ctrl = require('../controllers/tenantController');

const router = Router();
router.use(authenticate);

// Any authenticated tenant user can read their own tenant (for the settings view)
router.get('/', asyncHandler(ctrl.getMyTenant));

// Only a tenant admin (or system admin) can change the tenant's industry/workspace
router.patch('/industry', authorize('tenant_admin', 'admin'), asyncHandler(ctrl.setIndustry));

module.exports = router;
