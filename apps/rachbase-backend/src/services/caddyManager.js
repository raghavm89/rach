'use strict';

/**
 * Caddy reverse-proxy management on the VM (PaaS phase 3), over SSH.
 *
 * Caddy fronts all web services on a VM: it terminates TLS (Let's Encrypt,
 * HTTP-01) and routes each hostname to the service's local port. Rachbase owns a
 * per-(service,domain) snippet in /etc/caddy/rachbase.d/, imported by the main
 * Caddyfile. Adding/removing a domain writes/removes a snippet and reloads Caddy.
 *
 * Caddy is installed if missing (official apt repo). Requires the SSH user to
 * have sudo and the VM to have outbound internet + ports 80/443 reachable for
 * ACME. Uses the VM's per-VM key (falling back to the shared key).
 */

const { NodeSSH } = require('node-ssh');
const { pool } = require('@rach/core');
const { getSshPrivateKey } = require('@rach/deploy');
const { VmKey } = require('../models/vmKey');

async function sshForVm(vmId, tenantId) {
  const { rows } = await pool.query(
    'SELECT ip_address, ssh_user, ssh_port FROM vm_ssh_config WHERE vm_id = $1 AND tenant_id = $2',
    [vmId, tenantId]
  );
  if (!rows.length) throw new Error('No SSH config for VM');
  const cfg = rows[0];
  const vk = await VmKey.getActiveForVm(vmId);
  const privateKey = vk ? vk.privateKey : getSshPrivateKey();
  const ssh = new NodeSSH();
  await ssh.connect({
    host: cfg.ip_address, port: cfg.ssh_port || 22,
    username: cfg.ssh_user || 'rachops', privateKey, readyTimeout: 15000,
  });
  return ssh;
}

const ENSURE_CADDY = [
  'set -e',
  'export DEBIAN_FRONTEND=noninteractive',
  'if ! command -v caddy >/dev/null 2>&1; then',
  '  sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg >/dev/null',
  '  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg',
  '  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null',
  '  sudo apt-get update -y >/dev/null && sudo apt-get install -y caddy >/dev/null',
  'fi',
  'sudo mkdir -p /etc/caddy/rachbase.d',
  "grep -qs 'rachbase.d' /etc/caddy/Caddyfile 2>/dev/null || echo 'import /etc/caddy/rachbase.d/*.caddy' | sudo tee -a /etc/caddy/Caddyfile >/dev/null",
  'sudo systemctl enable caddy >/dev/null 2>&1 || true',
  'sudo systemctl start caddy >/dev/null 2>&1 || true',
].join('\n');

/** Write/replace a site snippet routing `hostname` → 127.0.0.1:`port`, and reload. */
async function applyDomain({ vmId, tenantId, file, hostname, port }) {
  const ssh = await sshForVm(vmId, tenantId);
  try {
    const path = `/etc/caddy/rachbase.d/${file}.caddy`;
    const snippet = `${hostname} {\n\treverse_proxy 127.0.0.1:${Number(port) || 3000}\n}\n`;
    const script = [
      ENSURE_CADDY,
      `sudo tee ${path} >/dev/null <<'RBCADDY'\n${snippet}RBCADDY`,
      'sudo systemctl reload caddy',
    ].join('\n');
    const r = await ssh.execCommand(script);
    if (r.code !== 0 && r.code !== null) throw new Error((r.stderr || 'caddy apply failed').slice(0, 400));
  } finally {
    try { ssh.dispose(); } catch { /* noop */ }
  }
}

/** Remove a site snippet and reload. */
async function removeDomain({ vmId, tenantId, file }) {
  const ssh = await sshForVm(vmId, tenantId);
  try {
    await ssh.execCommand(`sudo rm -f /etc/caddy/rachbase.d/${file}.caddy; sudo systemctl reload caddy 2>/dev/null || true`);
  } finally {
    try { ssh.dispose(); } catch { /* noop */ }
  }
}

module.exports = { applyDomain, removeDomain };
