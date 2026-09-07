'use strict';

const { Router } = require('express');
const { authenticate, authorize } = require('@rach/identity');
const { asyncHandler, parseId } = require('@rach/core');
const ctrl = require('../controllers/projectController');
const backups = require('../controllers/backupController');
const realtime = require('../controllers/realtimeController');

const router = Router();
router.use(authenticate);

const TENANT_ROLES = ['admin', 'tenant_admin', 'tenant_user', 'developer'];

// Projects
router.get('/',        authorize(...TENANT_ROLES), asyncHandler(ctrl.listProjects));
router.post('/',       authorize('admin', 'tenant_admin', 'developer'), asyncHandler(ctrl.createProject));
router.get('/:id',     authorize(...TENANT_ROLES), parseId('id'), asyncHandler(ctrl.getProject));

// BaaS (Phase 3) — tenant overview (before /:id so 'baas' isn't parsed as an id), then per-project
router.get('/baas/overview',    authorize(...TENANT_ROLES), asyncHandler(ctrl.baasOverview));
router.post('/:id/baas/enable', authorize('admin', 'tenant_admin', 'developer'), parseId('id'), asyncHandler(ctrl.enableBaas));
router.post('/:id/baas/deploy', authorize('admin', 'tenant_admin', 'developer'), parseId('id'), asyncHandler(ctrl.deployBaas));
router.post('/:id/baas/compute', authorize('admin', 'tenant_admin', 'developer'), parseId('id'), asyncHandler(ctrl.setBaasCompute));
router.post('/:id/baas/compute/verify', authorize('admin', 'tenant_admin', 'developer'), parseId('id'), asyncHandler(ctrl.verifyBaasCompute));
router.get('/:id/baas',         authorize(...TENANT_ROLES), parseId('id'), asyncHandler(ctrl.getBaas));
// Observability (Pro plan): metrics summary + time series
router.get('/:id/baas/observability/summary', authorize(...TENANT_ROLES), parseId('id'), asyncHandler(ctrl.getObsSummary));
router.get('/:id/baas/observability/series',  authorize(...TENANT_ROLES), parseId('id'), asyncHandler(ctrl.getObsSeries));
// BaaS API keys (opaque publishable/secret, revocable) — control-plane managed
router.get('/:id/baas/keys',        authorize(...TENANT_ROLES), parseId('id'), asyncHandler(ctrl.baasApiKeys));
router.post('/:id/baas/keys',       authorize('admin', 'tenant_admin', 'developer'), parseId('id'), asyncHandler(ctrl.baasCreateSecretKey));
router.delete('/:id/baas/keys/:kid', authorize('admin', 'tenant_admin', 'developer'), parseId('id'), asyncHandler(ctrl.baasRevokeApiKey));
// BaaS Auth configuration (Supabase-parity; control-plane, works pre-deploy)
router.get('/:id/baas/auth/config',  authorize(...TENANT_ROLES), parseId('id'), asyncHandler(ctrl.getAuthConfig));
router.put('/:id/baas/auth/config',  authorize('admin', 'tenant_admin', 'developer'), parseId('id'), asyncHandler(ctrl.setAuthConfig));
// BaaS management console (proxied to the deployed backend, service_role server-side)
router.get('/:id/baas/users',        authorize(...TENANT_ROLES), parseId('id'), asyncHandler(ctrl.baasUsers));
router.post('/:id/baas/users',       authorize('admin', 'tenant_admin', 'developer'), parseId('id'), asyncHandler(ctrl.baasCreateUser));
router.delete('/:id/baas/users/:uid', authorize('admin', 'tenant_admin', 'developer'), parseId('id'), asyncHandler(ctrl.baasDeleteUser));
router.get('/:id/baas/oauth/apps',        authorize(...TENANT_ROLES), parseId('id'), asyncHandler(ctrl.baasOAuthApps));
router.post('/:id/baas/oauth/apps',       authorize('admin', 'tenant_admin', 'developer'), parseId('id'), asyncHandler(ctrl.baasCreateOAuthApp));
router.delete('/:id/baas/oauth/apps/:clientId', authorize('admin', 'tenant_admin', 'developer'), parseId('id'), asyncHandler(ctrl.baasDeleteOAuthApp));
router.get('/:id/baas/functions',    authorize(...TENANT_ROLES), parseId('id'), asyncHandler(ctrl.baasFunctions));
router.post('/:id/baas/functions',   authorize('admin', 'tenant_admin', 'developer'), parseId('id'), asyncHandler(ctrl.baasDeployFunction));
router.get('/:id/baas/functions/secrets',  authorize(...TENANT_ROLES), parseId('id'), asyncHandler(ctrl.baasFunctionSecrets));
router.post('/:id/baas/functions/secrets', authorize('admin', 'tenant_admin', 'developer'), parseId('id'), asyncHandler(ctrl.baasSetFunctionSecrets));
router.delete('/:id/baas/functions/secrets/:name', authorize('admin', 'tenant_admin', 'developer'), parseId('id'), asyncHandler(ctrl.baasDeleteFunctionSecret));
router.post('/:id/baas/functions/:name/invoke', authorize('admin', 'tenant_admin', 'developer'), parseId('id'), asyncHandler(ctrl.baasInvokeFunction));
router.get('/:id/baas/functions/:name',    authorize(...TENANT_ROLES), parseId('id'), asyncHandler(ctrl.baasGetFunction));
router.delete('/:id/baas/functions/:name', authorize('admin', 'tenant_admin', 'developer'), parseId('id'), asyncHandler(ctrl.baasDeleteFunction));
router.get('/:id/baas/buckets',      authorize(...TENANT_ROLES), parseId('id'), asyncHandler(ctrl.baasBuckets));
router.post('/:id/baas/buckets',     authorize('admin', 'tenant_admin', 'developer'), parseId('id'), asyncHandler(ctrl.baasCreateBucket));
// Storage config (Settings + S3) + S3 access keys — control-plane, works pre-deploy
router.get('/:id/baas/storage/config',  authorize(...TENANT_ROLES), parseId('id'), asyncHandler(ctrl.getStorageConfig));
router.put('/:id/baas/storage/config',  authorize('admin', 'tenant_admin', 'developer'), parseId('id'), asyncHandler(ctrl.setStorageConfig));
router.post('/:id/baas/storage/s3-keys',       authorize('admin', 'tenant_admin', 'developer'), parseId('id'), asyncHandler(ctrl.createS3Key));
router.delete('/:id/baas/storage/s3-keys/:kid', authorize('admin', 'tenant_admin', 'developer'), parseId('id'), asyncHandler(ctrl.deleteS3Key));
router.get('/:id/baas/tables',       authorize(...TENANT_ROLES), parseId('id'), asyncHandler(ctrl.baasTables));

// Backups (managed Postgres) — list is read-only; backup/restore are mutations.
router.get('/:id/baas/backups',                    authorize(...TENANT_ROLES), parseId('id'), asyncHandler(backups.listBackups));
router.post('/:id/baas/backups',                   authorize('admin', 'tenant_admin', 'developer'), parseId('id'), asyncHandler(backups.createBackup));
router.post('/:id/baas/backups/:bid/restore',      authorize('admin', 'tenant_admin', 'developer'), parseId('id'), asyncHandler(backups.restoreBackup));
router.get('/:id/baas/backups/:bid/download',      authorize('admin', 'tenant_admin', 'developer'), parseId('id'), asyncHandler(backups.downloadBackup));

// Realtime — enable/disable per table; list is read-only.
router.get('/:id/baas/realtime',                   authorize(...TENANT_ROLES), parseId('id'), asyncHandler(realtime.getRealtime));
router.post('/:id/baas/realtime/tables',           authorize('admin', 'tenant_admin', 'developer'), parseId('id'), asyncHandler(realtime.enableTable));
router.delete('/:id/baas/realtime/tables/:table',  authorize('admin', 'tenant_admin', 'developer'), parseId('id'), asyncHandler(realtime.disableTable));
router.post('/:id/baas/query',       authorize('admin', 'tenant_admin', 'developer'), parseId('id'), asyncHandler(ctrl.baasQuery));

// Services (nested under a project)
router.get('/:id/services',                 authorize(...TENANT_ROLES), parseId('id'), asyncHandler(ctrl.listServices));
router.post('/:id/services',                authorize('admin', 'tenant_admin', 'developer'), parseId('id'), asyncHandler(ctrl.createService));
router.get('/:id/services/:sid',            authorize(...TENANT_ROLES), parseId('id'), parseId('sid'), asyncHandler(ctrl.getService));
router.delete('/:id/services/:sid',         authorize('admin', 'tenant_admin', 'developer'), parseId('id'), parseId('sid'), asyncHandler(ctrl.deleteService));
router.post('/:id/services/:sid/deploy',    authorize('admin', 'tenant_admin', 'developer'), parseId('id'), parseId('sid'), asyncHandler(ctrl.deployService));
router.delete('/:id/services/:sid/deployments/:did', authorize('admin', 'tenant_admin', 'developer'), parseId('id'), parseId('sid'), parseId('did'), asyncHandler(ctrl.deleteDeployment));

// Per-service env vars + run command
router.get('/:id/services/:sid/env',    authorize(...TENANT_ROLES), parseId('id'), parseId('sid'), asyncHandler(ctrl.getServiceEnv));
router.put('/:id/services/:sid/env',    authorize('admin', 'tenant_admin', 'developer'), parseId('id'), parseId('sid'), asyncHandler(ctrl.setServiceEnv));
router.patch('/:id/services/:sid/config', authorize('admin', 'tenant_admin', 'developer'), parseId('id'), parseId('sid'), asyncHandler(ctrl.updateServiceConfig));

// Container pay-to-online (bring online / change compute size)
router.post('/:id/services/:sid/checkout', authorize('admin', 'tenant_admin', 'developer'), parseId('id'), parseId('sid'), asyncHandler(ctrl.checkoutContainer));
router.post('/:id/services/:sid/verify',   authorize('admin', 'tenant_admin', 'developer'), parseId('id'), parseId('sid'), asyncHandler(ctrl.verifyContainer));
router.post('/:id/services/:sid/verify-resize', authorize('admin', 'tenant_admin', 'developer'), parseId('id'), parseId('sid'), asyncHandler(ctrl.verifyResize));

module.exports = router;
