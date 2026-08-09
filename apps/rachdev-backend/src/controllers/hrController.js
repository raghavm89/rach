'use strict';

/**
 * HR controller — serves the HR vertical's tenant-scoped data (migration 053).
 * Returns domain objects in the same shape the screens render, so the frontend
 * moves from bundled demo JSON to real data with a fetch swap.
 */

const { Hr, Settings, AgentDefinition } = require('@rach/core');
const { gateway } = require('@rach/llm');
const { getTenantModel } = require('../services/tenantLlm');
const hrOps = require('../services/hrOps');

function lpa(n) { return `₹${Math.round((Number(n) || 0) / 100000)}`; }

// Canned JD used when LLM_MOCK is on (so the flow demos without an API call).
function buildMockJd(r) {
  const band = r.compBandINR ? `${lpa(r.compBandINR.min)}–${lpa(r.compBandINR.max)} LPA` : 'as per band';
  const must = Array.isArray(r.mustHaves) ? r.mustHaves.join(', ') : '';
  return `# ${r.title || 'Role'}

**Team:** ${r.dept || '—'} · **Location:** ${r.location || '—'} (${r.workMode || '—'}) · **Compensation:** ${band}

## About the role
We're hiring a ${r.title || 'candidate'} to join our ${r.dept || 'team'}. This is a ${r.workMode || ''} role based in ${r.location || '—'}.

## Responsibilities
- Own and deliver core work for the team
- Collaborate across functions to ship reliably
- Uphold quality, correctness, and good documentation

## Requirements
- ${r.minExperienceYears || 0}+ years of relevant experience
- ${must || 'Relevant skills for the role'}
- Able to join within ${r.noticeNeedDays || 30} days

## What we offer
Competitive compensation (${band}), a collaborative team, and room to grow.

_Draft generated in mock mode — a human reviews and approves before this is posted._`;
}

// Deterministic bias-language lint (the bias-lint agent's deterministic core).
const BIAS_TERMS = [
  { term: 'rockstar', reason: 'Aggressive jargon is shown to reduce application rates from qualified women candidates.', rewrite: 'exceptional' },
  { term: 'ninja', reason: 'Jargon that narrows the applicant pool.', rewrite: 'skilled' },
  { term: 'guru', reason: 'Jargon that can exclude candidates.', rewrite: 'expert' },
  { term: 'young and energetic', reason: 'Age-coded language — risks age discrimination and narrows the applicant pool.', rewrite: 'collaborative and driven' },
  { term: 'aggressive', reason: 'Aggressive framing can deter qualified applicants.', rewrite: 'proactive' },
  { term: 'high-energy', reason: 'Age-coded language that narrows the pool.', rewrite: 'motivated' },
];
function lintBias(text) {
  const t = (text || '').toLowerCase();
  return BIAS_TERMS.filter((b) => t.includes(b.term)).map((b) => ({ phrase: b.term, reason: b.reason, rewrite: b.rewrite }));
}

// Approval chain, creator-aware: the submitter and any step at/below the
// creator's role are auto-approved (you don't approve your own draft), so the
// queue routes to the next reviewer above them.
const CHAIN_ROLES = ['project_manager', 'hr_executive', 'hr_director'];
function buildChain(creatorRole, name, now) {
  const idx = CHAIN_ROLES.indexOf(creatorRole);
  return CHAIN_ROLES.map((role, i) => {
    if (i === 0 || (idx >= 0 && i <= idx)) {
      return {
        role, state: 'approved',
        actedByName: name || 'Hiring manager', actedAt: now,
        comment: i === 0 ? 'Submitted with requisition' : 'Auto-approved (created by this role)',
      };
    }
    return { role, state: 'pending' };
  });
}

// POST /api/hr/jd/draft — run the JD-writer agent for a requisition and route a
// jd_approval into the approval chain. Uses the LLM gateway (real or mock).
exports.draftJd = async (req, res) => {
  if (req.user.tenant_id == null) return res.status(400).json({ error: 'No workspace provisioned' });
  const r = (req.body && req.body.requisition) || {};
  if (!r.title) return res.status(400).json({ error: 'requisition.title is required' });

  let def = null;
  try { def = await AgentDefinition.findByKey(req.user.tenant_id, 'hr-jd-writer'); } catch { /* optional */ }
  const system = (def && def.prompt)
    || 'You draft inclusive job descriptions for Indian mid-market roles from the provided facts. Output a clear JD in Markdown with sections: About the role, Responsibilities, Requirements, Nice to have, What we offer. Use only the facts given. You draft; a human approves before it is posted.';

  const facts = [
    `Role: ${r.title}`, `Department: ${r.dept || '—'}`,
    `Location: ${r.location || '—'} (${r.workMode || '—'})`,
    r.compBandINR ? `Comp band: ${lpa(r.compBandINR.min)}–${lpa(r.compBandINR.max)} LPA` : null,
    `Min experience: ${r.minExperienceYears || 0} years`,
    `Joining need: ${r.noticeNeedDays || 30} days`,
    Array.isArray(r.mustHaves) && r.mustHaves.length ? `Must-haves: ${r.mustHaves.join(', ')}` : null,
  ].filter(Boolean).join('\n');

  const result = await gateway.chat({
    tenantId: req.user.tenant_id, userId: req.user.id,
    model: (await getTenantModel(req.user.tenant_id)) || def?.model || undefined,
    system,
    messages: [{ role: 'user', content: `Draft a job description from these facts:\n${facts}` }],
    description: 'HR: draft JD',
    mock: buildMockJd(r),
  });
  const jd = result.text;

  const now = new Date().toISOString();
  const chain = buildChain(req.user.role, req.user.name, now);
  const anyPending = chain.some((s) => s.state === 'pending');
  const approval = await Hr.create('approvals', req.user.tenant_id, {
    type: 'jd_approval', subjectId: r.id,
    title: `JD — ${r.title}`,
    summary: `AI-drafted job description for ${r.id || 'new requisition'}.${anyPending ? ' Awaiting human review.' : ' Approved by creator.'}`,
    state: anyPending ? 'pending' : 'approved',
    ...(anyPending ? {} : { resolvedAt: now }),
    createdByName: req.user.name || 'Recruiter', createdAt: now,
    chain,
    biasFlags: lintBias(jd),
    jd,
  });

  res.json({ jd, approval, model: result.model });
};

// POST /api/hr/approvals/:id/act — approve or request changes on the current step.
exports.actApproval = async (req, res) => {
  if (req.user.tenant_id == null) return res.status(400).json({ error: 'No workspace provisioned' });
  const { action, comment } = req.body || {};
  if (!['approve', 'request_changes'].includes(action)) {
    return res.status(400).json({ error: 'action must be "approve" or "request_changes"' });
  }
  const task = await Hr.getOne('approvals', req.user.tenant_id, req.params.id);
  if (!task) return res.status(404).json({ error: 'Approval not found' });
  if (task.state !== 'pending') return res.status(409).json({ error: 'This approval is already resolved' });

  const chain = Array.isArray(task.chain) ? task.chain : [];
  const stepIdx = chain.findIndex((s) => s.state === 'pending');
  if (stepIdx === -1) return res.status(409).json({ error: 'Nothing pending to act on' });

  const step = chain[stepIdx];
  const isAdmin = ['admin', 'tenant_admin'].includes(req.user.role);
  if (step.role !== req.user.role && !isAdmin) {
    return res.status(403).json({ error: `This step is waiting on ${step.role}` });
  }

  const now = new Date().toISOString();
  const by = req.user.name || req.user.role;
  if (action === 'request_changes') {
    chain[stepIdx] = { ...step, state: 'changes_requested', actedByName: by, actedAt: now, comment: comment || 'Changes requested' };
    task.chain = chain; // leaves the reviewer's queue; goes back for a revision
  } else {
    chain[stepIdx] = { ...step, state: 'approved', actedByName: by, actedAt: now, comment: comment || '' };
    task.chain = chain;
    if (!chain.some((s) => s.state === 'pending')) { task.state = 'approved'; task.resolvedAt = now; }
  }
  const saved = await Hr.create('approvals', req.user.tenant_id, task);
  // Fire downstream effects for Layer 2–4 approval types (issue letter, deduct
  // leave, confirm employee) once the whole chain has cleared.
  await hrOps.applyApprovalSideEffects(req.user.tenant_id, saved, req.user);
  res.json({ approval: saved });
};

// DELETE /api/hr/:entity/:id — remove one record (gated to HR Director / admin).
exports.remove = async (req, res) => {
  const { entity, id } = req.params;
  if (!Hr.ENTITIES.includes(entity)) return res.status(404).json({ error: `Unknown HR entity: ${entity}` });
  if (req.user.tenant_id == null) return res.status(400).json({ error: 'No workspace provisioned' });
  const ok = await Hr.remove(entity, req.user.tenant_id, id);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
};

const HR_CONFIG_KEY = 'hr.settings';

// Server-side defaults a fresh tenant starts from; stored values override these.
const HR_DEFAULTS = {
  aiFeatures: {
    'jd.generate': true, 'jd.biasLint': true, 'screening.score': true,
    'screening.rejectionEmail': true, 'voice.scorecardSummary': true,
    'offer.letterDraft': true, 'assist.candidateQA': true,
  },
  policyGates: { comp_band: true, knockout: true, rejection_delay: true },
  integrations: {
    naukri: 'connected', careers: 'connected', linkedin: 'available', indeed: 'available',
    greenhouse: 'available', keka: 'connected', darwinbox: 'available',
    greythr: 'available', springverify: 'connected',
  },
};

function mergeConfig(stored) {
  const s = stored || {};
  return {
    aiFeatures: { ...HR_DEFAULTS.aiFeatures, ...(s.aiFeatures || {}) },
    policyGates: { ...HR_DEFAULTS.policyGates, ...(s.policyGates || {}) },
    integrations: { ...HR_DEFAULTS.integrations, ...(s.integrations || {}) },
  };
}

// GET /api/hr/:entity — one entity's rows for the caller's tenant.
exports.list = async (req, res) => {
  const { entity } = req.params;
  if (!Hr.ENTITIES.includes(entity)) {
    return res.status(404).json({ error: `Unknown HR entity: ${entity}` });
  }
  if (req.user.tenant_id == null) return res.json({ [entity]: [] });
  const data = await Hr.list(entity, req.user.tenant_id);
  res.json({ [entity]: data });
};

// POST /api/hr/:entity — create one record for the caller's tenant.
exports.create = async (req, res) => {
  const { entity } = req.params;
  if (!Hr.ENTITIES.includes(entity)) {
    return res.status(404).json({ error: `Unknown HR entity: ${entity}` });
  }
  if (req.user.tenant_id == null) {
    return res.status(400).json({ error: 'No workspace provisioned for this account' });
  }
  const created = await Hr.create(entity, req.user.tenant_id, req.body || {});
  res.status(201).json({ item: created });
};

// GET /api/hr/config — workspace settings (AI features, policy gates, integrations).
exports.getConfig = async (req, res) => {
  if (req.user.tenant_id == null) return res.json({ config: mergeConfig(null) });
  const stored = await Settings.get(req.user.tenant_id, HR_CONFIG_KEY);
  res.json({ config: mergeConfig(stored) });
};

// PUT /api/hr/config — merge a patch into the stored settings and persist.
exports.patchConfig = async (req, res) => {
  if (req.user.tenant_id == null) return res.status(400).json({ error: 'No workspace provisioned' });
  const stored = (await Settings.get(req.user.tenant_id, HR_CONFIG_KEY)) || {};
  const patch = req.body || {};
  const next = {
    aiFeatures: { ...(stored.aiFeatures || {}), ...(patch.aiFeatures || {}) },
    policyGates: { ...(stored.policyGates || {}), ...(patch.policyGates || {}) },
    integrations: { ...(stored.integrations || {}), ...(patch.integrations || {}) },
  };
  await Settings.set(req.user.tenant_id, HR_CONFIG_KEY, next);
  res.json({ config: mergeConfig(next) });
};

// GET /api/hr/summary — per-entity counts (dashboard convenience).
exports.summary = async (req, res) => {
  if (req.user.tenant_id == null) return res.json({ counts: {} });
  res.json({ counts: await Hr.counts(req.user.tenant_id) });
};