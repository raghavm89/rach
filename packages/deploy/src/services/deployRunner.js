'use strict';

/**
 * Deploy a GitHub service onto its VM over SSH, native (no Docker), atomically.
 *
 * Release-based, zero-downtime-ish layout per service:
 *   /opt/rachbase/svc-<id>/repo            persistent git cache (fetch target)
 *   /opt/rachbase/svc-<id>/releases/<ts>   an immutable build of one commit
 *   /opt/rachbase/svc-<id>/current   ->     symlink to the active release
 *
 * The new release is checked out and BUILT before anything user-facing changes.
 * Only after install+build succeed do we flip the `current` symlink and restart
 * systemd (WorkingDirectory=.../current). If the new release fails to build or
 * fails its post-restart health check, we roll `current` back to the previous
 * release and restart it — so a broken deploy never replaces a working one.
 *
 * The caller (deploymentController) resolves and passes:
 *   - `env`        : [{ key, value }]  decrypted service env vars
 *   - `privateKey` : the VM's per-VM SSH key (falls back to the shared key)
 *
 * Build/start behaviour comes from the service's `config`:
 *   root_dir, install_cmd, build_cmd, start_cmd, port (all optional).
 */

const { NodeSSH }        = require('node-ssh');
const pool               = require('@rach/core').pool;
const { getSshPrivateKey } = require('./sshKey');
const { getInstallationToken } = require('./githubApp');

const KEEP_RELEASES = 5;      // how many old releases to retain for rollback
const HEALTH_TRIES  = 10;     // seconds to wait for the unit to come up

async function appendLog(logId, text) {
  await pool.query(
    `UPDATE deployment_logs SET log_output = COALESCE(log_output, '') || $1 WHERE id = $2`,
    [text + '\n', logId]
  );
}

function shq(s) { return `'${String(s).replace(/'/g, "'\\''")}'`; }

async function runDeploy({ serviceId, commitSha = null, triggeredBy = 'webhook', env = null, privateKey = null }) {
  const { rows: serviceRows } = await pool.query(
    `SELECT s.*, v.ip_address, v.ssh_user, v.ssh_port
     FROM deployment_services s
     LEFT JOIN vm_ssh_config v ON v.vm_id = s.vm_id AND v.tenant_id = s.tenant_id
     WHERE s.id = $1`,
    [serviceId]
  );
  if (!serviceRows.length) throw new Error(`Service ${serviceId} not found`);
  const service = serviceRows[0];
  if (!service.ip_address) throw new Error(`No SSH config for VM ${service.vm_id}`);

  const cfg        = service.config || {};
  const rootDir    = String(cfg.root_dir || '').replace(/^\/+|\/+$/g, '');
  const installCmd = cfg.install_cmd || 'npm ci || npm install';
  const buildCmd   = cfg.build_cmd   || 'npm run build --if-present';
  const startCmd   = cfg.start_cmd   || 'npm start';
  const port       = Number(cfg.port) || 3000;
  const sshUser    = service.ssh_user || 'rachops';

  const base    = `/opt/rachbase/svc-${serviceId}`;
  const repoDir = `${base}/repo`;
  const subPath = rootDir ? `/${rootDir}` : '';
  const envFile = `/etc/rachbase/svc-${serviceId}.env`;
  const unit    = `rb-svc-${serviceId}`;

  const { rows: logRows } = await pool.query(
    `INSERT INTO deployment_logs (service_id, triggered_by, commit_sha, status)
     VALUES ($1, $2, $3, 'running') RETURNING id`,
    [serviceId, triggeredBy, commitSha]
  );
  const logId = logRows[0].id;
  // Remember whether a working release already exists — a failed/rolled-back
  // deploy must not downgrade a service that still has the old release running.
  const wasDeployed = service.status === 'deployed';
  await pool.query(`UPDATE deployment_services SET status = 'deploying', updated_at = NOW() WHERE id = $1`, [serviceId]);

  const ssh = new NodeSSH();
  try {
    await appendLog(logId, `[${new Date().toISOString()}] Deploy ${service.repo_full_name}@${service.branch} → ${service.ip_address}`);
    await ssh.connect({
      host:       service.ip_address,
      port:       service.ssh_port || 22,
      username:   sshUser,
      privateKey: privateKey || getSshPrivateKey(),
    });

    const ghToken  = await getInstallationToken(service.installation_id);
    const cloneUrl = `https://x-access-token:${ghToken}@github.com/${service.repo_full_name}.git`;
    const branch   = service.branch;

    const envLines = [
      `PORT=${port}`,
      ...(env || []).map((v) => `${v.key}=${String(v.value).replace(/[\r\n]+/g, ' ')}`),
    ].join('\n');

    // ── Phase A: prepare + BUILD the new release (set -e; on any failure the
    //    ERR trap wipes the half-built release and leaves `current` untouched).
    const buildScript = [
      'set -e',
      `BASE=${shq(base)}`,
      `REL="$BASE/releases/$(date +%Y%m%d%H%M%S)-$$"`,
      // Clean up the half-built release on any error; never touch `current`.
      `trap 'echo "[build-failed] keeping existing release live"; rm -rf "$REL" 2>/dev/null || true' ERR`,
      `sudo mkdir -p "$BASE/releases" && sudo chown -R ${shq(sshUser)} "$BASE"`,
      // Update the git cache (shallow) to the branch tip.
      `if [ -d "$BASE/repo/.git" ]; then ` +
        `cd "$BASE/repo" && git remote set-url origin ${shq(cloneUrl)} && ` +
        `git fetch --depth 1 origin ${shq(branch)} && git checkout -q -B ${shq(branch)} FETCH_HEAD; ` +
      `else git clone --depth 1 --branch ${shq(branch)} ${shq(cloneUrl)} "$BASE/repo"; fi`,
      // Snapshot the checkout into the new release (no .git — immutable build dir).
      `mkdir -p "$REL"`,
      `( cd "$BASE/repo" && git archive HEAD ) | tar -x -C "$REL"`,
      `echo "$REL" > /tmp/rb-rel-${serviceId}`,   // hand the path to phase B
      `cd "$REL"${subPath ? ` && cd ${shq(rootDir)}` : ''}`,
      installCmd,
      buildCmd,
      // Env file + unit are written now (safe — they don't affect the running svc
      // until the restart in phase B).
      'sudo mkdir -p /etc/rachbase',
      `sudo tee ${envFile} >/dev/null <<'RBENV'\n${envLines}\nRBENV`,
      `sudo chmod 600 ${envFile}`,
      `sudo tee /etc/systemd/system/${unit}.service >/dev/null <<'RBUNIT'\n` +
        `[Unit]\nDescription=RachBase service ${serviceId}\nAfter=network.target\n\n` +
        `[Service]\nWorkingDirectory=${base}/current${subPath}\nEnvironmentFile=${envFile}\n` +
        `ExecStart=/bin/bash -lc ${shq(startCmd)}\nRestart=always\nRestartSec=3\nUser=${sshUser}\n\n` +
        `[Install]\nWantedBy=multi-user.target\nRBUNIT`,
      'sudo systemctl daemon-reload',
      `echo "[build-ok] release ready"`,
    ].join('\n');

    await appendLog(logId, '── Building new release ──');
    const build = await ssh.execCommand(buildScript);
    if (build.stdout) await appendLog(logId, build.stdout);
    if (build.stderr) await appendLog(logId, `STDERR: ${build.stderr}`);
    if (build.code !== 0 && build.code !== null) {
      throw new Error(`Build failed (exit ${build.code}) — existing release left running`);
    }

    // ── Phase B: atomically flip `current`, restart, health-check, roll back on
    //    failure. No `set -e` here so we control the rollback path explicitly.
    const swapScript = [
      `BASE=${shq(base)}`,
      `REL="$(cat /tmp/rb-rel-${serviceId})"`,
      `PREV=""; if [ -L "$BASE/current" ]; then PREV="$(readlink "$BASE/current")"; fi`,
      `ln -sfn "$REL" "$BASE/current"`,
      `sudo systemctl enable ${unit} >/dev/null 2>&1 || true`,
      `sudo systemctl restart ${unit}`,
      `ok=0; for i in $(seq 1 ${HEALTH_TRIES}); do sleep 1; if systemctl is-active --quiet ${unit}; then ok=1; break; fi; done`,
      `if [ "$ok" != "1" ]; then`,
      `  echo "[health-failed] new release did not become active";`,
      `  if [ -n "$PREV" ] && [ -d "$PREV" ]; then echo "[rollback] restoring $PREV"; ln -sfn "$PREV" "$BASE/current"; sudo systemctl restart ${unit} || true; fi;`,
      `  rm -rf "$REL" 2>/dev/null || true;`,
      `  exit 1;`,
      `fi`,
      // Success — prune old releases, never the current target.
      `CUR="$(readlink "$BASE/current")"`,
      `ls -1dt "$BASE"/releases/*/ 2>/dev/null | tail -n +$((${KEEP_RELEASES}+1)) | while read d; do d="\${d%/}"; [ "$d" = "$CUR" ] && continue; rm -rf "$d"; done`,
      `rm -f /tmp/rb-rel-${serviceId}`,
      `echo "[live] $REL is now serving"`,
    ].join('\n');

    await appendLog(logId, '── Switching traffic to new release ──');
    const swap = await ssh.execCommand(swapScript);
    if (swap.stdout) await appendLog(logId, swap.stdout);
    if (swap.stderr) await appendLog(logId, `STDERR: ${swap.stderr}`);
    if (swap.code !== 0 && swap.code !== null) {
      throw new Error('New release failed health check — rolled back to previous release');
    }

    await appendLog(logId, `\n[${new Date().toISOString()}] Deploy successful — service '${unit}' active.`);
    await pool.query(`UPDATE deployment_logs SET status = 'success', finished_at = NOW() WHERE id = $1`, [logId]);
    await pool.query(`UPDATE deployment_services SET status = 'deployed', updated_at = NOW() WHERE id = $1`, [serviceId]);
    return { success: true, logId };
  } catch (err) {
    console.error(`[deploy] Service ${serviceId} failed:`, err.message);
    await appendLog(logId, `\n[ERROR] ${err.message}`);
    await pool.query(`UPDATE deployment_logs SET status = 'failed', finished_at = NOW() WHERE id = $1`, [logId]);
    // A rolled-back / build-failed deploy still has the previous release running,
    // so keep the service 'deployed'. Only a first-ever deploy goes to 'failed'.
    await pool.query(
      `UPDATE deployment_services SET status = $2, updated_at = NOW() WHERE id = $1`,
      [serviceId, wasDeployed ? 'deployed' : 'failed']
    );
    return { success: false, logId, error: err.message };
  } finally {
    ssh.dispose();
  }
}

module.exports = { runDeploy };
