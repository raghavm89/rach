'use strict';

/**
 * HR Ops controller (Layers 2–4: Onboard · Operate · Discover).
 *
 * Serves the employee lifecycle modules — onboarding, probation, leave,
 * letters, helpdesk, reviews, partnerships, announcements — on top of the same
 * tenant-scoped JSONB data layer as Layer 1. AI drafts route through the LLM
 * gateway with deterministic mock fallback (LLM_MOCK), and every mutation
 * writes an audit event. Approval-driven flows create tasks in hr_approvals so
 * they surface in the existing Approvals inbox.
 */

const fs = require('fs');
const path = require('path');
const { Hr } = require('@rach/core');
const { gateway } = require('@rach/llm');
const { getTenantModel } = require('../services/tenantLlm');
const hrOps = require('../services/hrOps');

const FAQ = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'hr-faq.json'), 'utf8'));

const tid = (req) => req.user.tenant_id;
const noWorkspace = (res) => res.status(400).json({ error: 'No workspace provisioned' });

/** Run an AI draft through the gateway; `mock` is the deterministic fallback. */
async function draft(req, { system, user, mock, description }) {
  const result = await gateway.chat({
    tenantId: req.user.tenant_id,
    userId: req.user.id,
    model: (await getTenantModel(req.user.tenant_id)) || undefined,
    system,
    messages: [{ role: 'user', content: user }],
    description,
    mock,
  });
  return result.text;
}

/* ============================ Onboarding ============================ */

exports.toggleChecklistItem = async (req, res) => {
  if (tid(req) == null) return noWorkspace(res);
  const plan = await Hr.getOne('onboarding', tid(req), req.params.id);
  const item = plan && (plan.checklist || []).find((c) => c.id === req.body.itemId);
  if (!plan || !item) return res.status(404).json({ error: 'Plan or item not found' });
  if (item.status === 'pending') {
    item.status = 'done'; item.doneAt = hrOps.nowIso(); item.doneByName = req.user.name;
  } else {
    item.status = 'pending'; delete item.doneAt; delete item.doneByName;
  }
  const saved = await Hr.create('onboarding', tid(req), plan);
  await hrOps.audit(tid(req), {
    actor: 'user', actorName: req.user.name, actorRole: req.user.role,
    action: item.status === 'done' ? 'onboarding.checklist_completed' : 'onboarding.checklist_reopened',
    subjectType: 'onboarding', subjectId: plan.id, detail: `${item.item} — ${plan.joinerName}`,
  });
  res.json({ item: saved });
};

exports.sendInvites = async (req, res) => {
  if (tid(req) == null) return noWorkspace(res);
  const plan = await Hr.getOne('onboarding', tid(req), req.params.id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  const pending = (plan.invites || []).filter((i) => i.status === 'not_sent');
  if (!pending.length) return res.status(409).json({ error: 'All invites already sent' });
  pending.forEach((i) => { i.status = 'invited'; });
  const saved = await Hr.create('onboarding', tid(req), plan);
  await hrOps.audit(tid(req), {
    actor: 'system', actorName: hrOps.COMPANY, action: 'onboarding.invites_sent',
    subjectType: 'onboarding', subjectId: plan.id,
    detail: `${pending.length} group invites sent (simulated) for ${plan.joinerName} — triggered by ${req.user.name}`,
  });
  res.json({ item: saved });
};

exports.generateInductionKit = async (req, res) => {
  if (tid(req) == null) return noWorkspace(res);
  const plan = await Hr.getOne('onboarding', tid(req), req.params.id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  const emp = plan.employeeId ? await Hr.getOne('employees', tid(req), plan.employeeId) : null;
  const input = {
    employeeName: plan.joinerName, title: emp?.title ?? 'your new role',
    dept: emp?.dept ?? 'your team', managerName: plan.day1?.reportingTo,
    buddyName: plan.buddyName, joinDate: plan.day1?.date,
  };
  const body = await draft(req, {
    system: 'You write a warm, concrete induction kit for a new joiner from the facts provided. Markdown-lite, no invented facts. A human approves before it is shared.',
    user: `Draft an induction kit for ${plan.joinerName} joining ${input.dept}, reporting to ${input.managerName}, buddy ${input.buddyName}, start ${input.joinDate}.`,
    mock: hrOps.mockInductionKit(input), description: 'HR: induction kit',
  });
  plan.inductionKit = {
    body, status: 'draft',
    modules: [
      { key: 'posh', label: 'POSH awareness', mandatory: true, status: 'pending' },
      { key: 'code_of_conduct', label: 'Code of conduct', mandatory: true, status: 'pending' },
      { key: 'infosec', label: 'Information security basics', mandatory: true, status: 'pending' },
    ],
  };
  const saved = await Hr.create('onboarding', tid(req), plan);
  await hrOps.audit(tid(req), {
    ...hrOps.AI_ACTOR, action: 'onboarding.induction_kit_generated',
    subjectType: 'onboarding', subjectId: plan.id, detail: `Induction kit drafted for ${plan.joinerName}`,
    modelVersion: 'mock',
  });
  res.json({ item: saved });
};

exports.approveInductionKit = async (req, res) => {
  if (tid(req) == null) return noWorkspace(res);
  const plan = await Hr.getOne('onboarding', tid(req), req.params.id);
  if (!plan?.inductionKit) return res.status(404).json({ error: 'No induction kit to approve' });
  plan.inductionKit.status = 'approved';
  plan.inductionKit.approvedByName = req.user.name;
  plan.inductionKit.approvedAt = hrOps.nowIso();
  const saved = await Hr.create('onboarding', tid(req), plan);
  await hrOps.audit(tid(req), {
    actor: 'user', actorName: req.user.name, actorRole: req.user.role,
    action: 'onboarding.induction_kit_approved', subjectType: 'onboarding', subjectId: plan.id,
    detail: `Induction kit approved for ${plan.joinerName}`,
  });
  res.json({ item: saved });
};

exports.completeModule = async (req, res) => {
  if (tid(req) == null) return noWorkspace(res);
  const plan = await Hr.getOne('onboarding', tid(req), req.params.id);
  const mod = plan?.inductionKit?.modules.find((m) => m.key === req.body.moduleKey);
  if (!plan || !mod || mod.status === 'completed') return res.status(404).json({ error: 'Module not found' });
  mod.status = 'completed'; mod.completedAt = hrOps.nowIso();
  const saved = await Hr.create('onboarding', tid(req), plan);
  await hrOps.audit(tid(req), {
    actor: 'user', actorName: req.user.name, actorRole: req.user.role,
    action: 'onboarding.module_completed', subjectType: 'onboarding', subjectId: plan.id,
    detail: `${mod.label} completed — ${plan.joinerName}`,
  });
  res.json({ item: saved });
};

/* ============================ Probation ============================ */

exports.recordCheckIn = async (req, res) => {
  if (tid(req) == null) return noWorkspace(res);
  const cp = await Hr.getOne('probation', tid(req), req.params.id);
  const notes = (req.body.notes || '').trim();
  if (!cp || !notes) return res.status(400).json({ error: 'Checkpoint and notes are required' });
  const emp = await Hr.getOne('employees', tid(req), cp.employeeId);
  Object.assign(cp, {
    status: 'completed', completedAt: hrOps.nowIso(),
    checkIn: { notes, byName: req.user.name, at: hrOps.nowIso() },
  });
  const saved = await Hr.create('probation', tid(req), cp);
  await hrOps.audit(tid(req), {
    actor: 'user', actorName: req.user.name, actorRole: req.user.role,
    action: 'probation.checkin_completed', subjectType: 'probation', subjectId: cp.id,
    detail: `Day-${cp.day} check-in — ${emp?.name ?? cp.employeeId}`,
  });
  res.json({ item: saved });
};

/** PM submits the evaluation a due 60/90 checkpoint requested via Approvals. */
exports.submitEvaluation = async (req, res) => {
  if (tid(req) == null) return noWorkspace(res);
  const { rating, strengths, growthAreas } = req.body || {};
  const task = await Hr.getOne('approvals', tid(req), req.params.taskId);
  if (!task || task.type !== 'probation_evaluation') return res.status(404).json({ error: 'Evaluation task not found' });
  if (!hrOps.canActOn(task, req.user.role)) return res.status(403).json({ error: 'This evaluation is not assigned to your role' });
  if (!String(strengths || '').trim() || !String(growthAreas || '').trim()) return res.status(400).json({ error: 'Both fields are required' });

  const cp = await Hr.getOne('probation', tid(req), task.subjectId);
  const emp = cp && await Hr.getOne('employees', tid(req), cp.employeeId);
  if (!cp || !emp) return res.status(404).json({ error: 'Checkpoint not found' });

  const step = hrOps.currentStep(task);
  Object.assign(step, { state: 'approved', actedById: req.user.id, actedByName: req.user.name, actedAt: hrOps.nowIso(), comment: `Evaluation submitted (${rating}/5)` });
  if (!task.chain.some((s) => s.state === 'pending')) { task.state = 'approved'; task.resolvedAt = hrOps.nowIso(); }
  await Hr.create('approvals', tid(req), task);

  const plan = (await Hr.byEmployee('onboarding', tid(req), emp.id))[0];
  const pendingModules = plan?.inductionKit?.modules.filter((m) => m.status === 'pending').map((m) => m.label) ?? [];
  const checkinNotes = (await Hr.byEmployee('probation', tid(req), emp.id)).filter((c) => c.checkIn).map((c) => c.checkIn.notes);

  const body = await draft(req, {
    system: 'You write an advisory probation evaluation summary from the manager rating and notes. Neutral, factual, advisory-only. A human confirms the outcome.',
    user: `Summarise the day-${cp.day} evaluation for ${emp.name}: rating ${rating}/5. Strengths: ${strengths}. Growth: ${growthAreas}.`,
    mock: hrOps.mockEvalSummary({ employeeName: emp.name, day: cp.day, rating, strengths, growthAreas, checkinNotes, pendingModules }),
    description: 'HR: probation eval summary',
  });
  cp.evaluation = {
    rating, strengths: String(strengths).trim(), growthAreas: String(growthAreas).trim(),
    submittedByName: req.user.name, submittedAt: hrOps.nowIso(),
    summaryDraft: { body, status: 'draft' },
  };
  const saved = await Hr.create('probation', tid(req), cp);
  await hrOps.audit(tid(req), {
    actor: 'user', actorName: req.user.name, actorRole: req.user.role,
    action: 'probation.evaluation_submitted', subjectType: 'probation', subjectId: cp.id,
    detail: `Day-${cp.day} evaluation for ${emp.name} — ${rating}/5`,
  });
  res.json({ item: saved });
};

exports.approveEvalSummary = async (req, res) => {
  if (tid(req) == null) return noWorkspace(res);
  const cp = await Hr.getOne('probation', tid(req), req.params.id);
  if (!cp?.evaluation?.summaryDraft) return res.status(404).json({ error: 'No summary to approve' });
  cp.evaluation.summaryDraft.status = 'approved';
  cp.evaluation.summaryDraft.approvedByName = req.user.name;
  cp.evaluation.summaryDraft.approvedAt = hrOps.nowIso();
  cp.status = 'completed'; cp.completedAt = hrOps.nowIso();
  const saved = await Hr.create('probation', tid(req), cp);
  await hrOps.audit(tid(req), {
    actor: 'user', actorName: req.user.name, actorRole: req.user.role,
    action: 'probation.summary_approved', subjectType: 'probation', subjectId: cp.id,
    detail: `Day-${cp.day} evaluation summary approved; checkpoint completed`,
  });
  res.json({ item: saved });
};

exports.confirmEmployee = async (req, res) => {
  if (tid(req) == null) return noWorkspace(res);
  const emp = await Hr.getOne('employees', tid(req), req.params.id);
  if (!emp || emp.status !== 'probation') return res.status(409).json({ error: 'Not on probation' });
  const existing = (await Hr.byEmployee('letters', tid(req), emp.id)).some((l) => l.kind === 'confirmation' && l.status !== 'rejected');
  if (existing) return res.status(409).json({ error: 'A confirmation letter already exists' });

  const serial = await Hr.nextSerial(tid(req), 'MER/HR');
  const body = await draft(req, {
    system: 'You write a formal employment confirmation letter from the facts provided. No invented terms. A human approves before it issues.',
    user: `Confirmation letter for ${emp.name} (${emp.empCode}), ${emp.title}, ${emp.dept}, joined ${emp.joinDate}. Serial ${serial}.`,
    mock: hrOps.mockSelfServiceLetter({ kind: 'confirmation', employeeName: emp.name, empCode: emp.empCode, title: emp.title, dept: emp.dept, joinDate: emp.joinDate, serial, issuerName: 'Rajesh Menon\nHR Director' }),
    description: 'HR: confirmation letter',
  });
  const letter = {
    id: hrOps.nextId('LTR'), employeeId: emp.id, kind: 'confirmation', serial,
    status: 'pending_approval', body, requestedAt: hrOps.nowIso(),
    note: 'Probation completed — day-90 outcome: confirm',
  };
  await Hr.create('letters', tid(req), letter);

  const chainRoles = hrOps.resolveChain('confirmation_letter');
  const task = {
    id: hrOps.nextId('APR'), type: 'confirmation_letter', subjectId: letter.id,
    title: `Confirmation letter — ${emp.name}`,
    summary: `Probation completed (${emp.title}, joined ${emp.joinDate}). AI-drafted confirmation letter for approval; issues into the employee's letters on sign-off.`,
    state: 'pending', createdById: req.user.id, createdByName: req.user.name, createdAt: hrOps.nowIso(),
    chain: hrOps.buildChainSteps(chainRoles), meta: { employeeId: emp.id },
  };
  await Hr.create('approvals', tid(req), task);
  await Hr.update('letters', tid(req), letter.id, { approvalTaskId: task.id });

  await hrOps.audit(tid(req), {
    actor: 'user', actorName: req.user.name, actorRole: req.user.role,
    action: 'probation.outcome_confirm', subjectType: 'employee', subjectId: emp.id,
    detail: `${emp.name} — confirmation initiated; letter ${serial} sent for approval`,
  });
  res.json({ ok: true, letterId: letter.id, approvalId: task.id });
};

exports.extendProbation = async (req, res) => {
  if (tid(req) == null) return noWorkspace(res);
  const { reason, newEndDate } = req.body || {};
  if (!String(reason || '').trim() || !newEndDate) return res.status(400).json({ error: 'Reason and new end date are required' });
  const emp = await Hr.getOne('employees', tid(req), req.params.id);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });
  await Hr.update('employees', tid(req), emp.id, { probationExtendedTo: newEndDate });
  const day90 = (await Hr.byEmployee('probation', tid(req), emp.id)).find((c) => c.day === 90);
  if (day90 && day90.status !== 'completed') {
    await Hr.update('probation', tid(req), day90.id, { due: newEndDate, status: 'pending' });
  }
  await hrOps.audit(tid(req), {
    actor: 'user', actorName: req.user.name, actorRole: req.user.role,
    action: 'probation.outcome_extend', subjectType: 'employee', subjectId: emp.id,
    detail: `${emp.name} — probation extended to ${newEndDate}. Reason: ${String(reason).trim()}`,
  });
  res.json({ ok: true });
};

exports.initiateTermination = async (req, res) => {
  if (tid(req) == null) return noWorkspace(res);
  const { reason, counselAck } = req.body || {};
  if (req.user.role !== 'hr_director') return res.status(403).json({ error: 'Only the HR Director can initiate termination' });
  if (!counselAck) return res.status(400).json({ error: 'The reviewed-with-counsel acknowledgment is required' });
  if (!String(reason || '').trim()) return res.status(400).json({ error: 'A documented reason is required' });
  const emp = await Hr.getOne('employees', tid(req), req.params.id);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  const chainRoles = hrOps.resolveChain('probation_termination');
  const task = {
    id: hrOps.nextId('APR'), type: 'probation_termination', subjectId: emp.id,
    title: `Probation termination — ${emp.name}`,
    summary: 'Static policy template (never AI-drafted). Nothing is sent automatically at any step.',
    state: 'pending', createdById: req.user.id, createdByName: req.user.name, createdAt: hrOps.nowIso(),
    chain: hrOps.buildChainSteps(chainRoles), meta: { employeeId: emp.id, reason: String(reason).trim(), counselAck: true },
  };
  await Hr.create('approvals', tid(req), task);
  await hrOps.audit(tid(req), {
    actor: 'user', actorName: req.user.name, actorRole: req.user.role,
    action: 'probation.termination_initiated', subjectType: 'employee', subjectId: emp.id,
    detail: `${emp.name} — termination initiated with counsel-review acknowledgment. Requires ${chainRoles.join(' → ')} approval; letter is a static policy template, never auto-sent.`,
  });
  res.json({ ok: true, approvalId: task.id });
};

/* ============================ Leave (employee) ============================ */

exports.applyLeave = async (req, res) => {
  if (tid(req) == null) return noWorkspace(res);
  const { type, from, to, reason } = req.body || {};
  const emp = await hrOps.resolveMyEmployee(tid(req), req.user);
  if (!emp) return res.status(404).json({ error: 'No employee record linked to this user' });

  const holidays = await Hr.list('holidays', tid(req));
  const workingDays = hrOps.countWorkingDays(from, to, holidays);
  if (!workingDays) return res.status(400).json({ error: 'The selected range has no working days' });

  const bal = await Hr.getOne('leave_balances', tid(req), emp.id);
  const bucket = bal?.balances?.[type];
  if (!bucket) return res.status(400).json({ error: 'No leave balance found' });
  const available = bucket.entitled - bucket.used;
  if (available < workingDays) return res.status(409).json({ error: `Only ${available} ${type} leave day(s) available` });

  const request = {
    id: hrOps.nextId('LVE'), employeeId: emp.id, type, from, to, workingDays,
    reason: String(reason || '').trim() || undefined, status: 'pending', appliedAt: hrOps.nowIso(),
  };
  await Hr.create('leave', tid(req), request);

  const chainRoles = hrOps.resolveChain('leave_request');
  const task = {
    id: hrOps.nextId('APR'), type: 'leave_request', subjectId: request.id,
    title: `Leave — ${emp.name} (${workingDays} day${workingDays > 1 ? 's' : ''} ${type}, ${from}${from !== to ? ` → ${to}` : ''})`,
    summary: `${type} leave · ${workingDays} working day(s) after excluding weekends and holidays. Balance after approval: ${available - workingDays} of ${bucket.entitled}.`,
    state: 'pending', createdByName: emp.name, createdAt: hrOps.nowIso(),
    chain: hrOps.buildChainSteps(chainRoles), meta: { employeeId: emp.id },
  };
  await Hr.create('approvals', tid(req), task);
  await Hr.update('leave', tid(req), request.id, { approvalTaskId: task.id });

  await hrOps.audit(tid(req), {
    actor: 'user', actorName: emp.name, actorRole: 'employee',
    action: 'leave.applied', subjectType: 'leave', subjectId: request.id,
    detail: `${type} leave ${from} → ${to} (${workingDays} working days)`,
  });
  res.json({ ok: true, requestId: request.id, workingDays });
};

/* ============================ Letters (employee) ============================ */

exports.requestLetter = async (req, res) => {
  if (tid(req) == null) return noWorkspace(res);
  const { kind, note } = req.body || {};
  if (kind === 'confirmation') return res.status(400).json({ error: 'Confirmation letters are issued by HR at probation completion' });
  const emp = await hrOps.resolveMyEmployee(tid(req), req.user);
  if (!emp) return res.status(404).json({ error: 'No employee record linked to this user' });

  const serial = await Hr.nextSerial(tid(req), 'MER/HR');
  const body = await draft(req, {
    system: 'You write a formal HR letter (employment verification or address proof) from the facts provided. No invented facts. A human approves before it issues.',
    user: `${kind} letter for ${emp.name} (${emp.empCode}), ${emp.title}, ${emp.dept}, joined ${emp.joinDate}. Serial ${serial}.${note ? ` Purpose: ${note}.` : ''}`,
    mock: hrOps.mockSelfServiceLetter({ kind, employeeName: emp.name, empCode: emp.empCode, title: emp.title, dept: emp.dept, joinDate: emp.joinDate, serial, issuerName: 'Ananya Iyer\nHR Executive — People Ops', note: String(note || '').trim() || undefined }),
    description: 'HR: self-service letter',
  });
  const letter = {
    id: hrOps.nextId('LTR'), employeeId: emp.id, kind, serial, status: 'pending_approval',
    body, requestedAt: hrOps.nowIso(), note: String(note || '').trim() || undefined,
  };
  await Hr.create('letters', tid(req), letter);

  const chainRoles = hrOps.resolveChain('letter_request');
  const LABELS = { employment_verification: 'Employment verification letter', address_proof: 'Address proof letter' };
  const task = {
    id: hrOps.nextId('APR'), type: 'letter_request', subjectId: letter.id,
    title: `${LABELS[kind] || 'Letter'} — ${emp.name}`,
    summary: `Self-service request${note ? ` (${note})` : ''}. AI-drafted with serial ${serial}; issues into My letters on approval.`,
    state: 'pending', createdByName: emp.name, createdAt: hrOps.nowIso(),
    chain: hrOps.buildChainSteps(chainRoles), meta: { employeeId: emp.id },
  };
  await Hr.create('approvals', tid(req), task);
  await Hr.update('letters', tid(req), letter.id, { approvalTaskId: task.id });

  await hrOps.audit(tid(req), {
    actor: 'user', actorName: emp.name, actorRole: 'employee',
    action: 'letter.requested', subjectType: 'letter', subjectId: letter.id,
    detail: `${LABELS[kind] || 'Letter'} requested${note ? ` — ${note}` : ''}`,
  });
  res.json({ ok: true, letterId: letter.id });
};

/* ============================ Helpdesk ============================ */

/** Scripted-first Ask HR: FAQ answers are deterministic; only a miss makes a ticket. */
exports.askHr = async (req, res) => {
  if (tid(req) == null) return noWorkspace(res);
  const question = String(req.body.question || '').trim();
  if (!question) return res.status(400).json({ error: 'Empty question' });
  const emp = await hrOps.resolveMyEmployee(tid(req), req.user);
  if (!emp) return res.status(404).json({ error: 'No employee record linked to this user' });

  const q = question.toLowerCase();
  let best = null;
  for (const entry of FAQ) {
    const score = entry.keywords.filter((k) => q.includes(k.toLowerCase())).length;
    if (score > 0 && (!best || score > best.score)) best = { score, answer: entry.answer, id: entry.id };
  }
  if (best) return res.json({ escalated: false, answer: best.answer, matchedFaq: best.id });

  const ticket = {
    id: hrOps.nextId('TKT'), employeeId: emp.id, subject: question.slice(0, 80), body: question,
    source: 'bot_escalation', createdAt: hrOps.nowIso(),
    slaDueAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(), status: 'open', replies: [],
  };
  await Hr.create('tickets', tid(req), ticket);
  await hrOps.audit(tid(req), {
    actor: 'system', actorName: hrOps.COMPANY, action: 'helpdesk.ticket_created',
    subjectType: 'ticket', subjectId: ticket.id,
    detail: `Escalated from Ask HR — ${emp.name}: "${ticket.subject}" (SLA 48h)`,
  });
  res.json({
    escalated: true, ticketId: ticket.id,
    answer: "I don't have a scripted answer for that, so I've escalated it to the People Ops team as a ticket. They reply within 48 hours — you can track it right here in Ask HR.",
  });
};

exports.draftTicketReply = async (req, res) => {
  if (tid(req) == null) return noWorkspace(res);
  const ticket = await Hr.getOne('tickets', tid(req), req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  const emp = await Hr.getOne('employees', tid(req), ticket.employeeId);
  const body = await draft(req, {
    system: 'You draft a helpful People Ops reply to an employee helpdesk ticket. Concrete next steps, warm and brief. A human reviews before sending.',
    user: `Ticket "${ticket.subject}": ${ticket.body}`,
    mock: hrOps.mockHelpdeskReply({ subject: ticket.subject, body: ticket.body, employeeName: emp?.name ?? 'there' }),
    description: 'HR: helpdesk reply',
  });
  ticket.replyDraft = { body, status: 'draft' };
  const saved = await Hr.create('tickets', tid(req), ticket);
  await hrOps.audit(tid(req), {
    ...hrOps.AI_ACTOR, action: 'helpdesk.reply_drafted', subjectType: 'ticket', subjectId: ticket.id,
    detail: `Reply drafted for "${ticket.subject}" — awaiting human review`, modelVersion: 'mock',
  });
  res.json({ item: saved });
};

exports.sendTicketReply = async (req, res) => {
  if (tid(req) == null) return noWorkspace(res);
  const { body, resolve } = req.body || {};
  const ticket = await Hr.getOne('tickets', tid(req), req.params.id);
  if (!ticket || !String(body || '').trim()) return res.status(400).json({ error: 'Ticket and reply body are required' });
  const viaAiDraft = !!ticket.replyDraft && ticket.replyDraft.body.trim() === String(body).trim();
  ticket.replies = ticket.replies || [];
  ticket.replies.push({ authorName: req.user.name, body: String(body).trim(), at: hrOps.nowIso(), viaAiDraft });
  delete ticket.replyDraft;
  ticket.status = resolve ? 'resolved' : 'awaiting_employee';
  if (resolve) ticket.resolvedAt = hrOps.nowIso();
  const saved = await Hr.create('tickets', tid(req), ticket);
  await hrOps.audit(tid(req), {
    actor: 'user', actorName: req.user.name, actorRole: req.user.role,
    action: resolve ? 'helpdesk.resolved' : 'helpdesk.replied', subjectType: 'ticket', subjectId: ticket.id,
    detail: `"${ticket.subject}" — reply sent (simulated)${viaAiDraft ? ' from approved AI draft' : ''}${resolve ? '; ticket resolved' : ''}`,
  });
  res.json({ item: saved });
};

/* ============================ Reviews ============================ */

exports.recordReviewEvaluation = async (req, res) => {
  if (tid(req) == null) return noWorkspace(res);
  const { rating, strengths, growthAreas } = req.body || {};
  const evaluation = await Hr.getOne('review_evals', tid(req), req.params.id);
  if (!evaluation) return res.status(404).json({ error: 'Evaluation not found' });
  if (!String(strengths || '').trim() || !String(growthAreas || '').trim()) return res.status(400).json({ error: 'Both fields are required' });
  const emp = await Hr.getOne('employees', tid(req), evaluation.employeeId);
  const cycle = (await Hr.list('review_cycles', tid(req))).find((c) => c.id === evaluation.cycleId);

  const body = await draft(req, {
    system: 'You write an advisory performance-review summary from the manager rating and notes. The manager text remains the record; this is advisory.',
    user: `Summarise ${emp?.name}'s ${cycle?.periodLabel} review: ${rating}/5. Strengths: ${strengths}. Growth: ${growthAreas}.`,
    mock: hrOps.mockReviewSummary({ employeeName: emp?.name ?? 'The employee', rating, strengths, growthAreas, periodLabel: cycle?.periodLabel ?? 'this period' }),
    description: 'HR: review summary',
  });
  Object.assign(evaluation, {
    status: 'submitted', rating, strengths: String(strengths).trim(), growthAreas: String(growthAreas).trim(),
    submittedAt: hrOps.nowIso(), summaryDraft: { body, status: 'draft' },
  });
  const saved = await Hr.create('review_evals', tid(req), evaluation);
  await hrOps.audit(tid(req), {
    actor: 'user', actorName: req.user.name, actorRole: req.user.role,
    action: 'review.evaluation_recorded', subjectType: 'review', subjectId: evaluation.id,
    detail: `${emp?.name} — ${cycle?.name}, ${rating}/5`,
  });
  res.json({ item: saved });
};

exports.approveReviewSummary = async (req, res) => {
  if (tid(req) == null) return noWorkspace(res);
  const evaluation = await Hr.getOne('review_evals', tid(req), req.params.id);
  if (!evaluation?.summaryDraft) return res.status(404).json({ error: 'No summary to approve' });
  evaluation.summaryDraft.status = 'approved';
  evaluation.summaryDraft.approvedByName = req.user.name;
  evaluation.summaryDraft.approvedAt = hrOps.nowIso();
  const saved = await Hr.create('review_evals', tid(req), evaluation);
  await hrOps.audit(tid(req), {
    actor: 'user', actorName: req.user.name, actorRole: req.user.role,
    action: 'review.summary_approved', subjectType: 'review', subjectId: evaluation.id,
    detail: 'Advisory summary approved',
  });
  res.json({ item: saved });
};

/* ============================ Partnerships ============================ */

exports.decidePartnership = async (req, res) => {
  if (tid(req) == null) return noWorkspace(res);
  const { decision, reason } = req.body || {};
  const opp = await Hr.getOne('partnerships', tid(req), req.params.id);
  if (!opp) return res.status(404).json({ error: 'Opportunity not found' });
  if (decision === 'decline' && !String(reason || '').trim()) return res.status(400).json({ error: 'A reason is required to decline' });
  const status = decision === 'accept' ? 'exploring' : decision === 'decline' ? 'declined' : 'archived';
  Object.assign(opp, {
    status, decidedByName: req.user.name, decidedAt: hrOps.nowIso(),
    declineReason: decision === 'decline' ? String(reason).trim() : opp.declineReason,
  });
  const saved = await Hr.create('partnerships', tid(req), opp);
  await hrOps.audit(tid(req), {
    actor: 'user', actorName: req.user.name, actorRole: req.user.role,
    action: `partnership.${decision === 'accept' ? 'exploration_started' : decision === 'decline' ? 'declined' : 'archived'}`,
    subjectType: 'partnership', subjectId: opp.id,
    detail: decision === 'accept' ? `${opp.partner} (${opp.category}) — exploration started (simulated)`
      : decision === 'decline' ? `${opp.partner} — declined: ${String(reason).trim()}` : `${opp.partner} — archived`,
  });
  res.json({ item: saved });
};

exports.draftPartnershipBrief = async (req, res) => {
  if (tid(req) == null) return noWorkspace(res);
  const opp = await Hr.getOne('partnerships', tid(req), req.params.id);
  if (!opp) return res.status(404).json({ error: 'Opportunity not found' });
  const body = await draft(req, {
    system: 'You write an internal one-page brief evaluating a vendor/partnership opportunity. Balanced, with fit questions and a recommendation. Advisory only.',
    user: `Brief on ${opp.partner} (${opp.category}): ${opp.pitch}. Indicative cost ${opp.estCostBand}.`,
    mock: hrOps.mockPartnershipBrief({ partner: opp.partner, category: opp.category, pitch: opp.pitch, estCostBand: opp.estCostBand }),
    description: 'HR: partnership brief',
  });
  opp.brief = { body, status: 'draft' };
  const saved = await Hr.create('partnerships', tid(req), opp);
  await hrOps.audit(tid(req), {
    ...hrOps.AI_ACTOR, action: 'partnership.brief_drafted', subjectType: 'partnership', subjectId: opp.id,
    detail: `Internal brief drafted — ${opp.partner}`, modelVersion: 'mock',
  });
  res.json({ item: saved });
};

/* ============================ Announcements ============================ */

exports.createAnnouncement = async (req, res) => {
  if (tid(req) == null) return noWorkspace(res);
  const { title, body } = req.body || {};
  if (!String(title || '').trim() || !String(body || '').trim()) return res.status(400).json({ error: 'Title and body are required' });
  const announcement = {
    id: hrOps.nextId('ANN'), title: String(title).trim(), body: String(body).trim(),
    authorName: req.user.name, at: hrOps.nowIso(),
  };
  const saved = await Hr.create('announcements', tid(req), announcement);
  await hrOps.audit(tid(req), {
    actor: 'user', actorName: req.user.name, actorRole: req.user.role,
    action: 'announcement.published', subjectType: 'announcement', subjectId: announcement.id,
    detail: String(title).trim(),
  });
  res.status(201).json({ item: saved });
};

/* ============================ My Space (employee self reads) ============================ */

/** GET /api/hr/me — the caller's employee record + their leave/letters/payslips/tickets/leave balance. */
exports.mySpace = async (req, res) => {
  if (tid(req) == null) return res.json({ employee: null });
  const emp = await hrOps.resolveMyEmployee(tid(req), req.user);
  if (!emp) return res.json({ employee: null });
  const [leave, letters, payslips, tickets, balance] = await Promise.all([
    Hr.byEmployee('leave', tid(req), emp.id),
    Hr.byEmployee('letters', tid(req), emp.id),
    Hr.byEmployee('payslips', tid(req), emp.id),
    Hr.byEmployee('tickets', tid(req), emp.id),
    Hr.getOne('leave_balances', tid(req), emp.id),
  ]);
  res.json({ employee: emp, leave, letters, payslips, tickets, balance });
};
