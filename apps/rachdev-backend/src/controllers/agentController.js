'use strict';

/**
 * Agent controller (RachDev agent builder).
 *
 * Concerns are delegated:
 *   - credits/metering  → @rach/billing (credits)
 *   - LLM model call     → @rach/llm (gateway; meters via billing)
 *   - agent deploy/host  → the Agent Runtime Contract (deploymentController)
 *
 * The chat here is the AGENT BUILDER assistant — it helps users design and
 * configure agents (AgentSpecs) in natural language. The old DevOps deployment
 * assistant (run-command / trigger-deploy over VMs) was retired in migration
 * step #6: infrastructure ops are a RachBase concern and no longer live in
 * RachDev. See docs/RACHDEV_ARCHITECTURE_PROPOSAL.md.
 */

const { pool, AgentDefinition, agentSpec } = require('@rach/core');
const { credits, purchase } = require('@rach/billing');
const { gateway } = require('@rach/llm');
const { getTenantModel } = require('../services/tenantLlm');

const { validateAgentSpecInput, columnsFromInput, rowToSpec } = agentSpec;

// ── GET /api/agent/credits ────────────────────────────────────────────────────

exports.getCredits = async (req, res) => {
  const balance = await credits.getOrCreateBalance(req.user.tenant_id);
  res.json({ balance, packs: credits.CREDIT_PACKS });
};

// ── POST /api/agent/credits/purchase ─────────────────────────────────────────

/**
 * Credit purchases go through the shared purchase service.
 *
 * This handler used to run its own billing stack: a private Razorpay SDK
 * instance, its own USD→INR conversion via `price_usd * rate * 100` (a float
 * path), no order or payment row, and — in verifyPurchase below — a
 * non-constant-time signature check with no confirmation that the payment had
 * actually been captured. It was a third money path, missed during the
 * consolidation because it lives in this app rather than rachbase-backend.
 */
exports.purchaseCredits = async (req, res) => {
  const { pack_id, billing_country } = req.body;

  let result;
  try {
    result = await purchase.createCreditPurchase({
      user: req.user,
      packId: pack_id,
      billingCountry: billing_country,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message, code: err.code });
    throw err;
  }

  const { pack, billing, razorpay: rz } = result;

  // Response shape unchanged — the billing dashboard reads order_id, amount,
  // currency and razorpay_key_id.
  res.json({
    order_id:        rz.order_id,
    amount:          billing.amountMinor,
    currency:        billing.currency,
    razorpay_key_id: rz.key_id,
    pack,
    fx_rate:         billing.fxRate,
  });
};

// ── POST /api/agent/credits/verify ───────────────────────────────────────────

exports.verifyPurchase = async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, pack_id, billing } = req.body;

  let result;
  try {
    result = await purchase.verifyCreditPurchase({
      user: req.user,
      packId: pack_id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      billing: billing || {},
    });
  } catch (err) {
    // PaymentVerificationError and the service's own errors both carry status.
    if (err.status) return res.status(err.status).json({ error: err.message, code: err.code });
    throw err;
  }

  res.json({
    success: true,
    credits_added: result.pack.credits,
    balance: result.balance,
    invoice: result.invoice?.ok
      ? { number: result.invoice.invoice.invoice_number, emailed: result.invoice.emailed }
      : null,
  });
};

// ── GET /api/agent/sessions ───────────────────────────────────────────────────

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

// ── POST /api/agent/sessions ──────────────────────────────────────────────────

exports.createSession = async (req, res) => {
  const { title = 'New Chat' } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO agent_chat_sessions (tenant_id, user_id, title)
     VALUES ($1, $2, $3) RETURNING *`,
    [req.user.tenant_id, req.user.id, title]
  );
  res.status(201).json({ session: rows[0] });
};

// ── GET /api/agent/sessions/:id/messages ─────────────────────────────────────

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

// ── POST /api/agent/sessions/:id/chat (streaming) ────────────────────────────

exports.chat = async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

  // 1. Verify session belongs to tenant
  const { rows: sessionRows } = await pool.query(
    'SELECT * FROM agent_chat_sessions WHERE id = $1 AND tenant_id = $2',
    [req.params.id, req.user.tenant_id]
  );
  if (!sessionRows.length) return res.status(404).json({ error: 'Session not found' });

  // 2. Check credits
  if (req.user.tenant_id == null) {
    return res.status(400).json({ error: 'No workspace provisioned for this account yet', code: 'no_tenant' });
  }
  const balance = await credits.getOrCreateBalance(req.user.tenant_id);
  if (balance <= 0) {
    return res.status(402).json({ error: 'Insufficient credits', balance });
  }

  // 3. Load builder context — the tenant's agents (drafts) + platform templates.
  const definitions = await AgentDefinition.listForTenant(req.user.tenant_id);
  const agentsSummary = definitions.map((d) => ({
    key: d.key,
    name: d.name,
    role: d.role,
    industry: d.industry,
    status: d.status,
    version: d.version,
    is_template: d.tenant_id == null,
  }));

  const systemPrompt = `You are the RachDev Agent Builder assistant. You help users design and configure AI agents in plain language. You do NOT manage servers, run shell commands, or touch infrastructure — hosting is handled by the platform.

Your job:
- Turn an idea (or a starting template) into a well-formed agent: its purpose, system prompt, tools, guardrails, and channels.
- Recommend sensible guardrails (human review, PII handling, escalation) and an appropriate model class: fast, balanced, or reasoning.
- Explain the flow: build a draft → publish an immutable version → deploy that version. Deploying and hosting are handled for the user; never expose VMs or commands.

Describe configuration in terms of AgentSpec fields (prompt, tools, guardrails, model_policy, channels). Tool types available: http_action, knowledge_base, handoff, function. You advise; the builder saves the spec.

Workspace context (the user's current agents and available templates):
${JSON.stringify(agentsSummary)}

Be concise, practical, and specific.`;

  // 4. Load message history
  const { rows: history } = await pool.query(
    `SELECT role, content FROM agent_chat_messages
     WHERE session_id = $1 ORDER BY created_at ASC LIMIT 20`,
    [req.params.id]
  );

  // 5. Save user message
  await pool.query(
    `INSERT INTO agent_chat_messages (session_id, role, content) VALUES ($1, 'user', $2)`,
    [req.params.id, message]
  );

  // 6. Stream response via the shared LLM gateway (which meters credits)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  // Accumulate streamed text so the reply can be persisted even on a mid-call
  // failure — otherwise the session keeps the user message with no answer.
  let streamed = '';

  try {
    const result = await gateway.chat({
      tenantId:    req.user.tenant_id,
      userId:      req.user.id,
      model:       (await getTenantModel(req.user.tenant_id)) || undefined,
      system:      systemPrompt,
      messages,
      description: `Chat in session ${req.params.id}`,
      onText:      (text) => { streamed += text; res.write(`data: ${JSON.stringify({ type: 'text', text })}\n\n`); },
    });

    // Save assistant message
    await pool.query(
      `INSERT INTO agent_chat_messages
         (session_id, role, content, tokens_used, credits_used)
       VALUES ($1, 'assistant', $2, $3, $4)`,
      [req.params.id, result.text, result.totalTokens, result.creditsUsed]
    );

    // Update session title from first message if still default
    if (sessionRows[0].title === 'New Chat') {
      const title = message.slice(0, 50) + (message.length > 50 ? '...' : '');
      await pool.query(
        'UPDATE agent_chat_sessions SET title = $1, updated_at = NOW() WHERE id = $2',
        [title, req.params.id]
      );
    } else {
      await pool.query(
        'UPDATE agent_chat_sessions SET updated_at = NOW() WHERE id = $1',
        [req.params.id]
      );
    }

    const newBalance = await credits.getOrCreateBalance(req.user.tenant_id);
    res.write(`data: ${JSON.stringify({ type: 'done', tokens: result.totalTokens, credits_used: result.creditsUsed, balance: newBalance })}\n\n`);

  } catch (err) {
    console.error('[agent/chat]', err.message);
    // Persist whatever streamed so the turn isn't lost. The gateway already
    // refunded / never charged on failure, so credits_used = 0 here.
    if (streamed.trim()) {
      await pool.query(
        `INSERT INTO agent_chat_messages
           (session_id, role, content, tokens_used, credits_used)
         VALUES ($1, 'assistant', $2, NULL, 0)`,
        [req.params.id, streamed]
      ).catch((e) => console.error('[agent/chat] persist partial', e.message));
      await pool.query('UPDATE agent_chat_sessions SET updated_at = NOW() WHERE id = $1', [req.params.id]).catch(() => {});
    }
    const payload = err.code === 'insufficient_credits'
      ? { type: 'error', code: err.code, message: err.message, balance: err.balance, required: err.required }
      : { type: 'error', message: err.message };
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }

  res.end();
};

// NOTE: the DevOps `trigger-deploy` and `run-command` handlers were removed in
// migration step #6. Running commands and deploying git services on VMs are
// RachBase concerns; RachDev deploys *agents* (published AgentSpecs) through the
// Agent Runtime Contract instead — see controllers/deploymentController.js and
// docs/RACHDEV_RUNTIME_CONTRACT.md.

// ── GET /api/agent/usage — summary ────────────────────────────────────────────

exports.getUsageSummary = async (req, res) => {
  const balance = await credits.getOrCreateBalance(req.user.tenant_id);

  const { rows } = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'purchase' THEN amount ELSE 0 END), 0) AS total_purchased,
       COALESCE(SUM(CASE WHEN type = 'usage'    THEN ABS(amount) ELSE 0 END), 0) AS total_used,
       COALESCE(SUM(CASE WHEN type = 'usage'    THEN COALESCE(tokens_used, 0) ELSE 0 END), 0) AS total_tokens
     FROM credit_transactions WHERE tenant_id = $1`,
    [req.user.tenant_id]
  );

  res.json({
    balance,
    total_purchased: Number(rows[0].total_purchased),
    total_used:      Number(rows[0].total_used),
    total_tokens:    Number(rows[0].total_tokens),
  });
};

// ── GET /api/agent/credits/history — paginated transaction log ────────────────

exports.getCreditHistory = async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page  || '1'));
  const limit  = Math.min(50, parseInt(req.query.limit || '20'));
  const offset = (page - 1) * limit;

  const { rows } = await pool.query(
    `SELECT t.*, u.name AS user_name
     FROM credit_transactions t
     LEFT JOIN users u ON u.id = t.user_id
     WHERE t.tenant_id = $1
     ORDER BY t.created_at DESC
     LIMIT $2 OFFSET $3`,
    [req.user.tenant_id, limit, offset]
  );

  const { rows: countRows } = await pool.query(
    'SELECT COUNT(*)::int AS total FROM credit_transactions WHERE tenant_id = $1',
    [req.user.tenant_id]
  );

  res.json({ transactions: rows, total: countRows[0].total, page, limit });
};

// ── GET /api/agent/usage/sessions — per-session usage breakdown ───────────────

exports.getSessionUsage = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT
       s.id, s.title, s.created_at, s.updated_at,
       COUNT(m.id)::int                       AS message_count,
       COALESCE(SUM(m.tokens_used), 0)::int   AS total_tokens,
       COALESCE(SUM(m.credits_used), 0)::int  AS total_credits
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

// ── Agent definitions (the AgentSpec builder ↔ operate seam) ─────────────────

// GET /api/agent/definitions — tenant's definitions + platform templates
exports.listDefinitions = async (req, res) => {
  const rows = await AgentDefinition.listForTenant(req.user.tenant_id);
  res.json({ definitions: rows.map(rowToSpec) });
};

// POST /api/agent/definitions — create/configure an agent in the builder.
// Body is validated against the AgentSpec input contract (unknown fields
// rejected); model_policy/template_ref are mapped to columns before persisting.
exports.createDefinition = async (req, res) => {
  const { valid, errors } = validateAgentSpecInput(req.body);
  if (!valid) return res.status(422).json({ error: 'Invalid agent spec', details: errors });

  const def = await AgentDefinition.create({
    ...columnsFromInput(req.body),
    tenant_id: req.user.tenant_id,
    created_by: req.user.id,
  });
  res.status(201).json({ definition: rowToSpec(def) });
};

// PUT /api/agent/definitions/:id — update a definition (must belong to tenant)
exports.updateDefinition = async (req, res) => {
  const { valid, errors } = validateAgentSpecInput(req.body, { partial: true });
  if (!valid) return res.status(422).json({ error: 'Invalid agent spec', details: errors });

  const existing = await AgentDefinition.findById(req.params.id);
  if (!existing || existing.tenant_id !== req.user.tenant_id) {
    return res.status(404).json({ error: 'Definition not found' });
  }
  const def = await AgentDefinition.update(req.params.id, columnsFromInput(req.body));
  res.json({ definition: rowToSpec(def) });
};

// POST /api/agent/definitions/:id/publish — snapshot the draft as an immutable
// version (agent_spec_versions) and bump the version. Deployments reference a
// published version, so a live agent never mutates under itself.
exports.publishDefinition = async (req, res) => {
  const existing = await AgentDefinition.findById(req.params.id);
  if (!existing || existing.tenant_id !== req.user.tenant_id) {
    return res.status(404).json({ error: 'Definition not found' });
  }
  const result = await AgentDefinition.publish(req.params.id, req.user.id);
  res.json({ version: result.version, definition: result.spec });
};

// GET /api/agent/definitions/:id/versions — published version history
exports.listDefinitionVersions = async (req, res) => {
  const existing = await AgentDefinition.findById(req.params.id);
  if (!existing || existing.tenant_id !== req.user.tenant_id) {
    return res.status(404).json({ error: 'Definition not found' });
  }
  const versions = await AgentDefinition.listVersions(req.user.tenant_id, existing.key);
  res.json({ versions });
};
