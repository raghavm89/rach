'use strict';

/**
 * Monitoring routes.
 *
 * Access matrix:
 * ┌─────────────────────────────────┬────────┬──────────────┬─────────────┐
 * │ Endpoint                        │ admin  │ tenant_admin │ tenant_user │
 * ├─────────────────────────────────┼────────┼──────────────┼─────────────┤
 * │ GET /api/monitoring/summary     │  ✓ *   │  ✓ pool      │  ✓ own      │
 * │ GET /api/monitoring/vms         │  ✓ *   │  ✓ pool      │  ✓ own      │
 * │ GET /api/monitoring/vms/:vmId   │  ✓ *   │  ✓ pool      │  ✓ own      │
 * │ GET /api/monitoring/history     │  ✓ *   │  ✓ pool      │  ✓ own      │
 * │ GET /api/monitoring/users       │  ✓     │  —           │  —          │
 * │ GET /api/monitoring/verify      │  ✓     │  —           │  —          │
 * └─────────────────────────────────┴────────┴──────────────┴─────────────┘
 *
 * Scoping is enforced in the controller — clients cannot override it.
 */

const { Router }   = require('express');
const authenticate = require('@rach/identity').authenticate;
const authorize    = require('@rach/identity').authorize;
const asyncHandler = require('@rach/core').asyncHandler;
const {
  verify,
  getSummary,
  getVMs,
  getVM,
  getHistory,
  getAllUsersUsage,
} = require('../controllers/monitoringController');

const router = Router();

router.use(authenticate);

// All authenticated tenant roles can view monitoring (scoped to their VMs)
router.get('/summary',   authorize('admin', 'tenant_admin', 'tenant_user'), asyncHandler(getSummary));
router.get('/vms',       authorize('admin', 'tenant_admin', 'tenant_user'), asyncHandler(getVMs));
router.get('/vms/:vmId', authorize('admin', 'tenant_admin', 'tenant_user'), asyncHandler(getVM));
router.get('/history',   authorize('admin', 'tenant_admin', 'tenant_user'), asyncHandler(getHistory));

// Admin only — per-tenant usage breakdown
router.get('/users', authorize('admin'), asyncHandler(getAllUsersUsage));

// Admin only — Grafana/Prometheus connectivity check for ops diagnostics
router.get('/verify', authorize('admin'), asyncHandler(verify));

module.exports = router;
