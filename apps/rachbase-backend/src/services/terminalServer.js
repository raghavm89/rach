'use strict';

const { WebSocketServer } = require('ws');
const { NodeSSH }         = require('node-ssh');
const jwt                 = require('jsonwebtoken');
const pool                = require('@rach/core').pool;

const { getSshPrivateKey } = require('@rach/deploy');
const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

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

        // 2. Look up VM SSH config — must belong to this tenant
        const { rows } = await pool.query(
          `SELECT v.* FROM vm_ssh_config v
           WHERE v.vm_id = $1 AND v.tenant_id = $2`,
          [vm_id, user.tenant_id]
        );

        if (!rows.length) {
          ws.send('\r\n\x1b[31m[VM not found or access denied]\x1b[0m\r\n');
          ws.close();
          return;
        }

        const vmConfig = rows[0];
        ws.send(`\r\n\x1b[32m[Connecting to ${vmConfig.ip_address}...]\x1b[0m\r\n`);

        // 3. SSH connect
        ssh = new NodeSSH();
        try {
          await ssh.connect({
            host:       vmConfig.ip_address,
            port:       vmConfig.ssh_port || 22,
            username:   vmConfig.ssh_user || 'root',
            privateKey: getSshPrivateKey(),
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
