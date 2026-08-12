'use strict';

/**
 * Knowledge base routes for the agent product (/api/kb). Tenant admins manage the
 * reference library their agents' knowledge tool searches. Distinct from the
 * healthcare /api/knowledge surface.
 */

const { Router } = require('express');
const { authenticate, authorize } = require('@rach/identity');
const { asyncHandler, parseId } = require('@rach/core');
const ctrl = require('../controllers/knowledgeBaseController');

const router = Router();
router.use(authenticate);
const gate = authorize('tenant_admin', 'admin');

router.get   ('/docs',     gate, asyncHandler(ctrl.list));
router.post  ('/docs',     gate, asyncHandler(ctrl.create));
router.post  ('/upload',   gate, asyncHandler(ctrl.upload));      // multipart (busboy)
router.delete('/docs/:id', gate, parseId(), asyncHandler(ctrl.remove));

module.exports = router;
