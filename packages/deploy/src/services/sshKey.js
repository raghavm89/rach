'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

/**
 * Resolves the SSH private key for VM access.
 *
 * Priority:
 * 1. DEPLOY_SSH_KEY_PATH env var (explicit file path)
 * 2. Default key file at ~/.ssh/rachdev_deploy
 * 3. DEPLOY_SSH_PRIVATE_KEY env var (string, with \n unescaping)
 */
function getSshPrivateKey() {
  // 1. Explicit path
  const keyPath = process.env.DEPLOY_SSH_KEY_PATH;
  if (keyPath) {
    try {
      return fs.readFileSync(path.resolve(keyPath), 'utf8');
    } catch (err) {
      console.warn(`[sshKey] Could not read DEPLOY_SSH_KEY_PATH (${keyPath}):`, err.message);
    }
  }

  // 2. Default local file
  const defaultPath = path.join(os.homedir(), '.ssh', 'rachdev_deploy');
  if (fs.existsSync(defaultPath)) {
    try {
      return fs.readFileSync(defaultPath, 'utf8');
    } catch (err) {
      console.warn('[sshKey] Could not read ~/.ssh/rachdev_deploy:', err.message);
    }
  }

  // 3. Env var string fallback (Railway / production)
  const envKey = (process.env.DEPLOY_SSH_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (envKey) return envKey;

  console.error('[sshKey] No SSH private key found. Set DEPLOY_SSH_KEY_PATH or DEPLOY_SSH_PRIVATE_KEY.');
  return null;
}

module.exports = { getSshPrivateKey };
