'use strict';

/**
 * Agent Monitor (org admin) — the RachDev analogue of RachBase's VM Monitor.
 *
 * Aggregates an organization's agent activity into: summary cards, a per-agent
 * table, a recent-activity feed, and health/errors — all scoped to the caller's
 * own tenant (organization). Data comes from clinical_notes, agent_chat_*,
 * and agent_definitions.
 */

const { pool, AgentDefinition, AgentTeam } = require('@rach/core');

// Turn a team's canvas graph into an ordered handoff pipeline: conductor →
// specialists (in edge order) → human handoff. Keeps Control Tower's pipeline in
// lock-step with whatever the org has on the Agent Teams canvas.
function pipelineFromGraph(graph) {
  const nodes = Array.isArray(graph && graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph && graph.edges) ? graph.edges : [];
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const steps = [];
  const step = (n, kind) => n && steps.push({ label: (n.data && n.data.label) || kind, role: (n.data && n.data.role) || '', type: n.type });
  const conductor = nodes.find((n) => n.type === 'conductor');
  if (conductor) {
    step(conductor, 'conductor');
    const outs = edges.filter((e) => e.source === conductor.id).map((e) => byId[e.target]).filter(Boolean);
    outs.filter((n) => n.type === 'specialist').forEach((n) => step(n, 'specialist'));
    step(outs.find((n) => n.type === 'handoff') || nodes.find((n) => n.type === 'handoff'), 'handoff');
  } else {
    nodes.filter((n) => n.type === 'specialist').forEach((n) => step(n, 'specialist'));
    step(nodes.find((n) => n.type === 'handoff'), 'handoff');
  }
  return steps;
}
const DEFAULT_TEAM_KEYS = ['care-team', 'people-team', 'my-first-team'];

// The RachDev agent roster (display names). Scribe + Reception have real data;
// the rest report from their definitions until their flows land.
const ROSTER = [
  { key: 'scribe',    name: 'Naina',  role: 'Clinical Scribe' },
  { key: 'reception', name: 'Asha',   role: 'Reception Intake' },
  { key: 'triage',    name: 'Vihaan', role: 'Triage & Safety' },
  { key: 'knowledge', name: 'Ira',    role: 'Knowledge' },
  { key: 'icu',        name: 'Umeed', role: 'ICU Sentinel' },
  { key: 'coding',     name: 'Rhea',  role: 'Coding & Revenue' },
  { key: 'coordination', name: 'Kabir', role: 'Coordination' },
  { key: 'inventory',  name: 'Kiran', role: 'Pharmacy Inventory' },
];

// Robust to both the old (`enabled` boolean) and new (`status`) definition schema.
function isEnabled(def) {
  if (!def) return true;
  if (typeof def.enabled === 'boolean') return def.enabled;
  if (def.status) return def.status !== 'disabled' && def.status !== 'archived';
  return true;
}

exports.overview = async (req, res) => {
  const tid = req.user.tenant_id;
  if (!tid) {
    return res.json({ summary: null, agents: [], recent: [], pipeline: [], team: null, health: { models: [], drafts_pending: 0, disabled: [] } });
  }

  // The handoff pipeline reflects the org's live Agent Team graph, so edits on
  // the canvas show here too. Seed the default first if the org has none.
  await AgentTeam.ensureDefaultForTenant(tid).catch(() => {});
  const teams = await AgentTeam.listForTenant(tid).catch(() => []);
  const primaryTeam = teams.find((t) => DEFAULT_TEAM_KEYS.includes(t.key)) || teams[0] || null;
  const pipeline = primaryTeam ? pipelineFromGraph(primaryTeam.graph) : [];

  // ── Summary ──
  const [notesAgg, chatAgg, defs] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*)::int                                                   AS total,
         COUNT(*) FILTER (WHERE status = 'draft')::int                   AS drafts,
         COUNT(*) FILTER (WHERE status = 'signed')::int                  AS signed,
         COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW()))::int AS today,
         MAX(created_at)                                                 AS last_run
       FROM clinical_notes WHERE tenant_id = $1`,
      [tid]
    ),
    pool.query(
      `SELECT COALESCE(SUM(m.tokens_used),0)::int  AS tokens,
              COALESCE(SUM(m.credits_used),0)::int AS credits
         FROM agent_chat_messages m
         JOIN agent_chat_sessions s ON s.id = m.session_id
        WHERE s.tenant_id = $1`,
      [tid]
    ),
    AgentDefinition.listForTenant(tid).catch(() => []),
  ]);

  const notes = notesAgg.rows[0];
  const chat = chatAgg.rows[0];
  const defByKey = new Map(defs.map((d) => [d.key, d]));

  // ── Per-agent table ──
  const scribeByDay = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW()))::int AS today,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'signed')::int AS signed,
            MAX(created_at) AS last_run,
            (array_agg(DISTINCT model) FILTER (WHERE model IS NOT NULL)) AS models
       FROM clinical_notes WHERE tenant_id = $1`,
    [tid]
  );
  const s = scribeByDay.rows[0];

  // Reception (Asha) — encounters
  const encByDay = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW()))::int AS today,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed,
            MAX(created_at) AS last_run,
            (array_agg(DISTINCT model) FILTER (WHERE model IS NOT NULL)) AS models
       FROM encounters WHERE tenant_id = $1`,
    [tid]
  );
  const e = encByDay.rows[0];

  // Inventory (Kiran) — dispenses + open shortage alerts
  const [dispAgg, alertAgg] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW()))::int AS today,
              COUNT(*)::int AS total, MAX(created_at) AS last_run
         FROM stock_transactions WHERE tenant_id = $1 AND reason = 'dispense'`, [tid]),
    pool.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'open')::int AS open FROM reorder_alerts WHERE tenant_id = $1`, [tid]),
  ]);
  const inv = dispAgg.rows[0];
  const openAlerts = alertAgg.rows[0].open;

  // Triage (Vihaan) — assessments; Knowledge (Ira) — approved library + activity
  const [triageAgg, knowAgg] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW()))::int AS today,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'acknowledged')::int AS acked,
              MAX(created_at) AS last_run,
              (array_agg(DISTINCT model) FILTER (WHERE model IS NOT NULL)) AS models
         FROM triage_assessments WHERE tenant_id = $1`, [tid]).catch(() => ({ rows: [{}] })),
    pool.query(
      `SELECT COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW()))::int AS today,
              COUNT(*)::int AS total, MAX(updated_at) AS last_run
         FROM knowledge_docs WHERE tenant_id = $1`, [tid]).catch(() => ({ rows: [{}] })),
  ]);
  const tri = triageAgg.rows[0] || {};
  const kno = knowAgg.rows[0] || {};

  // ICU (Umeed) — alerts fired + open
  const icuAgg = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW()))::int AS today,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'open')::int AS open,
            MAX(created_at) AS last_run
       FROM icu_alerts WHERE tenant_id = $1`, [tid]).catch(() => ({ rows: [{}] }));
  const icu = icuAgg.rows[0] || {};

  // Coding (Rhea) — claims drafted + submitted
  const claimAgg = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW()))::int AS today,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'submitted')::int AS submitted,
            MAX(created_at) AS last_run
       FROM claims WHERE tenant_id = $1`, [tid]).catch(() => ({ rows: [{}] }));
  const clm = claimAgg.rows[0] || {};

  // Coordination (Kabir) — referrals + discharge summaries + bed moves
  const coordAgg = await pool.query(
    `SELECT (SELECT COUNT(*) FROM referrals WHERE tenant_id=$1)::int AS referrals,
            (SELECT COUNT(*) FROM discharge_summaries WHERE tenant_id=$1)::int AS discharges,
            (SELECT COUNT(*) FROM referrals WHERE tenant_id=$1 AND created_at >= date_trunc('day', NOW()))::int
            + (SELECT COUNT(*) FROM discharge_summaries WHERE tenant_id=$1 AND created_at >= date_trunc('day', NOW()))::int AS today,
            GREATEST(
              COALESCE((SELECT MAX(created_at) FROM referrals WHERE tenant_id=$1), 'epoch'),
              COALESCE((SELECT MAX(created_at) FROM discharge_summaries WHERE tenant_id=$1), 'epoch')
            ) AS last_run`, [tid]).catch(() => ({ rows: [{}] }));
  const coord = coordAgg.rows[0] || {};

  const agents = ROSTER.map((a) => {
    const def = defByKey.get(a.key);
    const enabled = isEnabled(def);
    if (a.key === 'scribe') {
      return {
        ...a, enabled,
        status: !enabled ? 'disabled' : (s.today > 0 ? 'active' : 'idle'),
        runs_today: s.today, runs_total: s.total, signed: s.signed,
        success_rate: s.total > 0 ? Math.round((s.signed / s.total) * 100) : null,
        last_run: s.last_run,
        model: (s.models && s.models[0]) || def?.model || 'claude (gateway default)',
      };
    }
    if (a.key === 'reception') {
      return {
        ...a, enabled,
        status: !enabled ? 'disabled' : (e.today > 0 ? 'active' : 'idle'),
        runs_today: e.today, runs_total: e.total, signed: e.confirmed,
        success_rate: e.total > 0 ? Math.round((e.confirmed / e.total) * 100) : null,
        last_run: e.last_run,
        model: (e.models && e.models[0]) || def?.model || 'claude (gateway default)',
      };
    }
    if (a.key === 'triage') {
      return {
        ...a, enabled,
        status: !enabled ? 'disabled' : ((tri.today || 0) > 0 ? 'active' : 'idle'),
        runs_today: tri.today || 0, runs_total: tri.total || 0, signed: tri.acked || 0,
        success_rate: tri.total > 0 ? Math.round((tri.acked / tri.total) * 100) : null,
        last_run: tri.last_run || null,
        model: (tri.models && tri.models[0]) || def?.model || 'claude (gateway default)',
      };
    }
    if (a.key === 'knowledge') {
      return {
        ...a, enabled,
        status: !enabled ? 'disabled' : ((kno.total || 0) > 0 ? 'active' : 'idle'),
        runs_today: kno.today || 0, runs_total: kno.total || 0, signed: 0, success_rate: null,
        last_run: kno.last_run || null,
        model: def?.model || 'claude (gateway default)',
      };
    }
    if (a.key === 'icu') {
      return {
        ...a, enabled,
        status: !enabled ? 'disabled' : ((icu.open || 0) > 0 ? 'active' : (icu.today || 0) > 0 ? 'active' : 'idle'),
        runs_today: icu.today || 0, runs_total: icu.total || 0, signed: (icu.total || 0) - (icu.open || 0),
        success_rate: null, last_run: icu.last_run || null,
        model: def?.model || 'rules + claude (gateway default)',
      };
    }
    if (a.key === 'coding') {
      return {
        ...a, enabled,
        status: !enabled ? 'disabled' : ((clm.today || 0) > 0 ? 'active' : 'idle'),
        runs_today: clm.today || 0, runs_total: clm.total || 0, signed: clm.submitted || 0,
        success_rate: clm.total > 0 ? Math.round((clm.submitted / clm.total) * 100) : null,
        last_run: clm.last_run || null,
        model: def?.model || 'claude (gateway default)',
      };
    }
    if (a.key === 'coordination') {
      const total = (coord.referrals || 0) + (coord.discharges || 0);
      const lastRun = coord.last_run && new Date(coord.last_run).getFullYear() > 1971 ? coord.last_run : null;
      return {
        ...a, enabled,
        status: !enabled ? 'disabled' : ((coord.today || 0) > 0 ? 'active' : 'idle'),
        runs_today: coord.today || 0, runs_total: total, signed: 0, success_rate: null,
        last_run: lastRun, model: def?.model || 'claude (gateway default)',
      };
    }
    if (a.key === 'inventory') {
      return {
        ...a, enabled,
        status: !enabled ? 'disabled' : (inv.today > 0 || openAlerts > 0 ? 'active' : 'idle'),
        runs_today: inv.today, runs_total: inv.total, signed: 0, success_rate: null,
        last_run: inv.last_run,
        model: def?.model || 'rules-based',
      };
    }
    return {
      ...a, enabled,
      status: !enabled ? 'disabled' : 'idle',
      runs_today: 0, runs_total: 0, signed: 0, success_rate: null,
      last_run: null,
      model: def?.model || 'claude (gateway default)',
    };
  });

  // ── Recent activity (notes + encounters, merged by time) ──
  const [recentNotes, recentEnc] = await Promise.all([
    pool.query(
      `SELECT cn.patient_ref, cn.status, cn.model, cn.source, cn.created_at, u.name AS author
         FROM clinical_notes cn LEFT JOIN users u ON u.id = cn.author_id
        WHERE cn.tenant_id = $1 ORDER BY cn.created_at DESC LIMIT 10`, [tid]),
    pool.query(
      `SELECT en.patient_ref, en.patient_name, en.status, en.model, en.source, en.created_at, u.name AS author
         FROM encounters en LEFT JOIN users u ON u.id = en.created_by
        WHERE en.tenant_id = $1 ORDER BY en.created_at DESC LIMIT 10`, [tid]),
  ]);
  const recent = [
    ...recentNotes.rows.map((r) => ({
      agent: 'Naina', kind: 'SOAP note', ref: r.patient_ref,
      status: r.status, model: r.model, source: r.source, author: r.author, at: r.created_at,
    })),
    ...recentEnc.rows.map((r) => ({
      agent: 'Asha', kind: 'Intake', ref: r.patient_ref || r.patient_name,
      status: r.status, model: r.model, source: r.source, author: r.author, at: r.created_at,
    })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 12);

  // ── Health / errors ──
  const models = Array.from(new Set([...(s.models || []), ...(e.models || [])]));
  const disabled = agents.filter((a) => !a.enabled).map((a) => a.name);

  res.json({
    summary: {
      active_agents: agents.filter((a) => a.enabled && a.status !== 'disabled').length,
      runs_today: notes.today + e.today,
      notes_draft: notes.drafts,
      notes_signed: notes.signed,
      tokens_used: chat.tokens,
      credits_used: chat.credits,
      last_run: notes.last_run,
    },
    agents,
    recent,
    pipeline,
    team: primaryTeam ? { id: primaryTeam.id, name: primaryTeam.name, key: primaryTeam.key } : null,
    health: { models, drafts_pending: notes.drafts, shortage_alerts: openAlerts, disabled },
  });
};
