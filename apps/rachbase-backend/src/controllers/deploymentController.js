'use strict';

const pool        = require('@rach/core').pool;
const crypto      = require('crypto');
const { NodeSSH } = require('node-ssh');
const { runDeploy, getSshPrivateKey } = require('@rach/deploy');
const { vmBelongsToTenant } = require('../lib/tenantVms');
const { provisionPostgres } = require('../services/postgresProvision');
const caddy = require('../services/caddyManager');
const godaddy = require('../services/godaddy');
const { VmKey } = require('../models/vmKey');
const keyCrypto = require('../services/keyCrypto');
const { hasLogsForVm } = require('../lib/entitlements');

// VM Logs is a paid, admin-assigned per-VM add-on. Admins (no tenant) bypass.
async function ensureLogsEntitlement(req, vmId) {
  if (!req.user.tenant_id) return null;
  const ok = await hasLogsForVm(req.user.tenant_id, vmId);
  if (ok) return null;
  return { status: 402, body: { error: 'VM Logs is a paid add-on. Purchase it, then have an admin enable it for this VM.', feature: 'logs' } };
}

const APP_URL     = (process.env.APP_URL     || 'http://localhost:3001').replace(/\/$/, '');
const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');

const GITHUB_APP_NAME       = process.env.GITHUB_APP_NAME       || '';
const GITHUB_APP_ID         = process.env.GITHUB_APP_ID         || '';
const GITHUB_APP_PRIVATE_KEY= (process.env.GITHUB_APP_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const GITHUB_CLIENT_ID      = process.env.GITHUB_APP_CLIENT_ID  || process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET  = process.env.GITHUB_APP_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET || '';
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_APP_WEBHOOK_SECRET || '';

// ── JWT for GitHub App auth ───────────────────────────────────────────────────

function buildAppJwt() {
  if (!GITHUB_APP_ID || !GITHUB_APP_PRIVATE_KEY) {
    throw new Error('GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY is not configured');
  }
  const now     = Math.floor(Date.now() / 1000);
  const payload = { iat: now - 60, exp: now + 540, iss: GITHUB_APP_ID };

  // Manual JWT signing (RS256) without extra deps
  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const body    = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig     = crypto.createSign('RSA-SHA256').update(`${header}.${body}`).sign(GITHUB_APP_PRIVATE_KEY, 'base64url');
  return `${header}.${body}.${sig}`;
}

async function getInstallationToken(installationId) {
  const appJwt = buildAppJwt();
  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'RachDev',
      },
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to get installation token');
  }
  const data = await res.json();
  return data.token;
}

// ── Monorepo path filtering ───────────────────────────────────────────────────
// A push should only redeploy a service whose watched folders actually changed.
// Watch prefixes come from config.watch_paths (if set) else [root_dir]; an empty
// prefix means "whole repo". Fail-open: if no changed paths are known, deploy.

function normPrefix(p) { return String(p || '').replace(/^\/+|\/+$/g, ''); }

function serviceAffectedByPush(config, changedSet) {
  if (!changedSet || changedSet.size === 0) return true; // fail-open

  const cfg = (config && typeof config === 'object') ? config : {};
  let prefixes = Array.isArray(cfg.watch_paths) && cfg.watch_paths.length
    ? cfg.watch_paths.map(normPrefix)
    : [normPrefix(cfg.root_dir)];
  // De-dupe; an empty prefix watches the whole repo.
  prefixes = [...new Set(prefixes)];
  if (prefixes.includes('')) return true;

  for (const path of changedSet) {
    for (const pre of prefixes) {
      if (path === pre || path.startsWith(pre + '/')) return true;
    }
  }
  return false;
}

// Pick the next free port for a service on a given VM, starting at 3000, so two
// co-located services never bind the same port.
async function nextFreePort(tenantId, vmId, start = 3000, end = 3999) {
  const { rows } = await pool.query(
    `SELECT config FROM deployment_services WHERE tenant_id = $1 AND vm_id = $2`,
    [tenantId, vmId]
  );
  const used = new Set(
    rows.map((r) => Number(r.config && r.config.port)).filter((n) => n >= 1 && n <= 65535)
  );
  for (let p = start; p <= end; p++) if (!used.has(p)) return p;
  return start;
}

// ── Step 1: Redirect to GitHub App install page ───────────────────────────────

// In-memory pending installs: state → { tenant_id, user_id, expires }
const pendingInstalls = new Map();

exports.redirectToInstall = (req, res) => {
  if (!GITHUB_APP_NAME) {
    return res.status(500).json({ error: 'GITHUB_APP_NAME is not configured' });
  }

  const state = Buffer.from(JSON.stringify({
    tenant_id: req.user.tenant_id,
    user_id:   req.user.id,
  })).toString('base64url');

  // Store pending so webhook can resolve tenant_id
  pendingInstalls.set(state, {
    tenant_id: req.user.tenant_id,
    user_id:   req.user.id,
    expires:   Date.now() + 10 * 60 * 1000, // 10 min TTL
  });

  const installUrl = `https://github.com/apps/${GITHUB_APP_NAME}/installations/new?state=${state}`;
  res.json({ install_url: installUrl, state });
};

// ── Step 2: GitHub callback after installation ────────────────────────────────

exports.handleInstallCallback = async (req, res) => {
  console.log('[deployment/callback] query params:', req.query);

  const { installation_id, state, setup_action, code } = req.query;

  // If OAuth flow was triggered, GitHub sends a `code` instead of installation_id
  if (code && !installation_id) {
    console.log('[deployment/callback] OAuth code received — installation_id missing. Disable "Request user authorization" in GitHub App settings.');
    return res.redirect(`${APP_URL}/dashboard/deployment?github_error=oauth_instead_of_install`);
  }

  if (!installation_id) {
    console.log('[deployment/callback] No installation_id in query:', req.query);
    return res.redirect(`${APP_URL}/dashboard/deployment?github_error=no_installation`);
  }

  let tenantId, userId;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
    tenantId = decoded.tenant_id;
    userId   = decoded.user_id;
  } catch {
    return res.redirect(`${APP_URL}/dashboard/deployment?github_error=invalid_state`);
  }

  // Prefer the server-side pending entry created during redirectToInstall — it's
  // the authenticated source of truth and prevents a forged state from attaching
  // an installation to another tenant. Fall back to the decoded state only if the
  // entry is gone (e.g. backend restarted), which is best-effort.
  const pending = pendingInstalls.get(state);
  if (pending) {
    tenantId = pending.tenant_id;
    userId   = pending.user_id;
    pendingInstalls.delete(state);
  }
  if (!tenantId) {
    return res.redirect(`${APP_URL}/dashboard/deployment?github_error=invalid_state`);
  }

  try {
    // Fetch installation details from GitHub
    const appJwt = buildAppJwt();
    const instRes = await fetch(`https://api.github.com/app/installations/${installation_id}`, {
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'RachDev',
      },
    });
    const instData = instRes.ok ? await instRes.json() : {};
    const githubAccount = instData.account?.login || null;

    await pool.query(
      `INSERT INTO deployment_github_installations (tenant_id, installation_id, github_account, installed_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id) DO UPDATE
         SET installation_id = EXCLUDED.installation_id,
             github_account  = EXCLUDED.github_account,
             installed_by    = EXCLUDED.installed_by,
             installed_at    = NOW()`,
      [tenantId, installation_id, githubAccount, userId]
    );

    res.redirect(`${APP_URL}/dashboard/deployment?github_connected=1`);
  } catch (err) {
    console.error('[deployment/callback]', err.message);
    res.redirect(`${APP_URL}/dashboard/deployment?github_error=${encodeURIComponent(err.message)}`);
  }
};

// ── POST /api/deployment/github/reconcile ────────────────────────────────────
// Fallback for when GitHub's post-install redirect never reaches the callback
// (e.g. the App's Setup URL isn't configured). Pulls installations straight from
// GitHub's API and links one to this tenant.

exports.reconcileGithub = async (req, res) => {
  const tenantId = req.user.tenant_id;
  const userId   = req.user.id;

  // Already linked — nothing to do.
  const existing = await pool.query(
    'SELECT installation_id, github_account FROM deployment_github_installations WHERE tenant_id = $1',
    [tenantId]
  );
  if (existing.rows.length) {
    return res.json({ connected: true, reconciled: false, ...existing.rows[0] });
  }

  // Ask GitHub which installations exist for this App.
  let installs;
  try {
    const appJwt = buildAppJwt();
    const r = await fetch('https://api.github.com/app/installations?per_page=100', {
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'RachDev',
      },
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      return res.status(502).json({ error: `GitHub ${r.status}: ${txt.slice(0, 150)}` });
    }
    installs = await r.json();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  if (!Array.isArray(installs) || installs.length === 0) {
    return res.json({ connected: false, reason: 'no_installations' });
  }

  // Only auto-link when it's unambiguous: exactly one installation, or there is a
  // pending install for THIS tenant (then take the most recently created one).
  const hasPending = [...pendingInstalls.values()].some(
    (p) => p.tenant_id === tenantId && p.expires > Date.now()
  );

  let chosen = null;
  if (installs.length === 1) {
    chosen = installs[0];
  } else if (hasPending) {
    chosen = installs
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  }

  if (!chosen) {
    return res.json({
      connected: false,
      reason: 'ambiguous',
      accounts: installs.map((i) => i.account?.login).filter(Boolean),
    });
  }

  // Consume any pending entries for this tenant.
  for (const [state, p] of pendingInstalls.entries()) {
    if (p.tenant_id === tenantId) pendingInstalls.delete(state);
  }

  await pool.query(
    `INSERT INTO deployment_github_installations (tenant_id, installation_id, github_account, installed_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tenant_id) DO UPDATE
       SET installation_id = EXCLUDED.installation_id,
           github_account  = EXCLUDED.github_account,
           installed_by    = EXCLUDED.installed_by,
           installed_at    = NOW()`,
    [tenantId, chosen.id, chosen.account?.login || null, userId]
  );

  console.log(`[reconcile] Linked installation ${chosen.id} (${chosen.account?.login}) to tenant ${tenantId}`);
  res.json({ connected: true, reconciled: true, installation_id: chosen.id, github_account: chosen.account?.login || null });
};

// ── GET /api/deployment/github/status ────────────────────────────────────────

exports.getGithubStatus = async (req, res) => {
  const { rows } = await pool.query(
    'SELECT installation_id, github_account, installed_at FROM deployment_github_installations WHERE tenant_id = $1',
    [req.user.tenant_id]
  );
  if (!rows.length) return res.json({ connected: false });
  res.json({ connected: true, ...rows[0] });
};

// ── GET /api/deployment/github/repos ─────────────────────────────────────────

exports.listRepos = async (req, res) => {
  const { rows } = await pool.query(
    'SELECT installation_id FROM deployment_github_installations WHERE tenant_id = $1',
    [req.user.tenant_id]
  );
  if (!rows.length) return res.status(400).json({ error: 'GitHub not connected' });

  const token = await getInstallationToken(rows[0].installation_id);

  let repos = [];
  let page  = 1;
  while (true) {
    const r = await fetch(
      `https://api.github.com/installation/repositories?per_page=100&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'RachDev',
        },
      }
    );
    if (!r.ok) break;
    const data = await r.json();
    repos = repos.concat(data.repositories || []);
    if (!data.repositories || data.repositories.length < 100) break;
    page++;
  }

  res.json({
    repos: repos.map((r) => ({
      id:            r.id,
      full_name:     r.full_name,
      name:          r.name,
      private:       r.private,
      default_branch:r.default_branch,
      updated_at:    r.updated_at,
    })),
  });
};

// ── GET /api/deployment/github/branches?repo=org/repo ────────────────────────

exports.listBranches = async (req, res) => {
  const { repo } = req.query;
  if (!repo) return res.status(400).json({ error: 'repo param required' });

  const { rows } = await pool.query(
    'SELECT installation_id FROM deployment_github_installations WHERE tenant_id = $1',
    [req.user.tenant_id]
  );
  if (!rows.length) return res.status(400).json({ error: 'GitHub not connected' });

  const token = await getInstallationToken(rows[0].installation_id);

  const r = await fetch(
    `https://api.github.com/repos/${repo}/branches?per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'RachDev',
      },
    }
  );
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    return res.status(r.status).json({ error: err.message || 'Failed to fetch branches' });
  }
  const data = await r.json();
  res.json({ branches: data.map((b) => b.name) });
};

// ── POST /api/deployment/services ────────────────────────────────────────────

exports.createService = async (req, res) => {
  const { vm_id, source_type = 'github', repo_full_name, branch, name, config } = req.body;
  if (!vm_id) return res.status(400).json({ error: 'vm_id is required' });

  // Cross-tenant guard: the VM must belong to the caller's tenant (audit T1).
  if (!(await vmBelongsToTenant(req.user.tenant_id, vm_id))) {
    return res.status(403).json({ error: 'VM is not assigned to your tenant' });
  }

  // ── GitHub repo service ─────────────────────────────────────────────────────
  if (source_type === 'github') {
    if (!repo_full_name || !branch) {
      return res.status(400).json({ error: 'repo_full_name and branch are required' });
    }
    const { rows: inst } = await pool.query(
      'SELECT installation_id FROM deployment_github_installations WHERE tenant_id = $1',
      [req.user.tenant_id]
    );
    if (!inst.length) return res.status(400).json({ error: 'GitHub not connected' });

    const [repoName] = repo_full_name.split('/').slice(-1);

    // Build the service config. root_dir lets several services share one repo
    // (monorepo); the port must be unique per VM so co-located services don't
    // collide — auto-assign the next free one when the caller doesn't pick.
    const rootDir = String(config?.root_dir || '').replace(/^\/+|\/+$/g, '');

    // Reject an exact duplicate: same VM + repo + branch + root directory. (A
    // different root_dir on the same repo/branch is fine — that's a monorepo.)
    const { rows: existing } = await pool.query(
      `SELECT id, config FROM deployment_services
       WHERE tenant_id = $1 AND vm_id = $2 AND source_type = 'github'
         AND repo_full_name = $3 AND branch = $4`,
      [req.user.tenant_id, vm_id, repo_full_name, branch]
    );
    const dup = existing.find((s) => String(s.config?.root_dir || '').replace(/^\/+|\/+$/g, '') === rootDir);
    if (dup) {
      return res.status(409).json({
        error: rootDir
          ? `A service for ${repo_full_name}@${branch} (/${rootDir}) already exists on this VM.`
          : `A service for ${repo_full_name}@${branch} already exists on this VM.`,
        existing_service_id: dup.id,
      });
    }

    const svcConfig = { root_dir: rootDir };
    if (config?.install_cmd) svcConfig.install_cmd = String(config.install_cmd);
    if (config?.build_cmd)   svcConfig.build_cmd   = String(config.build_cmd);
    if (config?.start_cmd)   svcConfig.start_cmd   = String(config.start_cmd);
    if (Array.isArray(config?.watch_paths)) {
      svcConfig.watch_paths = config.watch_paths.map((p) => String(p).replace(/^\/+|\/+$/g, '')).filter(Boolean);
    }
    const requested = Number(config?.port);
    svcConfig.port = (requested >= 1 && requested <= 65535)
      ? requested
      : await nextFreePort(req.user.tenant_id, vm_id);

    const { rows } = await pool.query(
      `INSERT INTO deployment_services
         (tenant_id, vm_id, source_type, installation_id, repo_full_name, branch, name, config, created_by, status)
       VALUES ($1, $2, 'github', $3, $4, $5, $6, $7::jsonb, $8, 'connected')
       RETURNING *`,
      [req.user.tenant_id, vm_id, inst[0].installation_id, repo_full_name, branch, name || repoName, JSON.stringify(svcConfig), req.user.id]
    );
    return res.status(201).json({ service: rows[0] });
  }

  // ── Postgres database service ───────────────────────────────────────────────
  if (source_type === 'postgres') {
    const dbName = String(name || 'app').trim();
    if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(dbName)) {
      return res.status(400).json({ error: 'Invalid database name (letters, digits, underscore)' });
    }
    const version = String(config?.version || '16');
    if (!/^\d{1,2}(\.\d{1,2})?$/.test(version)) {
      return res.status(400).json({ error: 'Invalid Postgres version' });
    }
    const { rows } = await pool.query(
      `INSERT INTO deployment_services
         (tenant_id, vm_id, source_type, name, config, created_by, status)
       VALUES ($1, $2, 'postgres', $3, $4::jsonb, $5, 'connected')
       RETURNING *`,
      [req.user.tenant_id, vm_id, dbName, JSON.stringify({ version }), req.user.id]
    );
    return res.status(201).json({ service: rows[0] });
  }

  return res.status(400).json({ error: `Unsupported source_type: ${source_type}` });
};

// ── GET /api/deployment/services ─────────────────────────────────────────────

exports.listServices = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM deployment_services WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [req.user.tenant_id]
  );
  res.json({ services: rows });
};

// ── GET /api/deployment/services/:id/logs ─────────────────────────────────────

exports.getDeployLogs = async (req, res) => {
  const svc = await serviceForTenant(req.params.id, req.user.tenant_id);
  if (!svc) return res.status(404).json({ error: 'Service not found' });
  const gate = await ensureLogsEntitlement(req, svc.vm_id);
  if (gate) return res.status(gate.status).json(gate.body);

  const { rows } = await pool.query(
    `SELECT l.* FROM deployment_logs l
     JOIN deployment_services s ON s.id = l.service_id
     WHERE l.service_id = $1 AND s.tenant_id = $2
     ORDER BY l.started_at DESC LIMIT 10`,
    [req.params.id, req.user.tenant_id]
  );
  res.json({ logs: rows });
};

// ── POST /api/deployment/services/:id/deploy (manual trigger) ─────────────────

exports.triggerDeploy = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM deployment_services WHERE id = $1 AND tenant_id = $2`,
    [req.params.id, req.user.tenant_id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Service not found' });
  const service = rows[0];

  if (service.source_type === 'postgres') {
    // Runtime provisioning over SSH on the VM.
    provisionPostgres(service).catch((err) => console.error('[deploy] Postgres provision error:', err.message));
    return res.json({ message: 'Provisioning started' });
  }

  const { env, privateKey } = await deployContext(service);
  runDeploy({ serviceId: service.id, triggeredBy: 'manual', env, privateKey })
    .catch((err) => console.error(`[deploy] Manual trigger error:`, err.message));
  res.json({ message: 'Deploy started' });
};

// ── Per-service environment variables ────────────────────────────────────────

const ENV_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;

async function serviceForTenant(id, tenantId) {
  const { rows } = await pool.query(
    'SELECT id, vm_id FROM deployment_services WHERE id = $1 AND tenant_id = $2', [id, tenantId]
  );
  return rows[0] || null;
}

/** Decrypted env + per-VM SSH key for a deploy. privateKey null → shared-key fallback. */
async function deployContext(service) {
  const { rows } = await pool.query(
    'SELECT key, value_enc FROM deployment_service_env WHERE service_id = $1', [service.id]
  );
  const env = rows.map((r) => {
    try { return { key: r.key, value: keyCrypto.open(r.value_enc) }; }
    catch { return { key: r.key, value: '' }; }
  });
  let privateKey = null;
  try { const vk = await VmKey.getActiveForVm(service.vm_id); if (vk) privateKey = vk.privateKey; }
  catch { /* fall back to shared key inside runDeploy */ }
  return { env, privateKey };
}

// PATCH /api/deployment/services/:id  — update build/start settings (config)
const SETTINGS_KEYS = ['root_dir', 'install_cmd', 'build_cmd', 'start_cmd', 'port', 'watch_paths'];
exports.updateServiceConfig = async (req, res) => {
  const svc = await serviceForTenant(req.params.id, req.user.tenant_id);
  if (!svc) return res.status(404).json({ error: 'Service not found' });

  const patch = {};
  for (const k of SETTINGS_KEYS) if (req.body[k] !== undefined) patch[k] = req.body[k];
  if (patch.port !== undefined) {
    const p = Number(patch.port);
    if (!Number.isInteger(p) || p < 1 || p > 65535) return res.status(400).json({ error: 'port must be 1-65535' });
    patch.port = p;
  }
  if (patch.root_dir !== undefined) patch.root_dir = String(patch.root_dir).replace(/^\/+|\/+$/g, '');
  if (patch.watch_paths !== undefined) {
    const arr = Array.isArray(patch.watch_paths) ? patch.watch_paths : String(patch.watch_paths).split(',');
    patch.watch_paths = arr.map((p) => String(p).trim().replace(/^\/+|\/+$/g, '')).filter(Boolean);
  }
  const { rows } = await pool.query(
    `UPDATE deployment_services SET config = COALESCE(config, '{}'::jsonb) || $1::jsonb, updated_at = NOW()
     WHERE id = $2 RETURNING *`,
    [JSON.stringify(patch), svc.id]
  );
  res.json({ service: rows[0] });
};

// GET /api/deployment/services/:id/runtime-logs — journalctl over SSH
exports.getRuntimeLogs = async (req, res) => {
  const svc = await serviceForTenant(req.params.id, req.user.tenant_id);
  if (!svc) return res.status(404).json({ error: 'Service not found' });
  const gate = await ensureLogsEntitlement(req, svc.vm_id);
  if (gate) return res.status(gate.status).json(gate.body);

  const { rows: cfgRows } = await pool.query(
    'SELECT ip_address, ssh_user, ssh_port FROM vm_ssh_config WHERE vm_id = $1 AND tenant_id = $2',
    [svc.vm_id, req.user.tenant_id]
  );
  if (!cfgRows.length) return res.json({ logs: 'No SSH config for this VM yet.' });
  const cfg = cfgRows[0];

  const vk = await VmKey.getActiveForVm(svc.vm_id);
  const privateKey = vk ? vk.privateKey : getSshPrivateKey();

  const ssh = new NodeSSH();
  try {
    await ssh.connect({ host: cfg.ip_address, port: cfg.ssh_port || 22, username: cfg.ssh_user || 'rachops', privateKey, readyTimeout: 12000 });
    const r = await ssh.execCommand(`sudo journalctl -u rb-svc-${svc.id} -n 200 --no-pager 2>&1 || echo '(no logs yet)'`);
    res.json({ logs: (r.stdout || r.stderr || '(no logs)').slice(0, 60000) });
  } catch (e) {
    res.status(502).json({ error: 'Could not fetch logs: ' + e.message });
  } finally {
    try { ssh.dispose(); } catch { /* noop */ }
  }
};

// GET /api/deployment/services/:id/env
exports.getServiceEnv = async (req, res) => {
  const svc = await serviceForTenant(req.params.id, req.user.tenant_id);
  if (!svc) return res.status(404).json({ error: 'Service not found' });
  const { rows } = await pool.query(
    'SELECT key, value_enc, is_secret FROM deployment_service_env WHERE service_id = $1 ORDER BY key', [svc.id]
  );
  const vars = rows.map((r) => {
    let value = '';
    try { value = keyCrypto.open(r.value_enc); } catch { /* leave blank if unreadable */ }
    return { key: r.key, value, is_secret: r.is_secret };
  });
  res.json({ vars });
};

// PUT /api/deployment/services/:id/env  { vars: [{ key, value, is_secret }] }
// Replaces the whole set (simple editor semantics).
exports.setServiceEnv = async (req, res) => {
  const svc = await serviceForTenant(req.params.id, req.user.tenant_id);
  if (!svc) return res.status(404).json({ error: 'Service not found' });
  if (!keyCrypto.isConfigured()) {
    return res.status(503).json({ error: 'Env encryption not configured (RACHBASE_KEY_ENC_SECRET)' });
  }
  const { vars } = req.body;
  if (!Array.isArray(vars)) return res.status(400).json({ error: 'vars must be an array' });

  const seen = new Set();
  const clean = [];
  for (const v of vars.slice(0, 200)) {
    const key = String(v?.key ?? '').trim();
    if (!ENV_KEY_RE.test(key) || seen.has(key)) continue;
    seen.add(key);
    clean.push({ key, value: String(v?.value ?? ''), is_secret: v?.is_secret !== false });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM deployment_service_env WHERE service_id = $1', [svc.id]);
    for (const v of clean) {
      await client.query(
        `INSERT INTO deployment_service_env (service_id, key, value_enc, is_secret)
         VALUES ($1, $2, $3, $4)`,
        [svc.id, v.key, keyCrypto.seal(v.value), v.is_secret]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  res.json({ ok: true, count: clean.length });
};

// ── DELETE /api/deployment/services/:id ──────────────────────────────────────
// Removes a service card: best-effort teardown of its VM-side resources (systemd
// unit, release dirs, env file, Caddy vhosts) and its DNS, then deletes the DB
// rows. A Postgres service's data cluster is left intact by default to avoid
// accidental data loss (pass ?drop_database=true to also drop the DB).
exports.deleteService = async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM deployment_services WHERE id = $1 AND tenant_id = $2',
    [req.params.id, req.user.tenant_id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Service not found' });
  const svc = rows[0];

  // Domains attached to this service — used for Caddy + DNS cleanup.
  const { rows: domains } = await pool.query(
    'SELECT id, hostname, is_auto FROM deployment_domains WHERE service_id = $1',
    [svc.id]
  );

  // Fire-and-forget teardown on the VM. Never block the delete on VM reachability.
  (async () => {
    // Remove Caddy vhosts + auto DNS first.
    for (const d of domains) {
      caddy.removeDomain({ vmId: svc.vm_id, tenantId: req.user.tenant_id, file: `svc-${svc.id}-${d.id}` })
        .catch((e) => console.error('[delete] caddy removeDomain:', e.message));
      if (d.is_auto) {
        godaddy.deleteARecord(d.hostname.split('.')[0])
          .catch((e) => console.error('[delete] dns delete:', e.message));
      }
    }

    if (svc.source_type === 'github') {
      try {
        const { rows: cfgRows } = await pool.query(
          'SELECT ip_address, ssh_user, ssh_port FROM vm_ssh_config WHERE vm_id = $1 AND tenant_id = $2',
          [svc.vm_id, req.user.tenant_id]
        );
        if (cfgRows.length && cfgRows[0].ip_address) {
          const cfg = cfgRows[0];
          const vk  = await VmKey.getActiveForVm(svc.vm_id);
          const unit = `rb-svc-${svc.id}`;
          const ssh = new NodeSSH();
          await ssh.connect({
            host: cfg.ip_address, port: cfg.ssh_port || 22,
            username: cfg.ssh_user || 'rachops',
            privateKey: vk ? vk.privateKey : getSshPrivateKey(),
          });
          await ssh.execCommand([
            `sudo systemctl stop ${unit} 2>/dev/null || true`,
            `sudo systemctl disable ${unit} 2>/dev/null || true`,
            `sudo rm -f /etc/systemd/system/${unit}.service`,
            'sudo systemctl daemon-reload 2>/dev/null || true',
            `sudo rm -f /etc/rachbase/svc-${svc.id}.env`,
            `sudo rm -rf /opt/rachbase/svc-${svc.id}`,
          ].join('\n'));
          ssh.dispose();
        }
      } catch (e) {
        console.error(`[delete] VM teardown for service ${svc.id}:`, e.message);
      }
    }
  })();

  // Delete DB rows (children first — safe even if FKs already cascade).
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM deployment_domains     WHERE service_id = $1', [svc.id]);
    await client.query('DELETE FROM deployment_service_env WHERE service_id = $1', [svc.id]);
    await client.query('DELETE FROM deployment_logs        WHERE service_id = $1', [svc.id]);
    await client.query('DELETE FROM deployment_services    WHERE id = $1',         [svc.id]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  res.json({ ok: true, id: svc.id });
};

// ── Per-service domains (Caddy reverse proxy) ─────────────────────────────────

const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

exports.listDomains = async (req, res) => {
  const svc = await serviceForTenant(req.params.id, req.user.tenant_id);
  if (!svc) return res.status(404).json({ error: 'Service not found' });
  const { rows } = await pool.query(
    'SELECT id, hostname, is_auto, status, created_at FROM deployment_domains WHERE service_id = $1 ORDER BY id',
    [svc.id]
  );
  res.json({ domains: rows });
};

// POST /api/deployment/services/:id/domains  { hostname }  — attach a custom domain
exports.addDomain = async (req, res) => {
  const svc = await serviceForTenant(req.params.id, req.user.tenant_id);
  if (!svc) return res.status(404).json({ error: 'Service not found' });

  const hostname = String(req.body.hostname || '').trim().toLowerCase();
  if (!DOMAIN_RE.test(hostname)) return res.status(400).json({ error: 'Invalid hostname' });

  const { rows: srows } = await pool.query('SELECT config FROM deployment_services WHERE id = $1', [svc.id]);
  const port = Number(srows[0]?.config?.port) || 3000;

  let domain;
  try {
    const { rows } = await pool.query(
      `INSERT INTO deployment_domains (service_id, hostname, is_auto, status)
       VALUES ($1, $2, false, 'provisioning') RETURNING id, hostname, is_auto, status, created_at`,
      [svc.id, hostname]
    );
    domain = rows[0];
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Hostname already in use' });
    throw e;
  }

  // Apply Caddy config in the background; the card polls for status.
  (async () => {
    try {
      await caddy.applyDomain({ vmId: svc.vm_id, tenantId: req.user.tenant_id, file: `svc-${svc.id}-${domain.id}`, hostname, port });
      await pool.query('UPDATE deployment_domains SET status = $1 WHERE id = $2', ['live', domain.id]);
    } catch (err) {
      console.error('[caddy] applyDomain failed:', err.message);
      await pool.query('UPDATE deployment_domains SET status = $1 WHERE id = $2', ['failed', domain.id]).catch(() => {});
    }
  })();

  res.status(201).json({
    domain,
    message: 'Point this hostname (DNS A record) at the VM IP; Caddy issues TLS automatically once it resolves.',
  });
};

// POST /api/deployment/services/:id/domains/auto  { subdomain }
// Auto domain <subdomain>.rachbase.com — creates the GoDaddy A record → VM IP,
// then applies Caddy. Subdomain is globally unique + not reserved.
const RESERVED = new Set([
  'www', 'api', 'app', 'admin', 'root', 'mail', 'smtp', 'imap', 'ftp', 'ns1', 'ns2',
  'dashboard', 'dev', 'staging', 'test', 'prod', 'postgres', 'db', 'status', 'cdn',
  'static', 'assets', 'blog', 'docs', 'help', 'support', 'billing', 'account', 'accounts',
  'login', 'auth', 'proxy', 'edge', 'internal', 'rachbase', 'rachdev',
]);
const LABEL_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

exports.addAutoDomain = async (req, res) => {
  const svc = await serviceForTenant(req.params.id, req.user.tenant_id);
  if (!svc) return res.status(404).json({ error: 'Service not found' });
  if (!godaddy.isConfigured()) {
    return res.status(503).json({ error: 'Auto domains not configured (GoDaddy API key missing)' });
  }

  const sub = String(req.body.subdomain || '').trim().toLowerCase();
  if (!LABEL_RE.test(sub)) return res.status(400).json({ error: 'Invalid subdomain (letters, digits, hyphens)' });
  if (RESERVED.has(sub))  return res.status(400).json({ error: 'That name is reserved' });

  const { rows: cfg } = await pool.query(
    'SELECT ip_address FROM vm_ssh_config WHERE vm_id = $1 AND tenant_id = $2', [svc.vm_id, req.user.tenant_id]
  );
  if (!cfg.length) return res.status(400).json({ error: 'This VM has no SSH config yet' });
  const ip = cfg[0].ip_address;

  const { rows: srows } = await pool.query('SELECT config FROM deployment_services WHERE id = $1', [svc.id]);
  const port = Number(srows[0]?.config?.port) || 3000;
  const hostname = godaddy.fqdn(sub);

  let domain;
  try {
    const { rows } = await pool.query(
      `INSERT INTO deployment_domains (service_id, hostname, is_auto, status)
       VALUES ($1, $2, true, 'provisioning') RETURNING id, hostname, is_auto, status, created_at`,
      [svc.id, hostname]
    );
    domain = rows[0];
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'That domain is already taken' });
    throw e;
  }

  (async () => {
    try {
      await godaddy.upsertARecord(sub, ip);
      await caddy.applyDomain({ vmId: svc.vm_id, tenantId: req.user.tenant_id, file: `svc-${svc.id}-${domain.id}`, hostname, port });
      await pool.query('UPDATE deployment_domains SET status = $1 WHERE id = $2', ['live', domain.id]);
    } catch (err) {
      console.error('[auto-domain]', err.message);
      await pool.query('UPDATE deployment_domains SET status = $1 WHERE id = $2', ['failed', domain.id]).catch(() => {});
    }
  })();

  res.status(201).json({ domain, message: 'Provisioning DNS + TLS — live in a few minutes (DNS propagation).' });
};

// DELETE /api/deployment/services/:id/domains/:domainId
exports.removeDomain = async (req, res) => {
  const svc = await serviceForTenant(req.params.id, req.user.tenant_id);
  if (!svc) return res.status(404).json({ error: 'Service not found' });
  const { rows } = await pool.query(
    'SELECT id, hostname, is_auto FROM deployment_domains WHERE id = $1 AND service_id = $2',
    [req.params.domainId, svc.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Domain not found' });
  const d = rows[0];

  caddy.removeDomain({ vmId: svc.vm_id, tenantId: req.user.tenant_id, file: `svc-${svc.id}-${d.id}` })
    .catch((e) => console.error('[caddy] removeDomain failed:', e.message));

  // Auto domains own their DNS record — remove it from GoDaddy too.
  if (d.is_auto) {
    godaddy.deleteARecord(d.hostname.split('.')[0])
      .catch((e) => console.error('[auto-domain] delete DNS failed:', e.message));
  }

  await pool.query('DELETE FROM deployment_domains WHERE id = $1', [d.id]);
  res.json({ ok: true });
};

// ── Canvas node positions ─────────────────────────────────────────────────────

exports.getCanvas = async (req, res) => {
  const { rows } = await pool.query(
    'SELECT node_key, x, y FROM deployment_canvas WHERE tenant_id = $1',
    [req.user.tenant_id]
  );
  res.json({ positions: rows });
};

exports.saveCanvas = async (req, res) => {
  const { positions } = req.body;
  if (!Array.isArray(positions)) return res.status(400).json({ error: 'positions must be an array' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const p of positions.slice(0, 500)) {
      if (!p || typeof p.node_key !== 'string' || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      await client.query(
        `INSERT INTO deployment_canvas (tenant_id, node_key, x, y)
           VALUES ($1, $2, $3, $4)
         ON CONFLICT (tenant_id, node_key)
           DO UPDATE SET x = EXCLUDED.x, y = EXCLUDED.y, updated_at = NOW()`,
        [req.user.tenant_id, p.node_key.slice(0, 120), p.x, p.y]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  res.json({ ok: true });
};

// ── Admin: set VM SSH config ──────────────────────────────────────────────────

exports.listVmSshConfigs = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT v.*, t.name as tenant_name
     FROM vm_ssh_config v
     LEFT JOIN tenants t ON t.id = v.tenant_id
     ORDER BY v.tenant_id, v.vm_id`
  );
  res.json({ configs: rows });
};

exports.setVmSshConfig = async (req, res) => {
  const { vm_id, tenant_id, ip_address, ssh_user = 'rachops', ssh_port = 22 } = req.body;
  if (!vm_id || !ip_address || !tenant_id) {
    return res.status(400).json({ error: 'vm_id, tenant_id and ip_address are required' });
  }
  // Input validation — vm_id feeds the terminal, rotation and monitoring.
  if (!/^(qemu|lxc)\/\d+$/.test(vm_id)) {
    return res.status(400).json({ error: 'Invalid vm_id — expected qemu/<n> or lxc/<n>' });
  }
  if (!/^[0-9a-fA-F:.]{3,45}$/.test(String(ip_address))) {
    return res.status(400).json({ error: 'Invalid ip_address' });
  }
  const port = Number(ssh_port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return res.status(400).json({ error: 'ssh_port must be 1-65535' });
  }
  if (!/^[a-z_][a-z0-9_-]{0,31}$/.test(String(ssh_user))) {
    return res.status(400).json({ error: 'Invalid ssh_user' });
  }
  // Verify the tenant exists (avoids an opaque FK 500).
  const { rows: t } = await pool.query('SELECT 1 FROM tenants WHERE id = $1', [tenant_id]);
  if (!t.length) return res.status(404).json({ error: 'Tenant not found' });

  const { rows } = await pool.query(
    `INSERT INTO vm_ssh_config (vm_id, tenant_id, ip_address, ssh_user, ssh_port)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (vm_id) DO UPDATE
       SET ip_address = EXCLUDED.ip_address,
           ssh_user   = EXCLUDED.ssh_user,
           ssh_port   = EXCLUDED.ssh_port,
           updated_at = NOW()
     RETURNING *`,
    [vm_id, tenant_id, ip_address, ssh_user, port]
  );
  res.json({ config: rows[0] });
};

// ── POST /api/deployment/github/webhook ──────────────────────────────────────

exports.handleWebhook = async (req, res) => {
  const sig     = req.headers['x-hub-signature-256'] || '';
  const payload = req.rawBody || Buffer.from(JSON.stringify(req.body));
  const expected = 'sha256=' + crypto.createHmac('sha256', GITHUB_WEBHOOK_SECRET)
    .update(payload).digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const event = req.headers['x-github-event'];
  const body  = req.body;
  console.log(`[webhook] GitHub event: ${event} action: ${body?.action}`);

  // ── Push event → trigger deploy ────────────────────────────────────────────
  if (event === 'push') {
    const repoFullName = body?.repository?.full_name;
    const ref          = body?.ref; // e.g. "refs/heads/main"
    const commitSha    = body?.after;
    const branch       = ref?.replace('refs/heads/', '');

    // Collect every path touched by this push (added/modified/removed across all
    // commits). Empty ⇒ we can't tell (force-push, truncated payload) ⇒ fail open.
    const changed = new Set();
    for (const c of (body?.commits || [])) {
      for (const p of [...(c.added || []), ...(c.modified || []), ...(c.removed || [])]) changed.add(p);
    }
    if (body?.head_commit) {
      const h = body.head_commit;
      for (const p of [...(h.added || []), ...(h.modified || []), ...(h.removed || [])]) changed.add(p);
    }

    if (repoFullName && branch) {
      try {
        // Find all services matching this repo + branch
        const { rows: services } = await pool.query(
          `SELECT id, vm_id, config FROM deployment_services
           WHERE repo_full_name = $1 AND branch = $2 AND status != 'deploying'`,
          [repoFullName, branch]
        );

        const targets = services.filter((svc) => serviceAffectedByPush(svc.config, changed));

        if (targets.length) {
          console.log(`[webhook] Push to ${repoFullName}@${branch} (${changed.size} files) — deploying ${targets.length}/${services.length} service(s)`);
          // Fire and forget — don't await so webhook responds fast
          for (const svc of targets) {
            deployContext(svc)
              .then(({ env, privateKey }) => runDeploy({ serviceId: svc.id, commitSha, triggeredBy: 'webhook', env, privateKey }))
              .catch((err) => console.error(`[deploy] Error for service ${svc.id}:`, err.message));
          }
        } else {
          console.log(`[webhook] Push to ${repoFullName}@${branch} — ${services.length} service(s), none matched changed paths`);
        }
      } catch (err) {
        console.error('[webhook] Deploy trigger error:', err.message);
      }
    }
  }

  // Save installation whenever app is installed or repos are added
  if (
    (event === 'installation' && ['created', 'added'].includes(body?.action)) ||
    event === 'installation_repositories'
  ) {
    const installationId = body?.installation?.id;
    const githubAccount  = body?.installation?.account?.login || null;
    const webhookState   = body?.installation?.app_slug || null;

    if (installationId) {
      try {
        // Find the pending install entry to get tenant_id
        let tenantId  = null;
        let userId    = null;
        const now     = Date.now();

        for (const [state, pending] of pendingInstalls.entries()) {
          if (pending.expires > now) {
            tenantId = pending.tenant_id;
            userId   = pending.user_id;
            pendingInstalls.delete(state);
            break;
          }
        }

        if (tenantId) {
          await pool.query(
            `INSERT INTO deployment_github_installations
               (tenant_id, installation_id, github_account, installed_by)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (tenant_id) DO UPDATE
               SET installation_id = EXCLUDED.installation_id,
                   github_account  = EXCLUDED.github_account,
                   installed_at    = NOW()`,
            [tenantId, installationId, githubAccount, userId]
          );
          console.log(`[webhook] Installation ${installationId} (${githubAccount}) saved for tenant ${tenantId}`);
        } else {
          console.warn('[webhook] No pending install found for this installation event');
        }
      } catch (err) {
        console.error('[webhook] Failed to save installation:', err.message);
      }
    }
  }

  res.json({ received: true });
};
