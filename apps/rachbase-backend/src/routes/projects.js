'use strict';

const { Router } = require('express');
const { authenticate, authorize } = require('@rach/identity');
const { asyncHandler, parseId } = require('@rach/core');
const ctrl = require('../controllers/projectController');

const router = Router();
router.use(authenticate);

const TENANT_ROLES = ['admin', 'tenant_admin', 'tenant_user', 'developer'];

// Projects
router.get('/',        authorize(...TENANT_ROLES), asyncHandler(ctrl.listProjects));
router.post('/',       authorize('admin', 'tenant_admin', 'developer'), asyncHandler(ctrl.createProject));
router.get('/:id',     authorize(...TENANT_ROLES), parseId('id'), asyncHandler(ctrl.getProject));

// Services (nested under a project)
router.get('/:id/services',                 authorize(...TENANT_ROLES), parseId('id'), asyncHandler(ctrl.listServices));
router.post('/:id/services',                authorize('admin', 'tenant_admin', 'developer'), parseId('id'), asyncHandler(ctrl.createService));
router.get('/:id/services/:sid',            authorize(...TENANT_ROLES), parseId('id'), parseId('sid'), asyncHandler(ctrl.getService));
router.post('/:id/services/:sid/deploy',    authorize('admin', 'tenant_admin', 'developer'), parseId('id'), parseId('sid'), asyncHandler(ctrl.deployService));

// Service Units — pay-to-online (first unit) + live scaling ("Add power")
router.post('/:id/services/:sid/units/checkout', authorize('admin', 'tenant_admin', 'developer'), parseId('id'), parseId('sid'), asyncHandler(ctrl.checkoutUnit));
router.post('/:id/services/:sid/units/verify',   authorize('admin', 'tenant_admin', 'developer'), parseId('id'), parseId('sid'), asyncHandler(ctrl.verifyUnit));

module.exports = router;
