'use strict';

const { Router } = require('express');
const { authenticate, authorize, roles } = require('@rach/identity');
const { HEALTHCARE } = roles;
const { asyncHandler, parseId } = require('@rach/core');
const ctrl = require('../controllers/knowledgeController');

const router = Router();
router.use(authenticate);

// Anyone in the workspace can ask; managing the approved library is gated tighter.
const anyStaff = authorize(...HEALTHCARE.anyStaff);
const librarian = authorize(...HEALTHCARE.clinician);

router.get   ('/docs',      anyStaff,  asyncHandler(ctrl.listDocs));
router.post  ('/docs',      librarian, asyncHandler(ctrl.createDoc));
router.delete('/docs/:id',  parseId(), librarian, asyncHandler(ctrl.deleteDoc));
router.post  ('/ask',       anyStaff,  asyncHandler(ctrl.ask));
router.post  ('/web',       anyStaff,  asyncHandler(ctrl.webReferences));

module.exports = router;
