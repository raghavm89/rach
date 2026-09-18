'use strict';

/**
 * BaaS management proxy (Phase 3). The dashboard manages a project's backend (users, functions,
 * buckets) WITHOUT the service_role key ever touching the browser: the BFF mints a service_role
 * token from the project secret (server-side) and calls the project's deployed gateway
 * (<ref>.rachbase.app) admin APIs. Returns { status, body } or throws when the backend isn't
 * reachable yet (not deployed) — the caller maps that to a "deploy your backend" state.
 */

const http = require('http');
const https = require('https');
const baas = require('@rach/baas');

const APPS_DOMAIN = process.env.APPS_DOMAIN || 'rachbase.app';
// Dev override: point the proxy at a local backend instead of https://<ref>.rachbase.app.
const baseFor = (ref) => process.env.BAAS_BACKEND_BASE || `https://${ref}.${APPS_DOMAIN}`;

// One admin request to the project backend, authorized as service_role.
function request({ ref, secret, method = 'GET', path, body }) {
  const token = baas.mintServiceKey(secret, ref);
  const target = new URL(path, baseFor(ref));
  const client = target.protocol === 'https:' ? https : http;
  const payload = body != null ? JSON.stringify(body) : null;

  return new Promise((resolve, reject) => {
    const req = client.request(target, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        ...(payload ? { 'content-length': Buffer.byteLength(payload) } : {}),
      },
    }, (res) => {
      let d = ''; res.on('data', (c) => { d += c; });
      res.on('end', () => { let parsed = null; try { parsed = d ? JSON.parse(d) : null; } catch { /* non-JSON */ } resolve({ status: res.statusCode, body: parsed }); });
    });
    req.on('error', reject);            // ECONNREFUSED / DNS → backend not deployed
    req.setTimeout(8000, () => req.destroy(new Error('backend timeout')));
    if (payload) req.write(payload);
    req.end();
  });
}

// Typed helpers for the console (paths route through the gateway to each primitive).
const listUsers = (p, { limit = 50, offset = 0 } = {}) => request({ ...p, path: `/auth/v1/admin/users?limit=${limit}&offset=${offset}` });
const createUser = (p, body) => request({ ...p, method: 'POST', path: '/auth/v1/admin/users', body });
const deleteUser = (p, id) => request({ ...p, method: 'DELETE', path: `/auth/v1/admin/users/${id}` });
const listFunctions = (p) => request({ ...p, path: '/functions/v1/functions' });
const getFunction = (p, name) => request({ ...p, path: `/functions/v1/functions/${name}` });
const deployFunction = (p, body) => request({ ...p, method: 'POST', path: '/functions/v1/deploy', body });
const deleteFunction = (p, name) => request({ ...p, method: 'DELETE', path: `/functions/v1/functions/${name}` });
const invokeFunction = (p, name, body) => request({ ...p, method: 'POST', path: `/functions/v1/${name}`, body });
const listFunctionSecrets = (p) => request({ ...p, path: '/functions/v1/secrets' });
const setFunctionSecrets = (p, body) => request({ ...p, method: 'POST', path: '/functions/v1/secrets', body });
const deleteFunctionSecret = (p, name) => request({ ...p, method: 'DELETE', path: `/functions/v1/secrets/${name}` });
const listBuckets = (p) => request({ ...p, path: '/storage/v1/bucket' });
const createBucket = (p, body) => request({ ...p, method: 'POST', path: '/storage/v1/bucket', body });
// OAuth Server client registry (project acting as an identity provider).
const listOAuthApps = (p) => request({ ...p, path: '/auth/v1/admin/oauth/apps' });
const createOAuthApp = (p, body) => request({ ...p, method: 'POST', path: '/auth/v1/admin/oauth/apps', body });
const deleteOAuthApp = (p, clientId) => request({ ...p, method: 'DELETE', path: `/auth/v1/admin/oauth/apps/${clientId}` });

module.exports = {
  request, listUsers, createUser, deleteUser,
  listFunctions, getFunction, deployFunction, deleteFunction, invokeFunction,
  listFunctionSecrets, setFunctionSecrets, deleteFunctionSecret,
  listBuckets, createBucket, listOAuthApps, createOAuthApp, deleteOAuthApp,
};
