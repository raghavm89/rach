'use strict';

/**
 * Deploy Agent runtime — native to rachbase (no rachdev dependency).
 *
 * Chat streams through the shared @rach/llm gateway (which meters credits via
 * @rach/billing). The agent's tools act on rachbase's OWN infrastructure, so
 * they are LOCAL calls here — trigger-deploy runs the deploy engine directly and
 * run-command SSHes into the tenant's VM with its per-VM key — rather than the
 * HTTP round-trip rachdev uses. All handlers are tenant-scoped via req.user.
 */

const { pool } = require('@rach/core');
const { credits } = require('@rach/billing');
const { gateway } = require('@rach/llm');
const { runDeploy, getSshPrivateKey } = require('@rach/deploy');
const { NodeSSH } = require('node-ssh');
const { VmKey } = require('../models/vmKey');

// ── Sessions ──────────────────────────────────────────────────────────────────

exports.listSessions = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.id, s.title, s.created_at, s.updated_at,
            COUNT(m.id)::int AS message_count
     FROM agent_chat_sessions s
     LEFT JOIN agent_chat_messages m ON m.session_id = s.id
     WHERE s.tenant_id = $1
     GROUP BY s.id
     ORDER BY s.updated_at DESC
     LIMIT 50`,
    [req.user.tenant_id]
  );
  res.json({ sessions: rows });
};

exports.createSession = async (req, res) => {
  const { title = 'New Chat' } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO agent_chat_sessions (tenant_id, user_id, title) VALUES ($1, $2, $3) RETURNING *`,
    [req.user.tenant_id, req.user.id, title]
  );
  res.status(201).json({ session: rows[0] });
};

exports.getMessages = async (req, res) => {
  const { rows: session } = await pool.query(
    'SELECT id FROM agent_chat_sessions WHERE id = $1 AND tenant_id = $2',
    [req.params.id, req.user.tenant_id]
  );
  if (!session.length) return res.status(404).json({ error: 'Session not found' });

  const { rows } = await pool.query(
    `SELECT id, role, content, tokens_used, credits_used, created_at
     FROM agent_chat_messages WHERE session_id = $1 ORDER BY created_at ASC`,
    [req.params.id]
  );
  res.json({ messages: rows });
};

// ── Chat (streaming) ──────────────────────────────────────────────────────────

exports.chat = async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

  const { rows: sessionRows } = await pool.query(
    'SELECT * FROM agent_chat_sessions WHERE id = $1 AND tenant_id = $2',
    [req.params.id, req.user.tenant_id]
  );
  if (!sessionRows.length) return res.status(404).json({ error: 'Session not found' });

  const balance = await credits.getOrCreateBalance(req.user.tenant_id);
  if (balance <= 0) return res.status(402).json({ error: 'Insufficient credits', balance });

  // Tenant context — the VMs and services this agent can act on.
  const [vmsRes, servicesRes] = await Promise.all([
    pool.query('SELECT v.vm_id, v.ip_address, v.ssh_user FROM vm_ssh_config v WHERE v.tenant_id = $1', [req.user.tenant_id]),
    pool.query('SELECT s.id, s.vm_id, s.repo_full_name, s.branch, s.status FROM deployment_services s WHERE s.tenant_id = $1', [req.user.tenant_id]),
  ]);

  const systemPrompt = `You are the Deploy Agent for RachBase, a managed cloud platform.
You help tenant admins manage deployments, debug issues, and run commands on their VMs.

Tenant context:
- VMs: ${JSON.stringify(vmsRes.rows)}
- Deployed services: ${JSON.stringify(servicesRes.rows)}

You can help with: answering questions about deployments and infrastructure, debugging
failed deployments (ask for logs if needed), explaining statuses, suggesting fixes,
triggering deploys when explicitly asked, and running safe diagnostic commands on VMs.

Be concise, technical, and helpful. When suggesting commands, explain what they do first.
Never run destructive commands (rm -rf, etc.) without explicit confirmation.`;

  const { rows: history } = await pool.query(
    `SELECT role, content FROM agent_chat_messages WHERE session_id = $1 ORDER BY created_at ASC LIMIT 20`,
    [req.params.id]
  );

  await pool.query(
    `INSERT INTO agent_chat_messages (session_id, role, content) VALUES ($1, 'user', $2)`,
    [req.params.id, message]
  );

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  try {
    const result = await gateway.chat({
      tenantId:    req.user.tenant_id,
      userId:      req.user.id,
      system:      systemPrompt,
      messages,
      description: `Chat in session ${req.params.id}`,
      onText:      (text) => res.write(`data: ${JSON.stringify({ type: 'text', text })}\n\n`),
    });

    await pool.query(
      `INSERT INTO agent_chat_messages (session_id, role, content, tokens_used, credits_used)
       VALUES ($1, 'assistant', $2, $3, $4)`,
      [req.params.id, result.text, result.totalTokens, result.creditsUsed]
    );

    if (sessionRows[0].title === 'New Chat') {
      const title = message.slice(0, 50) + (message.length > 50 ? '...' : '');
      await pool.query('UPDATE agent_chat_sessions SET title = $1, updated_at = NOW() WHERE id = $2', [title, req.params.id]);
    } else {
      await pool.query('UPDATE agent_chat_sessions SET updated_at = NOW() WHERE id = $1', [req.params.id]);
    }

    const newBalance = await credits.getOrCreateBalance(req.user.tenant_id);
    res.write(`data: ${JSON.stringify({ type: 'done', tokens: result.totalTokens, credits_used: result.creditsUsed, balance: newBalance })}\n\n`);
  } catch (err) {
    console.error('[agent/chat]', err.message);
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
  }
  res.end();
};

// ── Tools (act on rachbase's own infra — local, tenant-scoped) ─────────────────

// POST /api/agent/sessions/:id/trigger-deploy
exports.triggerDeploy = async (req, res) => {
  const { service_id } = req.body;
  if (!service_id) return res.status(400).json({ error: 'service_id required' });

  const { rows } = await pool.query(
    'SELECT id FROM deployment_services WHERE id = $1 AND tenant_id = $2',
    [service_id, req.user.tenant_id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Service not found' });

  runDeploy({ serviceId: rows[0].id, triggeredBy: 'agent' })
    .catch((err) => console.error('[agent/deploy]', err.message));
  res.json({ message: 'Deploy started', service_id });
};

// POST /api/agent/sessions/:id/run-command
exports.runCommand = async (req, res) => {
  const { vm_id, command } = req.body;
  if (!vm_id || !command) return res.status(400).json({ error: 'vm_id and command required' });

  // Tenant-scoped: the VM must belong to the caller's tenant.
  const { rows } = await pool.query(
    'SELECT * FROM vm_ssh_config WHERE vm_id = $1 AND tenant_id = $2', [vm_id, req.user.tenant_id]
  );
  if (!rows.length) return res.status(404).json({ error: 'VM not found' });
  const cfg = rows[0];

  const vmKey = await VmKey.getActiveForVm(vm_id);
  const privateKey = vmKey ? vmKey.privateKey : getSshPrivateKey();

  const ssh = new NodeSSH();
  try {
    await ssh.connect({
      host: cfg.ip_address, port: cfg.ssh_port || 22,
      username: cfg.ssh_user || 'rachops', privateKey,
    });
    const result = await ssh.execCommand(command);
    res.json({ stdout: result.stdout, stderr: result.stderr, code: result.code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    ssh.dispose();
  }
};
