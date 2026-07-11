'use strict';

require('dotenv').config();
const { validateEnv, pool } = require('@rach/core');
validateEnv();

const app = require('./app');
const alertMonitor = require('./services/alertMonitor');
const { createTerminalServer } = require('./services/terminalServer');

const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, () => {
  console.log(`rachbase-backend listening on :${PORT}`);
  alertMonitor.start();
  createTerminalServer(server);
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
