'use strict';

/**
 * Status page routes.
 *   GET  /api/status                       PUBLIC  — sanitized health payload for the status page
 *   GET  /api/status/incidents             admin   — ops console list
 *   POST /api/status/incidents             admin   — open incident / schedule maintenance
 *   PATCH /api/status/incidents/:id         admin   — update / resolve
 *   POST /api/status/incidents/:id/updates  admin   — append a timeline update
 *
 * The public GET is intentionally unauthenticated; every admin route is gated by
 * authenticate + authorize('admin'). Never move a data-mutating handler above that gate.
 */

const { Router } = require('express');
const authenticate = require('@rach/identity').authenticate;
const authorize = require('@rach/identity').authorize;
const asyncHandler = require('@rach/core').asyncHandler;
const ctrl = require('../controllers/statusController');

const router = Router();

// Public
router.get('/', asyncHandler(ctrl.getPublicStatus));

// Admin (ops console)
router.get('/incidents', authenticate, authorize('admin'), asyncHandler(ctrl.listIncidents));
router.post('/incidents', authenticate, authorize('admin'), asyncHandler(ctrl.createIncident));
router.patch('/incidents/:id', authenticate, authorize('admin'), asyncHandler(ctrl.updateIncident));
router.post('/incidents/:id/updates', authenticate, authorize('admin'), asyncHandler(ctrl.addIncidentUpdate));

module.exports = router;
