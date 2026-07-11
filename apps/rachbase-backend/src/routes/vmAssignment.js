'use strict';

/**
 * VM-assignment routes — mounted at /api/users.
 *
 * These were previously bundled into the shared users route. They are a RachBase
 * (cloud/BaaS) concern, so they now live here and are re-attached onto the user
 * namespace. See docs/RachDev_RachBase_Shared_Core_Spec.md.
 */

const { Router } = require('express');
const { authenticate, authorize } = require('@rach/identity');
const { parseId } = require('@rach/core');
const { getUserVMs, assignVMs, removeVM } = require('../controllers/vmAssignmentController');

const router = Router();
router.use(authenticate);

router.get('/:id/vms',          authorize('admin', 'tenant_admin'), parseId(), getUserVMs);
router.post('/:id/vms',         authorize('admin', 'tenant_admin'), parseId(), assignVMs);
router.delete('/:id/vms/:vmId', authorize('admin', 'tenant_admin'), parseId(), removeVM);

module.exports = router;
