'use strict';

/**
 * @rach/deploy — deploy engine (git-over-SSH) + GitHub App, shared by both apps.
 *
 * RachBase calls this in-process; RachDev calls it via the RachBase API. The
 * engine code is the shared unit — the transport is per-app.
 *
 *   const { runDeploy, getSshPrivateKey, getInstallationToken } = require('@rach/deploy');
 *
 * Depends on @rach/core for the db pool.
 */

const { runDeploy }           = require('./src/services/deployRunner');
const { getSshPrivateKey }    = require('./src/services/sshKey');
const { getInstallationToken } = require('./src/services/githubApp');

module.exports = {
  runDeploy,
  getSshPrivateKey,
  getInstallationToken,
};
