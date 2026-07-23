'use strict';

/**
 * Internal service API — privileged infra operations RachBase performs on behalf
 * of a trusted caller (rachdev-backend). The ownership checks + deploy/SSH logic
 * that used to live in RachDev's agentController now live here, on the side that
 * owns the infrastructure and the SSH keys.
 *
 * tenant_id is supplied by the caller (RachDev), which has already authenticated
 * the end user; these routes are additionally protected by serviceAuth.
 */

const { pool } = require('@rach/core');
const { runDeploy, getSshPrivateKey } = require('@rach/deploy');
const { NodeSSH } = require('node-ssh');
const { ServiceUsage } = require('../models/serviceAlert');
const alerting = require('../services/alerting');

// POST /internal/deploy  { tenant_id, service_id }
exports.deploy = async (req, res) => {
  const { tenant_id, service_id } = req.body;
  if (!tenant_id || !service_id) {
    return res.status(400).json({ error: 'tenant_id and service_id required' });
  }

  const { rows } = await pool.query(
    'SELECT id FROM deployment_services WHERE id = $1 AND tenant_id = $2',
    [service_id, tenant_id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Service not found' });

  runDeploy({ serviceId: service_id, triggeredBy: 'agent' })
    .catch((err) => console.error('[internal/deploy]', err.message));

  res.json({ message: 'Deploy started', service_id });
};

// POST /internal/run-command  { tenant_id, vm_id, command }
exports.runCommand = async (req, res) => {
  const { tenant_id, vm_id, command } = req.body;
  if (!tenant_id || !vm_id || !command) {
    return res.status(400).json({ error: 'tenant_id, vm_id and command required' });
  }

  const { rows } = await pool.query(
    'SELECT * FROM vm_ssh_config WHERE vm_id = $1 AND tenant_id = $2',
    [vm_id, tenant_id]
  );
  if (!rows.length) return res.status(404).json({ error: 'VM not found' });

  const vmConfig = rows[0];
  const ssh = new NodeSSH();
  try {
    await ssh.connect({
      host:       vmConfig.ip_address,
      port:       vmConfig.ssh_port || 22,
      username:   vmConfig.ssh_user || 'root',
      privateKey: getSshPrivateKey(),
    });
    const result = await ssh.execCommand(command);
    res.json({ stdout: result.stdout, stderr: result.stderr, code: result.code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    ssh.dispose();
  }
};

// POST /internal/usage  { service_id, cpu_pct, mem_pct, disk_pct }
// The orchestrator / metrics agent posts a usage sample (percent 0..100).
exports.recordUsage = async (req, res) => {
  const { service_id, cpu_pct, mem_pct, disk_pct } = req.body;
  const nums = [cpu_pct, mem_pct, disk_pct].map(Number);
  if (!service_id || nums.some((n) => !Number.isFinite(n))) {
    return res.status(400).json({ error: 'service_id, cpu_pct, mem_pct, disk_pct required' });
  }
  // Reject samples for unknown services — otherwise any token holder (or a bug in
  // the orchestrator) could inject junk that skews or suppresses alerting (L4).
  const { rows: svc } = await pool.query('SELECT 1 FROM services WHERE id = $1', [service_id]);
  if (!svc.length) {
    return res.status(404).json({ error: `Unknown service_id: ${service_id}` });
  }
  const sample = await ServiceUsage.record({ serviceId: service_id, cpu: nums[0], mem: nums[1], disk: nums[2] });
  res.status(201).json({ sample });
};

// POST /internal/alerts/evaluate — sweep online services and email on sustained breach.
// Intended to be driven by a scheduled task (~every minute).
exports.evaluateAlerts = async (_req, res) => {
  const summary = await alerting.evaluateAllOnline();
  res.json(summary);
};
