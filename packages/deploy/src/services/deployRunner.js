'use strict';

const { NodeSSH }        = require('node-ssh');
const pool               = require('@rach/core').pool;
const { getSshPrivateKey } = require('./sshKey');
const { getInstallationToken } = require('./githubApp');

// ── Helpers ───────────────────────────────────────────────────────────────────

async function appendLog(logId, text) {
  await pool.query(
    `UPDATE deployment_logs SET log_output = COALESCE(log_output, '') || $1 WHERE id = $2`,
    [text + '\n', logId]
  );
}

// ── Main deploy function ──────────────────────────────────────────────────────

async function runDeploy({ serviceId, commitSha = null, triggeredBy = 'webhook' }) {
  // 1. Load service + VM SSH config
  const { rows: serviceRows } = await pool.query(
    `SELECT s.*, v.ip_address, v.ssh_user, v.ssh_port
     FROM deployment_services s
     LEFT JOIN vm_ssh_config v ON v.vm_id = s.vm_id
     WHERE s.id = $1`,
    [serviceId]
  );

  if (!serviceRows.length) throw new Error(`Service ${serviceId} not found`);
  const service = serviceRows[0];

  if (!service.ip_address) {
    throw new Error(`No SSH config found for VM ${service.vm_id} — add it in vm_ssh_config`);
  }

  // 2. Create deploy log entry
  const { rows: logRows } = await pool.query(
    `INSERT INTO deployment_logs (service_id, triggered_by, commit_sha, status)
     VALUES ($1, $2, $3, 'running') RETURNING id`,
    [serviceId, triggeredBy, commitSha]
  );
  const logId = logRows[0].id;

  // Update service status to deploying
  await pool.query(
    `UPDATE deployment_services SET status = 'deploying', updated_at = NOW() WHERE id = $1`,
    [serviceId]
  );

  const ssh = new NodeSSH();
  const deployDir = `/opt/rachdev/${service.repo_full_name.replace('/', '_')}`;

  try {
    await appendLog(logId, `[${new Date().toISOString()}] Starting deploy for ${service.repo_full_name}@${service.branch}`);
    await appendLog(logId, `[${new Date().toISOString()}] Connecting to ${service.ip_address}...`);

    // 3. SSH connect
    await ssh.connect({
      host:       service.ip_address,
      port:       service.ssh_port || 22,
      username:   service.ssh_user || 'root',
      privateKey: getSshPrivateKey(),
    });

    await appendLog(logId, `[${new Date().toISOString()}] Connected.`);

    // 4. Get GitHub token for cloning
    const ghToken = await getInstallationToken(service.installation_id);
    const cloneUrl = `https://x-access-token:${ghToken}@github.com/${service.repo_full_name}.git`;

    // 5. Run deploy steps
    const steps = [
      // Ensure deploy dir exists
      `mkdir -p ${deployDir}`,

      // Clone if first time, otherwise pull
      `if [ -d "${deployDir}/.git" ]; then
         cd ${deployDir} && git fetch origin && git checkout ${service.branch} && git pull origin ${service.branch}
       else
         git clone --branch ${service.branch} ${cloneUrl} ${deployDir}
       fi`,

      // Install dependencies (Node.js)
      `if [ -f "${deployDir}/package.json" ]; then
         cd ${deployDir} && npm install --production
       fi`,

      // Build if build script exists
      `if [ -f "${deployDir}/package.json" ] && cat ${deployDir}/package.json | grep -q '"build"'; then
         cd ${deployDir} && npm run build
       fi`,

      // Start or restart with PM2
      `if pm2 list | grep -q "${service.repo_full_name.split('/')[1]}"; then
         pm2 restart ${service.repo_full_name.split('/')[1]}
       else
         cd ${deployDir} && pm2 start npm --name "${service.repo_full_name.split('/')[1]}" -- start
       fi`,

      // Save PM2 process list
      `pm2 save`,
    ];

    for (const cmd of steps) {
      await appendLog(logId, `\n$ ${cmd.trim().split('\n')[0]}...`);
      const result = await ssh.execCommand(cmd, { cwd: deployDir });
      if (result.stdout) await appendLog(logId, result.stdout);
      if (result.stderr) await appendLog(logId, `STDERR: ${result.stderr}`);
      if (result.code !== 0 && result.code !== null) {
        throw new Error(`Command failed with exit code ${result.code}: ${result.stderr}`);
      }
    }

    // 6. Mark success
    await appendLog(logId, `\n[${new Date().toISOString()}] Deploy successful.`);
    await pool.query(
      `UPDATE deployment_logs SET status = 'success', finished_at = NOW() WHERE id = $1`,
      [logId]
    );
    await pool.query(
      `UPDATE deployment_services SET status = 'deployed', updated_at = NOW() WHERE id = $1`,
      [serviceId]
    );

    console.log(`[deploy] Service ${serviceId} deployed successfully`);
    return { success: true, logId };

  } catch (err) {
    console.error(`[deploy] Service ${serviceId} failed:`, err.message);
    await appendLog(logId, `\n[ERROR] ${err.message}`);
    await pool.query(
      `UPDATE deployment_logs SET status = 'failed', finished_at = NOW() WHERE id = $1`,
      [logId]
    );
    await pool.query(
      `UPDATE deployment_services SET status = 'failed', updated_at = NOW() WHERE id = $1`,
      [serviceId]
    );
    return { success: false, logId, error: err.message };

  } finally {
    ssh.dispose();
  }
}

module.exports = { runDeploy };
