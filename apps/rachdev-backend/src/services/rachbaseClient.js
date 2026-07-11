'use strict';

/**
 * RachBaseClient — RachDev's HTTP client for RachBase's internal service API.
 *
 * This is the seam that makes RachDev and RachBase separate services: instead of
 * importing @rach/deploy in-process, RachDev asks RachBase (which owns the infra
 * and SSH keys) to perform deploys and VM commands, authenticated by a shared
 * service token.
 *
 * Env: RACHBASE_API_URL (e.g. https://api.rachbase.example), RACHBASE_SERVICE_TOKEN.
 */

const BASE_URL = (process.env.RACHBASE_API_URL || 'http://localhost:8080').replace(/\/$/, '');
const SERVICE_TOKEN = process.env.RACHBASE_SERVICE_TOKEN || '';

async function post(pathname, body) {
  const res = await fetch(`${BASE_URL}${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-service-token': SERVICE_TOKEN,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `RachBase API error (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Trigger a git deploy of a service the tenant owns. */
function triggerDeploy({ tenantId, serviceId }) {
  return post('/internal/deploy', { tenant_id: tenantId, service_id: serviceId });
}

/** Run a command on a tenant VM over SSH (RachBase performs the exec). */
function runCommand({ tenantId, vmId, command }) {
  return post('/internal/run-command', { tenant_id: tenantId, vm_id: vmId, command });
}

module.exports = { triggerDeploy, runCommand };
