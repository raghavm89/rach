'use strict';

const { pool } = require('@rach/core');
const knowledge = require('../services/knowledge');
const knowledgeWeb = require('../services/knowledgeWeb');
const audit = require('../services/audit');

// GET /api/knowledge/docs — the approved reference library
exports.listDocs = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT d.id, d.title, d.body, d.citation, d.created_at, d.updated_at, u.name AS author
       FROM knowledge_docs d LEFT JOIN users u ON u.id = d.created_by
      WHERE d.tenant_id = $1 ORDER BY d.updated_at DESC`,
    [req.user.tenant_id]
  );
  res.json({ docs: rows });
};

// POST /api/knowledge/docs — add an approved source
exports.createDoc = async (req, res) => {
  const { title, body, citation } = req.body ?? {};
  if (!title?.trim() || !body?.trim()) return res.status(400).json({ error: 'title and body are required' });
  const { rows } = await pool.query(
    `INSERT INTO knowledge_docs (tenant_id, title, body, citation, created_by)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.user.tenant_id, String(title).trim(), String(body).trim(), citation ? String(citation).trim() : null, req.user.id]
  );
  res.status(201).json({ doc: rows[0] });
};

// DELETE /api/knowledge/docs/:id
exports.deleteDoc = async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM knowledge_docs WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user.tenant_id]);
  if (!rowCount) return res.status(404).json({ error: 'Source not found' });
  res.json({ ok: true });
};

// POST /api/knowledge/ask — grounded, cited answer (never a diagnosis)
exports.ask = async (req, res) => {
  const { question } = req.body ?? {};
  if (!question || !String(question).trim()) return res.status(400).json({ error: 'question is required' });

  const { rows: docs } = await pool.query(
    'SELECT id, title, body, citation FROM knowledge_docs WHERE tenant_id = $1', [req.user.tenant_id]
  );

  let out;
  try {
    out = await knowledge.generateAnswer({ tenantId: req.user.tenant_id, userId: req.user.id, question, docs });
  } catch (err) {
    if (err && (err.code === 'MODEL_OUTPUT' || err.status === 502)) return res.status(502).json({ error: err.message });
    if (/JSON|model response/i.test(err.message)) return res.status(502).json({ error: 'The model did not return a usable answer. Please try again.' });
    throw err;
  }

  await audit.record({
    tenantId: req.user.tenant_id, actorId: req.user.id, agent: 'Ira',
    action: out.can_answer ? 'Knowledge query answered' : 'Knowledge query — not in approved library',
    decision: 'created', entityType: 'knowledge', entityId: null, model: out.model,
    summary: String(question).trim().slice(0, 200),
    metadata: { can_answer: out.can_answer, sources: out.used?.map((d) => d.title) || [] },
  });
  res.json({ ...out, web_available: knowledgeWeb.enabled() });
};

// POST /api/knowledge/web — controlled external web-reference lookup (no PHI)
exports.webReferences = async (req, res) => {
  const question = String(req.body?.question || '').trim();
  if (!question) return res.status(400).json({ error: 'question is required' });

  const out = await knowledgeWeb.search(question);
  // Only log an actual bypass (when enabled) — a disabled probe isn't an event.
  if (out.enabled) {
    await audit.record({
      tenantId: req.user.tenant_id, actorId: req.user.id, agent: 'Ira',
      action: 'Knowledge web-reference lookup (external)', decision: 'created',
      entityType: 'knowledge', entityId: null, source: out.source,
      summary: question.slice(0, 200), metadata: { external: true, count: out.references.length },
    });
  }
  res.json(out);
};
