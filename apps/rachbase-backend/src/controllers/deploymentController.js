'use strict';

const pool        = require('@rach/core').pool;
const crypto      = require('crypto');
const { runDeploy } = require('@rach/deploy');

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
  const { vm_id, repo_full_name, branch } = req.body;
  if (!vm_id || !repo_full_name || !branch) {
    return res.status(400).json({ error: 'vm_id, repo_full_name and branch are required' });
  }

  const { rows: inst } = await pool.query(
    'SELECT installation_id FROM deployment_github_installations WHERE tenant_id = $1',
    [req.user.tenant_id]
  );
  if (!inst.length) return res.status(400).json({ error: 'GitHub not connected' });

  const { rows } = await pool.query(
    `INSERT INTO deployment_services
       (tenant_id, vm_id, installation_id, repo_full_name, branch, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [req.user.tenant_id, vm_id, inst[0].installation_id, repo_full_name, branch, req.user.id]
  );

  res.status(201).json({ service: rows[0] });
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
    `SELECT id FROM deployment_services WHERE id = $1 AND tenant_id = $2`,
    [req.params.id, req.user.tenant_id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Service not found' });

  runDeploy({ serviceId: rows[0].id, triggeredBy: 'manual' })
    .catch((err) => console.error(`[deploy] Manual trigger error:`, err.message));

  res.json({ message: 'Deploy started' });
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
  const { vm_id, tenant_id, ip_address, ssh_user = 'root', ssh_port = 22 } = req.body;
  if (!vm_id || !ip_address || !tenant_id) {
    return res.status(400).json({ error: 'vm_id, tenant_id and ip_address are required' });
  }
  const { rows } = await pool.query(
    `INSERT INTO vm_ssh_config (vm_id, tenant_id, ip_address, ssh_user, ssh_port)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (vm_id) DO UPDATE
       SET ip_address = EXCLUDED.ip_address,
           ssh_user   = EXCLUDED.ssh_user,
           ssh_port   = EXCLUDED.ssh_port,
           updated_at = NOW()
     RETURNING *`,
    [vm_id, tenant_id, ip_address, ssh_user, ssh_port]
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
  console.log(`[webhook] GitHub event: ${event} action: ${req.body?.action}`);

  // ── Push event → trigger deploy ────────────────────────────────────────────
  if (event === 'push') {
    const repoFullName = body?.repository?.full_name;
    const ref          = body?.ref; // e.g. "refs/heads/main"
    const commitSha    = body?.after;
    const branch       = ref?.replace('refs/heads/', '');

    if (repoFullName && branch) {
      try {
        // Find all services matching this repo + branch
        const { rows: services } = await pool.query(
          `SELECT id FROM deployment_services
           WHERE repo_full_name = $1 AND branch = $2 AND status != 'deploying'`,
          [repoFullName, branch]
        );

        if (services.length) {
          console.log(`[webhook] Push to ${repoFullName}@${branch} — triggering ${services.length} deploy(s)`);
          // Fire and forget — don't await so webhook responds fast
          for (const svc of services) {
            runDeploy({ serviceId: svc.id, commitSha, triggeredBy: 'webhook' })
              .catch((err) => console.error(`[deploy] Error for service ${svc.id}:`, err.message));
          }
        } else {
          console.log(`[webhook] Push to ${repoFullName}@${branch} — no matching services`);
        }
      } catch (err) {
        console.error('[webhook] Deploy trigger error:', err.message);
      }
    }
  }

  const body = req.body;

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
