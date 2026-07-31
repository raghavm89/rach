'use strict';

const { WebSocketServer } = require('ws');
const { NodeSSH }         = require('node-ssh');
const jwt                 = require('jsonwebtoken');
const pool                = require('@rach/core').pool;

const { getSshPrivateKey } = require('@rach/deploy');
const { VmKey } = require('../models/vmKey');
const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

// Allow falling back to the legacy shared key for VMs that don't have a per-VM
// key yet (e.g. provisioned before this feature). Set to 'false' once every VM
// has been re-keyed to force per-VM keys only.
const ALLOW_SHARED_KEY_FALLBACK = process.env.TERMINAL_ALLOW_SHARED_KEY !== 'false';

/**
 * Role-based access to a VM's terminal:
 *   admin        → any VM
 *   tenant_admin → any VM in their tenant
 *   tenant_user  → only VMs assigned to them
 * Returns the vm_ssh_config row if allowed, else null.
 */
async function resolveVmAccess(user, vmId) {
  const { rows } = await pool.query('SELECT * FROM vm_ssh_config WHERE vm_id = $1', [vmId]);
  if (!rows.length) return null;
  const cfg = rows[0];

  if (user.role === 'admin') return cfg;
  if (user.tenant_id == null) return null;                   // tenantless → deny

  // A VM belongs to a tenant via EITHER source of truth: vm_ssh_config.tenant_id
  // or the tenant_vm_assignments pool. These historically diverged — a VM could
  // be assigned to the pool (and shown to the user) while vm_ssh_config.tenant_id
  // stayed null, denying the terminal for a VM the user could plainly see. Accept
  // either so the console always agrees with the pool.
  let ownedByTenant = cfg.tenant_id === user.tenant_id;
  if (!ownedByTenant) {
    const { rows: assigned } = await pool.query(
      'SELECT 1 FROM tenant_vm_assignments WHERE tenant_id = $1 AND vm_id = $2',
      [user.tenant_id, vmId]
    );
    ownedByTenant = assigned.length > 0;
  }
  if (!ownedByTenant) return null;                           // not this tenant's VM → deny

  if (user.role === 'tenant_admin') return cfg;              // all tenant VMs
  if (user.role === 'tenant_user') {
    const { rows: a } = await pool.query(
      'SELECT 1 FROM user_vm_assignments WHERE user_id = $1 AND vm_id = $2', [user.id, vmId]
    );
    return a.length ? cfg : null;                            // only assigned VMs
  }
  return null;
}

function createTerminalServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/terminal' });

  wss.on('connection', (ws, req) => {
    let ssh        = null;
    let stream     = null;
    let idleTimer  = null;
    let connected  = false;

    const resetIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        ws.send('\r\n\x1b[33m[Session timed out after 10 minutes of inactivity]\x1b[0m\r\n');
        ws.close();
      }, IDLE_TIMEOUT_MS);
    };

    const cleanup = () => {
      clearTimeout(idleTimer);
      if (stream) { try { stream.close(); } catch {} }
      if (ssh)    { try { ssh.dispose(); } catch {} }
      ssh = null; stream = null;
    };

    ws.on('message', async (rawMsg) => {
      let msg;
      try { msg = JSON.parse(rawMsg.toString()); } catch {
        // Raw input — forward to SSH stream
        if (stream && connected) {
          resetIdle();
          stream.write(rawMsg.toString());
        }
        return;
      }

      // ── Connect message ──────────────────────────────────────────────────────
      if (msg.type === 'connect') {
        const { token: authToken, vm_id } = msg;

        // 1. Verify JWT
        let user;
        try {
          user = jwt.verify(authToken, process.env.JWT_ACCESS_SECRET);
        } catch {
          ws.send('\r\n\x1b[31m[Authentication failed]\x1b[0m\r\n');
          ws.close();
          return;
        }

        // 2. Role-based access check (admin=any, tenant_admin=tenant, tenant_user=assigned)
        const vmConfig = await resolveVmAccess(user, vm_id);
        if (!vmConfig) {
          ws.send('\r\n\x1b[31m[VM not found or access denied]\x1b[0m\r\n');
          ws.close();
          return;
        }

        // 3. Resolve the SSH private key — prefer the VM's own key.
        let privateKey;
        try {
          const vmKey = await VmKey.getActiveForVm(vm_id);
          if (vmKey) {
            privateKey = vmKey.privateKey;
          } else if (ALLOW_SHARED_KEY_FALLBACK) {
            privateKey = getSshPrivateKey();
            console.warn(`[terminal] vm=${vm_id} has no per-VM key — using shared key fallback`);
          } else {
            ws.send('\r\n\x1b[31m[No SSH key provisioned for this VM yet]\x1b[0m\r\n');
            ws.close();
            return;
          }
        } catch (err) {
          ws.send('\r\n\x1b[31m[Key error — contact support]\x1b[0m\r\n');
          console.error(`[terminal] key resolve failed vm=${vm_id}:`, err.message);
          ws.close();
          return;
        }

        console.log(`[terminal] open user=${user.id} role=${user.role} vm=${vm_id}`);
        ws.send(`\r\n\x1b[32m[Connecting to ${vmConfig.ip_address}...]\x1b[0m\r\n`);

        // 4. SSH connect
        ssh = new NodeSSH();
        try {
          await ssh.connect({
            host:       vmConfig.ip_address,
            port:       vmConfig.ssh_port || 22,
            username:   vmConfig.ssh_user || 'root',
            privateKey,
          });
        } catch (err) {
          ws.send(`\r\n\x1b[31m[SSH connection failed: ${err.message}]\x1b[0m\r\n`);
          ws.close();
          return;
        }

        // 4. Request PTY shell
        const { cols = 200, rows: termRows = 50 } = msg;
        ssh.connection.shell({ term: 'xterm-256color', cols, rows: termRows }, (err, s) => {
          if (err) {
            ws.send(`\r\n\x1b[31m[Shell error: ${err.message}]\x1b[0m\r\n`);
            ws.close();
            return;
          }

          stream = s;
          connected = true;
          resetIdle();

          ws.send(`\x1b[32m[Connected to ${vmConfig.ip_address}]\x1b[0m\r\n`);

          // SSH output → browser
          stream.on('data', (data) => {
            if (ws.readyState === ws.OPEN) ws.send(data.toString('utf8'));
          });

          stream.stderr.on('data', (data) => {
            if (ws.readyState === ws.OPEN) ws.send(data.toString('utf8'));
          });

          stream.on('close', () => {
            if (ws.readyState === ws.OPEN) {
              ws.send('\r\n\x1b[33m[Connection closed]\x1b[0m\r\n');
              ws.close();
            }
            cleanup();
          });
        });

        return;
      }

      // ── Resize message ───────────────────────────────────────────────────────
      if (msg.type === 'resize' && stream) {
        try { stream.setWindow(msg.rows, msg.cols, 0, 0); } catch {}
        return;
      }

      // ── Input message ────────────────────────────────────────────────────────
      if (msg.type === 'input' && stream && connected) {
        resetIdle();
        stream.write(msg.data);
      }
    });

    ws.on('close', cleanup);
    ws.on('error', cleanup);
  });

  console.log('[terminal] WebSocket server ready at /ws/terminal');
  return wss;
}

module.exports = { createTerminalServer };
