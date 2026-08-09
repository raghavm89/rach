'use strict';

const { Router } = require('express');
const { authenticate, authorize } = require('@rach/identity');
const { asyncHandler } = require('@rach/core');
const ctrl = require('../controllers/adminController');

const router = Router();
router.use(authenticate, authorize('admin')); // RachDev platform admin only

// Organizations (tenants)
router.get   ('/orgs',           asyncHandler(ctrl.listOrgs));
router.post  ('/orgs',           asyncHandler(ctrl.createOrg));
router.patch ('/orgs/:id/model',      asyncHandler(ctrl.setOrgModel));
router.patch ('/orgs/:id/healthcare', asyncHandler(ctrl.setOrgHealthcare));
router.patch ('/orgs/:id',            asyncHandler(ctrl.setOrgIndustry));
router.delete('/orgs/:id',       asyncHandler(ctrl.deleteOrg));

// Doctor department profiles (RachDev healthcare vertical)
router.get  ('/doctors',          asyncHandler(ctrl.listDoctorProfiles));
router.patch('/doctors/:userId',  asyncHandler(ctrl.setDoctorProfile));

// Platform agent templates (tenant_id IS NULL)
router.get ('/agent-templates',     asyncHandler(ctrl.listTemplates));
router.post('/agent-templates',     asyncHandler(ctrl.createTemplate));
router.put ('/agent-templates/:id', asyncHandler(ctrl.updateTemplate));

module.exports = router;
