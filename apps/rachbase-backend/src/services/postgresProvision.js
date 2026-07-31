'use strict';

/**
 * Runtime Postgres provisioning — NATIVE (apt + systemd), no Docker.
 *
 * On the tenant's already-provisioned VM (Debian/Ubuntu), over SSH:
 *   1. install the requested Postgres major version from the official PGDG repo
 *      (idempotent — skipped if already present),
 *   2. enable remote access (listen_addresses='*', scram-sha-256 in pg_hba),
 *   3. create a database + login role for this service, with a generated password.
 *
 * Multiple "postgres" services on one VM share the installed cluster: each is a
 * separate database + role. Different requested versions install side-by-side as
 * separate clusters (PGDG assigns each its own port), which the script detects.
 *
 * Requirements on the VM: Debian/Ubuntu, the SSH user has sudo, outbound internet
 * for the one-time install. Connection details (host = VM IP, detected port, db,
 * user, generated password) are stored on the service's config for the dashboard.
 * NOTE: pg_hba opens to 0.0.0.0/0 with password auth — the VM firewall should
 * restrict inbound 5432/5433 to trusted sources.
 */

const crypto = require('crypto');
const { pool } = require('@rach/core');
const { NodeSSH } = require('node-ssh');
const { getSshPrivateKey } = require('@rach/deploy');
const { VmKey } = require('../models/vmKey');

async function setStatus(id, status, extraConfig) {
  if (extraConfig) {
    await pool.query(
      `UPDATE deployment_services
         SET status = $1, config = COALESCE(config, '{}'::jsonb) || $2::jsonb, updated_at = NOW()
       WHERE id = $3`,
      [status, JSON.stringify(extraConfig), id]
    );
  } else {
    await pool.query('UPDATE deployment_services SET status = $1, updated_at = NOW() WHERE id = $2', [status, id]);
  }
}

/** Build the native provisioning bash script. Values are pre-validated (safe). */
function buildScript({ version, dbName, password }) {
  return [
    // Injected, validated values.
    `VER='${version}'`,
    `DB='${dbName}'`,
    `DBUSER='${dbName}'`,
    `PW='${password}'`,
    // ── Static bash (single-quoted JS strings — no JS interpolation) ──────────
    'set -e',
    'export DEBIAN_FRONTEND=noninteractive',
    // 1. Install requested version from PGDG if missing.
    'if ! dpkg -s postgresql-$VER >/dev/null 2>&1; then',
    '  sudo apt-get install -y curl ca-certificates gnupg lsb-release >/dev/null',
    '  sudo install -d /usr/share/postgresql-common/pgdg',
    '  sudo curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc',
    '  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list >/dev/null',
    '  sudo apt-get update -y >/dev/null',
    '  sudo apt-get install -y postgresql-$VER >/dev/null',
    'fi',
    // 2. Detect this version main cluster port.
    'PORT=$(pg_lsclusters --no-header 2>/dev/null | awk -v v="$VER" \'$1==v && $2=="main"{print $3; exit}\')',
    'PORT=${PORT:-5432}',
    'CONFDIR=/etc/postgresql/$VER/main',
    // 3. Remote access + scram (idempotent).
    'sudo sed -i "s/^#\\?listen_addresses.*/listen_addresses = \'*\'/" $CONFDIR/postgresql.conf',
    'sudo sed -i "s/^#\\?password_encryption.*/password_encryption = scram-sha-256/" $CONFDIR/postgresql.conf',
    'grep -qs "0.0.0.0/0" $CONFDIR/pg_hba.conf || echo "host all all 0.0.0.0/0 scram-sha-256" | sudo tee -a $CONFDIR/pg_hba.conf >/dev/null',
    'sudo systemctl enable postgresql >/dev/null 2>&1 || true',
    'sudo systemctl restart postgresql',
    // 4. Role + database (idempotent).
    'if ! sudo -u postgres psql -p $PORT -tAc "SELECT 1 FROM pg_roles WHERE rolname=\'$DBUSER\'" | grep -q 1; then',
    '  sudo -u postgres psql -p $PORT -c "CREATE ROLE \\"$DBUSER\\" LOGIN PASSWORD \'$PW\'"',
    'else',
    '  sudo -u postgres psql -p $PORT -c "ALTER ROLE \\"$DBUSER\\" WITH LOGIN PASSWORD \'$PW\'"',
    'fi',
    'if ! sudo -u postgres psql -p $PORT -tAc "SELECT 1 FROM pg_database WHERE datname=\'$DB\'" | grep -q 1; then',
    '  sudo -u postgres psql -p $PORT -c "CREATE DATABASE \\"$DB\\" OWNER \\"$DBUSER\\""',
    'fi',
    'echo "RB_PORT=$PORT"',
  ].join('\n');
}

/**
 * Provision Postgres for a `deployment_services` row (source_type = 'postgres').
 * Fire-and-forget from the caller; updates status/config as it goes.
 */
async function provisionPostgres(service) {
  await setStatus(service.id, 'deploying');

  const { rows } = await pool.query(
    'SELECT ip_address, ssh_user, ssh_port FROM vm_ssh_config WHERE vm_id = $1 AND tenant_id = $2',
    [service.vm_id, service.tenant_id]
  );
  if (!rows.length) {
    await setStatus(service.id, 'failed', { error: 'No SSH config for VM' });
    return;
  }
  const cfg = rows[0];

  const version  = String(service.config?.version || '16');
  const dbName   = String(service.name || 'app');
  const password = crypto.randomBytes(12).toString('hex');
  const script   = buildScript({ version, dbName, password });

  const vmKey = await VmKey.getActiveForVm(service.vm_id);
  const privateKey = vmKey ? vmKey.privateKey : getSshPrivateKey();

  const ssh = new NodeSSH();
  try {
    await ssh.connect({
      host: cfg.ip_address, port: cfg.ssh_port || 22,
      username: cfg.ssh_user || 'ubuntu', privateKey, readyTimeout: 15000,
    });
    const r = await ssh.execCommand(script);
    if (r.code === 0) {
      const m = /RB_PORT=(\d+)/.exec(r.stdout || '');
      const detectedPort = m ? Number(m[1]) : 5432;
      await setStatus(service.id, 'deployed', {
        engine: 'native', host: cfg.ip_address, port: detectedPort,
        db: dbName, user: dbName, password, provisioned_at: new Date().toISOString(),
      });
    } else {
      await setStatus(service.id, 'failed', { error: (r.stderr || 'provision failed').slice(0, 500) });
    }
  } catch (err) {
    await setStatus(service.id, 'failed', { error: err.message.slice(0, 500) });
  } finally {
    try { ssh.dispose(); } catch { /* noop */ }
  }
}

module.exports = { provisionPostgres };
