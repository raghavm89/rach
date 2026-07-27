'use strict';

/**
 * Per-VM SSH key rotation (every VM_KEY_ROTATE_DAYS, default 2).
 *
 * Rollover order is chosen so a VM can never be stranded:
 *   1. mint a replacement keypair (status 'rotating')
 *   2. using the CURRENT key, install the new public key into authorized_keys
 *   3. VERIFY we can log in with the new key
 *   4. only then promote in the DB (new = active, old = revoked)
 *   5. best-effort remove the old public key from the VM (a leftover line is
 *      harmless hygiene, never a lockout)
 * Any failure before step 4 discards the new key and leaves the old one active.
 */

const { NodeSSH } = require('node-ssh');
const { pool } = require('@rach/core');
const { VmKey } = require('../models/vmKey');

const ROTATE_AFTER_DAYS = Number(process.env.VM_KEY_ROTATE_DAYS || 2);

function shq(s) { return `'${String(s).replace(/'/g, "'\\''")}'`; }
function authKeysPath(user) { return user === 'root' ? '/root/.ssh/authorized_keys' : `/home/${user}/.ssh/authorized_keys`; }

async function sshConfigFor(vmId) {
  const { rows } = await pool.query(
    'SELECT ip_address, ssh_user, ssh_port FROM vm_ssh_config WHERE vm_id = $1', [vmId]
  );
  return rows[0] || null;
}

async function connect(cfg, privateKey) {
  const ssh = new NodeSSH();
  await ssh.connect({
    host: cfg.ip_address, port: cfg.ssh_port || 22,
    username: cfg.ssh_user || 'root', privateKey, readyTimeout: 15000,
  });
  return ssh;
}

async function appendKey(ssh, user, pubkey) {
  const path = authKeysPath(user);
  const dir = path.replace(/\/authorized_keys$/, '');
  const cmd = `mkdir -p ${dir} && chmod 700 ${dir} && touch ${path} && chmod 600 ${path} && ` +
              `(grep -qxF ${shq(pubkey)} ${path} || echo ${shq(pubkey)} >> ${path})`;
  const r = await ssh.execCommand(cmd);
  if (r.code !== 0) throw new Error(`append failed: ${r.stderr || r.code}`);
}

async function removeKey(ssh, user, pubkey) {
  const path = authKeysPath(user);
  const cmd = `tmp=$(mktemp) && grep -vxF ${shq(pubkey)} ${path} > "$tmp" 2>/dev/null; mv "$tmp" ${path} && chmod 600 ${path}`;
  await ssh.execCommand(cmd);
}

/** Rotate one VM's key. Returns a small result descriptor (never throws for op errors). */
async function rotateVm(vmId) {
  const cfg = await sshConfigFor(vmId);
  if (!cfg) return { vmId, skipped: 'no_ssh_config' };

  const current = await VmKey.getActiveForVm(vmId);
  if (!current) return { vmId, skipped: 'no_active_key' };

  const user = cfg.ssh_user || 'root';
  const next = await VmKey.createReplacement(vmId); // 'rotating', returns privateKey + public_key

  let sshCur, sshNew;
  try {
    // 2. install new public key using the current key
    sshCur = await connect(cfg, current.privateKey);
    await appendKey(sshCur, user, next.public_key);

    // 3. verify login with the new key
    sshNew = await connect(cfg, next.privateKey);
    const r = await sshNew.execCommand('echo ok');
    if (r.stdout.trim() !== 'ok') throw new Error('verify echo mismatch');

    // 4. promote (new active, old revoked) — new key is proven working
    await VmKey.promoteRotation(next.id, vmId);

    // 5. best-effort cleanup of the old key (leftover line is harmless)
    try { await removeKey(sshNew, user, current.public_key); } catch { /* hygiene only */ }

    return { vmId, rotated: true, keyId: next.id, version: next.key_version };
  } catch (e) {
    // Before promote: discard the new key, try to clean the appended line, keep old active.
    await VmKey.discard(next.id).catch(() => {});
    if (sshCur) { try { await removeKey(sshCur, user, next.public_key); } catch {} }
    return { vmId, error: e.message };
  } finally {
    if (sshCur) { try { sshCur.dispose(); } catch {} }
    if (sshNew) { try { sshNew.dispose(); } catch {} }
  }
}

/** Sweep all keys older than the rotation window. */
async function runRotationSweep() {
  const due = await VmKey.dueForRotation(ROTATE_AFTER_DAYS);
  const results = [];
  for (const k of due) {
    try { results.push(await rotateVm(k.vm_id)); }
    catch (e) { results.push({ vmId: k.vm_id, error: e.message }); }
  }
  const rotated = results.filter((r) => r.rotated).length;
  if (due.length) console.log(`[keyRotation] swept ${due.length}, rotated ${rotated}`);
  return { checked: due.length, rotated, results };
}

// Fixed key namespacing this job's Postgres advisory lock.
const LOCK_KEY = 42_100_001;

/**
 * A sweep guarded by a cluster-wide advisory lock, so with N backend instances
 * only ONE actually rotates at a time — the rest no-op. This is what lets the
 * scheduler run in-process (auto-started with the app, no manual cron) while
 * staying multi-instance safe.
 */
async function runRotationSweepLocked() {
  const { rows } = await pool.query('SELECT pg_try_advisory_lock($1) AS ok', [LOCK_KEY]);
  if (!rows[0].ok) return { skipped: 'locked' };
  try {
    return await runRotationSweep();
  } finally {
    await pool.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// In-process scheduler
// ---------------------------------------------------------------------------
// Starts with the backend (see server.js). A VM's 2-day rotation clock begins at
// activation (activated_at), so rotation "starts" when the VM is provisioned to
// the tenant — nothing to configure by hand. The sweep is cheap when nothing is
// due (a single query).

let _timer = null;
function start() {
  if (_timer) return;
  const everyMs = Number(process.env.VM_KEY_ROTATE_INTERVAL_MS || 60 * 60 * 1000); // hourly
  console.log(`[keyRotation] scheduler started — rotate keys older than ${ROTATE_AFTER_DAYS}d, sweep every ${Math.round(everyMs / 60000)}m`);
  const run = () => {
    runRotationSweepLocked()
      .catch((e) => console.error('[keyRotation]', e.message))
      .finally(() => { _timer = setTimeout(run, everyMs); });
  };
  _timer = setTimeout(run, 60_000); // first sweep 60s after boot
}
function stop() { if (_timer) { clearTimeout(_timer); _timer = null; } }

module.exports = { rotateVm, runRotationSweep, runRotationSweepLocked, start, stop };
