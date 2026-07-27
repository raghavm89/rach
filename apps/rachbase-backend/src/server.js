'use strict';

require('dotenv').config();
const { validateEnv, pool } = require('@rach/core');
validateEnv();

const app = require('./app');
const alertMonitor = require('./services/alertMonitor');
const endpointProber = require('./services/endpointProber');
const keyRotation = require('./services/keyRotation');
const keyCrypto = require('./services/keyCrypto');
const { createTerminalServer } = require('./services/terminalServer');

const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, () => {
  console.log(`rachbase-backend listening on :${PORT}`);
  alertMonitor.start();
  endpointProber.start();
  createTerminalServer(server);
  // Per-VM SSH key rotation. Auto-starts with the app (no manual cron) and is
  // multi-instance safe via a Postgres advisory lock — only one instance rotates
  // at a time. A VM's 2-day clock begins at activation, so rotation kicks in
  // automatically once a VM is provisioned to a tenant.
  if (keyCrypto.isConfigured()) keyRotation.start();
  else console.warn('[keyRotation] disabled — RACHBASE_KEY_ENC_SECRET not set');
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
    keyRotation.stop();
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
