'use strict';

require('dotenv').config();
const { validateEnv, pool, flags } = require('@rach/core');
validateEnv();

const app = require('./app');
const alertMonitor = require('./services/alertMonitor');
const endpointProber = require('./services/endpointProber');
const statusProber = require('./services/statusProber');
const backupWorker = require('./services/backupWorker');
const keyRotation = require('./services/keyRotation');
const keyCrypto = require('./services/keyCrypto');
const siteOutboxWorker = require('./services/siteOutboxWorker');
const siteStatusWorker = require('./services/siteStatusWorker');
const siteInventoryReconcile = require('./services/siteInventoryReconcile');
const { createTerminalServer } = require('./services/terminalServer');
const realtimeServer = require('./services/realtimeServer');

let stopBackups = null;
let stopSiteOutbox = null;
let stopSiteStatus = null;
let stopSiteAppStatus = null;
let stopSiteInventory = null;

const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, () => {
  console.log(`rachbase-backend listening on :${PORT}`);
  alertMonitor.start();
  endpointProber.start();
  statusProber.start(); // public status page probes (control plane, DB, deploy, regions)
  stopBackups = backupWorker.start(); // daily BaaS logical backups + retention prune

  // ONE shared 'upgrade' router for both WebSocket features. Attaching two path-scoped WSS
  // to the same HTTP server breaks BOTH in ws@8 (each tries to handle every upgrade: realtime
  // handshakes were 400'd by the terminal's WSS, and the terminal's accepted sockets were
  // then corrupted by realtime's 400 — realtime audit finding #1, reproduced empirically).
  const terminalWss = createTerminalServer();
  const realtimeWss = realtimeServer.attach(); // BaaS realtime WS (changes + broadcast + presence)
  server.on('upgrade', (req, socket, head) => {
    const path = (req.url || '').split('?')[0];
    const wss = path === '/ws/terminal' ? terminalWss : path === '/realtime/v1' ? realtimeWss : null;
    if (!wss) { socket.write('HTTP/1.1 404 Not Found\r\n\r\n'); return socket.destroy(); }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });
  // Per-VM SSH key rotation. Auto-starts with the app (no manual cron) and is
  // multi-instance safe via a Postgres advisory lock — only one instance rotates
  // at a time. A VM's 2-day clock begins at activation, so rotation kicks in
  // automatically once a VM is provisioned to a tenant.
  if (keyCrypto.isConfigured()) keyRotation.start();
  else console.warn('[keyRotation] disabled — RACHBASE_KEY_ENC_SECRET not set');

  // SpaceArk site pipeline: outbox delivery + site→product status poll. Only run
  // when the Pro tier is enabled; both no-op cheaply when nothing is in flight.
  if (flags.isEnabled('pro_tier')) {
    stopSiteOutbox = siteOutboxWorker.startWorker();
    stopSiteStatus = siteStatusWorker.startStatusWorker();
    stopSiteAppStatus = siteStatusWorker.startAppStatusReconcile();
    stopSiteInventory = siteInventoryReconcile.startInventoryReconcile();
    console.log('[site] outbox + status + app-drift + inventory workers started (pro_tier)');
  }
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} received, shutting down...`);
  server.close((err) => { if (err) console.error('Error closing HTTP server:', err); });
  const force = setTimeout(() => { console.error('Forcing shutdown after 10s.'); process.exit(1); }, 10_000).unref();
  try {
    alertMonitor.stop();
    endpointProber.stop();
    statusProber.stop();
    if (stopBackups) stopBackups();
    keyRotation.stop();
    if (stopSiteOutbox) stopSiteOutbox();
    if (stopSiteStatus) stopSiteStatus();
    if (stopSiteAppStatus) stopSiteAppStatus();
    if (stopSiteInventory) stopSiteInventory();
    realtimeServer.shutdown(); // close realtime sockets + LISTEN clients (audit #7)
    await pool.end();
    clearTimeout(force);
    process.exit(0);
  } catch (err) {
    console.error('Error closing DB pool:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => { console.error('uncaughtException:', err); shutdown('uncaughtException'); });
process.on('unhandledRejection', (reason) => { console.error('unhandledRejection:', reason); shutdown('unhandledRejection'); });
