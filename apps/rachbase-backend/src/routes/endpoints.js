'use strict';

const { Router }   = require('express');
const authenticate = require('@rach/identity').authenticate;
const authorize    = require('@rach/identity').authorize;
const asyncHandler = require('@rach/core').asyncHandler;
const parseId      = require('@rach/core').parseId;
const ctrl         = require('../controllers/endpointMonitoringController');

const router = Router();
router.use(authenticate);

const roles = authorize('tenant_admin', 'tenant_user');

router.get   ('/quota',          roles, ctrl.getQuota);
router.get   ('/',               roles, ctrl.listEndpoints);
router.post  ('/',               authorize('tenant_admin'), ctrl.createEndpoint);
router.patch ('/:id',            authorize('tenant_admin'), parseId(), ctrl.updateEndpoint);
router.delete('/:id',            authorize('tenant_admin'), parseId(), ctrl.deleteEndpoint);
router.get   ('/:id/checks',     roles, parseId(), ctrl.getChecks);

module.exports = router;
