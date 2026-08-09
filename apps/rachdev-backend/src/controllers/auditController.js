'use strict';

/**
 * Audit Log + Control Tower reads. The write path lives in services/audit.js and
 * is called from the clinical controllers; this only exposes the trail.
 */

const audit = require('../services/audit');

// GET /api/audit?agent=&decision=&q=&limit=&offset=
exports.list = async (req, res) => {
  if (!req.user.tenant_id) return res.json({ entries: [], total: 0, limit: 50, offset: 0 });
  const { agent, decision, q, limit, offset } = req.query;
  const out = await audit.list(req.user.tenant_id, {
    agent: agent || undefined,
    decision: decision || undefined,
    q: q ? String(q).trim() : undefined,
    limit: limit ? Number(limit) : undefined,
    offset: offset ? Number(offset) : undefined,
  });
  res.json(out);
};

// GET /api/audit/summary — roll-ups for the Control Tower tiles
exports.summary = async (req, res) => {
  if (!req.user.tenant_id) return res.json({ total: 0, today: 0, last_at: null, decisions: {}, agents: {} });
  res.json(await audit.summary(req.user.tenant_id));
};
