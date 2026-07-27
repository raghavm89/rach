'use strict';

const { Router }   = require('express');
const authenticate = require('@rach/identity').authenticate;
const authorize    = require('@rach/identity').authorize;
const asyncHandler = require('@rach/core').asyncHandler;
const { deployLimiter } = require('@rach/core').rateLimit;
const ctrl         = require('../controllers/deploymentController');

const router = Router();

// Webhook — no auth, raw body needed (registered before json middleware in app.js)
router.post('/github/webhook', asyncHandler(ctrl.handleWebhook));

// GitHub install callback — GitHub redirects the browser here with no Bearer
// token, so it must be public. Tenant is resolved from the signed `state` param.
router.get('/github/callback', asyncHandler(ctrl.handleInstallCallback));

// All other routes require authentication
router.use(authenticate);

// GitHub App connection
router.get ('/github/install',  authorize('tenant_admin'), asyncHandler(ctrl.redirectToInstall));
router.get ('/github/status',   authorize('tenant_admin'), asyncHandler(ctrl.getGithubStatus));
router.post('/github/reconcile',authorize('tenant_admin'), asyncHandler(ctrl.reconcileGithub));
router.get ('/github/repos',    authorize('tenant_admin'), asyncHandler(ctrl.listRepos));
router.get ('/github/branches', authorize('tenant_admin'), asyncHandler(ctrl.listBranches));

// Services
router.post('/services',              authorize('tenant_admin'), asyncHandler(ctrl.createService));
router.get ('/services',              authorize('tenant_admin'), asyncHandler(ctrl.listServices));
router.delete('/services/:id',        authorize('tenant_admin'), asyncHandler(ctrl.deleteService));
router.get ('/services/:id/logs',     authorize('tenant_admin'), asyncHandler(ctrl.getDeployLogs));
router.post('/services/:id/deploy',   authorize('tenant_admin'), deployLimiter, asyncHandler(ctrl.triggerDeploy));

// Per-service environment variables
router.get('/services/:id/env', authorize('tenant_admin'), asyncHandler(ctrl.getServiceEnv));
router.put('/services/:id/env', authorize('tenant_admin'), asyncHandler(ctrl.setServiceEnv));

// Per-service build/start settings + runtime logs
router.patch('/services/:id',              authorize('tenant_admin'), asyncHandler(ctrl.updateServiceConfig));
router.get  ('/services/:id/runtime-logs', authorize('tenant_admin'), asyncHandler(ctrl.getRuntimeLogs));

// Per-service domains (Caddy)
router.get   ('/services/:id/domains',            authorize('tenant_admin'), asyncHandler(ctrl.listDomains));
router.post  ('/services/:id/domains',            authorize('tenant_admin'), asyncHandler(ctrl.addDomain));
router.post  ('/services/:id/domains/auto',       authorize('tenant_admin'), asyncHandler(ctrl.addAutoDomain));
router.delete('/services/:id/domains/:domainId',  authorize('tenant_admin'), asyncHandler(ctrl.removeDomain));

// Canvas node positions (drag-and-drop layout persistence)
router.get ('/canvas', authorize('tenant_admin'), asyncHandler(ctrl.getCanvas));
router.put ('/canvas', authorize('tenant_admin'), asyncHandler(ctrl.saveCanvas));

// Admin: VM SSH config
router.get ('/vm-ssh-config', authorize('admin'), asyncHandler(ctrl.listVmSshConfigs));
router.post('/vm-ssh-config', authorize('admin'), asyncHandler(ctrl.setVmSshConfig));

module.exports = router;
