'use strict';

const { Router } = require('express');
const { authenticate, authorize } = require('@rach/identity');
const { asyncHandler, parseId } = require('@rach/core');
const ctrl = require('../controllers/knowledgeController');

const router = Router();
router.use(authenticate);

// Anyone in the workspace can ask; managing the approved library is gated tighter.
const anyStaff = authorize('reception', 'doctor', 'store_manager', 'tenant_admin', 'admin');
const librarian = authorize('doctor', 'tenant_admin', 'admin');

router.get   ('/docs',      anyStaff,  asyncHandler(ctrl.listDocs));
router.post  ('/docs',      librarian, asyncHandler(ctrl.createDoc));
router.delete('/docs/:id',  parseId(), librarian, asyncHandler(ctrl.deleteDoc));
router.post  ('/ask',       anyStaff,  asyncHandler(ctrl.ask));
router.post  ('/web',       anyStaff,  asyncHandler(ctrl.webReferences));

module.exports = router;
