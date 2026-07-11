'use strict';

const { Router }   = require('express');
const authenticate = require('@rach/identity').authenticate;
const authorize    = require('@rach/identity').authorize;
const asyncHandler = require('@rach/core').asyncHandler;
const ctrl         = require('../controllers/deploymentController');

const router = Router();

// Webhook — no auth, raw body needed (registered before json middleware in app.js)
router.post('/github/webhook', asyncHandler(ctrl.handleWebhook));

// All other routes require authentication
router.use(authenticate);

// GitHub App connection
router.get ('/github/install',  authorize('tenant_admin'), asyncHandler(ctrl.redirectToInstall));
router.get ('/github/callback',                            asyncHandler(ctrl.handleInstallCallback));
router.get ('/github/status',   authorize('tenant_admin'), asyncHandler(ctrl.getGithubStatus));
router.get ('/github/repos',    authorize('tenant_admin'), asyncHandler(ctrl.listRepos));
router.get ('/github/branches', authorize('tenant_admin'), asyncHandler(ctrl.listBranches));

// Services
router.post('/services',              authorize('tenant_admin'), asyncHandler(ctrl.createService));
router.get ('/services',              authorize('tenant_admin'), asyncHandler(ctrl.listServices));
router.get ('/services/:id/logs',     authorize('tenant_admin'), asyncHandler(ctrl.getDeployLogs));
router.post('/services/:id/deploy',   authorize('tenant_admin'), asyncHandler(ctrl.triggerDeploy));

// Admin: VM SSH config
router.get ('/vm-ssh-config', authorize('admin'), asyncHandler(ctrl.listVmSshConfigs));
router.post('/vm-ssh-config', authorize('admin'), asyncHandler(ctrl.setVmSshConfig));

module.exports = router;
