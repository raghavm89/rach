'use strict';

/**
 * HR Ops (Layers 2–4) shared service helpers — approval-chain policy matrix,
 * audit logging, deterministic AI mock builders, and employee resolution.
 *
 * Same discipline as Layer 1: every mutation writes an audit event, approval
 * chains resolve from a policy matrix, and AI output is always a draft a human
 * approves. The AI mock builders mirror hr-layers/src/lib/ai/mocks/layer2-4.ts
 * so LLM_MOCK mode demos the flows with no API call.
 */

const { Hr } = require('@rach/core');

const COMPANY = 'Meridian Technologies';

// Approval-chain policy matrix (mirrors hr-layers policies.json approvalPolicies).
// actionType → ordered roles that must approve.
const APPROVAL_CHAINS = {
  jd_approval: ['hr_executive', 'hr_director'],
  posting: ['hr_executive'],
  rejection_batch: ['hr_executive'],
  offer_in_band: ['hr_executive'],
  offer_out_of_band: ['hr_director'],
  policy_override: ['hr_director'],
  leave_request: ['hr_executive'],
  letter_request: ['hr_executive'],
  probation_evaluation: ['project_manager'],
  confirmation_letter: ['hr_director'],
  probation_termination: ['hr_director'],
};

function resolveChain(actionType) {
  const roles = APPROVAL_CHAINS[actionType];
  return roles ? [...roles] : ['hr_director'];
}

function buildChainSteps(roles) {
  return roles.map((role) => ({ role, state: 'pending' }));
}

/** The step a task is currently waiting on. */
function currentStep(task) {
  return (task.chain || []).find((s) => s.state === 'pending');
}

/** Whether a role can act on the task's current step. */
function canActOn(task, role) {
  if (task.state !== 'pending') return false;
  const step = currentStep(task);
  const isAdmin = ['admin', 'tenant_admin'].includes(role);
  return !!step && (step.role === role || isAdmin);
}

const nowIso = () => new Date().toISOString();

/** Human-readable business id, e.g. APR-1723... — prefix is the entity family. */
function nextId(prefix) {
  return `${prefix}-${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

/** Append an audit event for a tenant (hr_audit_events). */
async function audit(tenantId, ev) {
  await Hr.create('audit', tenantId, {
    id: nextId('AUD'),
    at: nowIso(),
    ...ev,
  });
}

const AI_ACTOR = { actor: 'ai', actorName: `${COMPANY} AI` };

/**
 * Resolve the employee record for a logged-in employee-role user.
 * Matches by email (case-insensitive); falls back to a probation-stage employee
 * (best for demoing My Space), then the first employee. Returns null if none.
 */
async function resolveMyEmployee(tenantId, user) {
  const employees = await Hr.list('employees', tenantId);
  if (!employees.length) return null;
  const email = (user.email || '').toLowerCase();
  const byEmail = employees.find((e) => (e.email || '').toLowerCase() === email);
  if (byEmail) return byEmail;
  const probation = employees.find((e) => e.status === 'probation' && e.userRef);
  return probation || employees.find((e) => e.userRef) || employees[0];
}

/* ================= Deterministic AI mock builders ================= */

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return iso; }
}

function mockInductionKit(i) {
  const first = (i.employeeName || 'there').split(' ')[0];
  return `## Welcome to ${COMPANY}, ${first}

${COMPANY} builds the transaction and ledger infrastructure that mid-market enterprises run their business on. You are joining ${i.dept}, reporting to ${i.managerName}.

## Your first week

- Day 1: setup, access, team lunch, walk-through with your buddy ${i.buddyName}
- Day 2–3: shadow the team's current sprint; read the top runbooks and design docs
- Day 4: first supervised change through the paved-road pipeline
- Day 5: week-1 retro with ${i.managerName}; agree your 30-day plan

## Tools you will use

- AWS, GitHub + Actions, Prometheus/Grafana, Slack, Keka (HR)

## Benefits at a glance

- Family health insurance from day 1; parental cover optional top-up
- 12 casual + 12 sick + 15 earned leave days per year
- Learning budget of ₹40,000 per year

## Mandatory modules (complete in week 1–2)

- POSH awareness · Code of conduct · Information security basics

Your probation runs 90 days with check-ins at day 7, 30, 60 and 90 — they are conversations, not exams. Welcome aboard.`;
}

function mockEvalSummary(i) {
  const first = (i.employeeName || '').split(' ')[0];
  const modules = i.pendingModules && i.pendingModules.length > 0
    ? ` One administrative item remains open: the ${i.pendingModules.join(' and ')} module${i.pendingModules.length > 1 ? 's are' : ' is'} still pending and should close before confirmation.`
    : ' All mandatory induction modules are complete.';
  const trajectory = i.rating >= 4
    ? `The day-${i.day} evaluation is strong (${i.rating}/5) and consistent with the earlier check-ins.`
    : i.rating === 3
      ? `The day-${i.day} evaluation is steady (${i.rating}/5), with clear areas to develop before confirmation.`
      : `The day-${i.day} evaluation (${i.rating}/5) raises concerns that need a structured conversation before the next checkpoint.`;
  const checkins = (i.checkinNotes && i.checkinNotes.length > 0)
    ? i.checkinNotes.map((n) => `“${n.slice(0, 90)}${n.length > 90 ? '…' : ''}”`).join(' · ')
    : 'none';
  return `${trajectory} The manager highlights: ${String(i.strengths).trim().replace(/\.$/, '')}. Growth focus for the remaining probation period: ${String(i.growthAreas).trim().replace(/\.$/, '')}.${modules}

Earlier check-ins on record: ${checkins}.

Advisory only — the confirmation decision rests with HR and the manager. ${first}'s probation outcome options (confirm / extend / terminate) unlock at the day-90 checkpoint.`;
}

function mockSelfServiceLetter(i) {
  const joined = formatDate(i.joinDate + 'T00:00:00+05:30');
  if (i.kind === 'confirmation') {
    return `CONFIRMATION LETTER

Dear ${(i.employeeName || '').split(' ')[0]},

We are pleased to confirm your employment with ${COMPANY} Pvt Ltd as ${i.title}, ${i.dept}, with effect from the successful completion of your probation period.

You joined the company on ${joined}, and your performance through the probation checkpoints has met the expectations of the role. All other terms of your appointment letter remain unchanged; your notice period now moves to the confirmed-employee terms per policy.

We thank you for your contribution so far and look forward to your continued association with ${COMPANY}.

For ${COMPANY} Pvt Ltd,
${i.issuerName}
Serial: ${i.serial}`;
  }
  if (i.kind === 'employment_verification') {
    return `TO WHOM IT MAY CONCERN

This is to certify that ${i.employeeName} (Employee Code ${i.empCode}) is employed with ${COMPANY} Pvt Ltd as ${i.title}, ${i.dept}, since ${joined}, and is an employee in good standing.

This letter is issued at the employee's request${i.note ? ` (purpose stated: ${i.note})` : ''} for verification purposes and does not constitute any other undertaking by the company.

For ${COMPANY} Pvt Ltd,
${i.issuerName}
Serial: ${i.serial}`;
  }
  return `TO WHOM IT MAY CONCERN

This is to certify that ${i.employeeName} (Employee Code ${i.empCode}), ${i.title}, is employed with ${COMPANY} Pvt Ltd, Bellandur, Bengaluru — 560103. The employee's address as per company records is available for verification against this reference.

Issued at the employee's request${i.note ? ` (purpose stated: ${i.note})` : ''} for address-proof purposes.

For ${COMPANY} Pvt Ltd,
${i.issuerName}
Serial: ${i.serial}`;
}

function mockHelpdeskReply(i) {
  const first = (i.employeeName || '').split(' ')[0];
  const lower = `${i.subject} ${i.body}`.toLowerCase();
  let core;
  if (lower.includes('id card') || lower.includes('access card') || lower.includes('badge')) {
    core = "I've deactivated the lost card and raised a replacement — it will be ready at reception within 2 working days. Please collect a temporary day badge from reception in the meantime; the first replacement in a year is free of charge.";
  } else if (lower.includes('laptop') || lower.includes('ram') || lower.includes('hardware')) {
    core = "I've logged the hardware request with IT. Upgrades need a quick manager sign-off, which I've requested — once that's in, fulfilment typically takes up to a week. I'll keep this ticket updated at each step.";
  } else if (lower.includes('insurance') || lower.includes('e-card') || lower.includes('dependent') || lower.includes('spouse')) {
    core = "I checked with the insurer — your dependent addition was processed in the July window and the e-card is in the insurer's generation queue. These arrive within 10 working days of the window closing; if it hasn't reached you by then, we'll escalate with the insurer directly.";
  } else if (lower.includes('pf') || lower.includes('uan')) {
    core = "I've reviewed the transfer status on the EPFO portal. The claim is currently pending at the previous employer's approval step. Please raise a grievance from the UAN portal and share the reference number here — if it isn't cleared within 10 days, we'll follow up formally on company letterhead.";
  } else if (lower.includes('sim') || lower.includes('phone')) {
    core = "Corporate SIMs are provided for roles with an on-call or field requirement, with manager approval. I've checked your role profile — please have your manager reply on this ticket with the justification and we'll process it with our telecom partner within 3 working days.";
  } else {
    core = "Thanks for flagging this — I've looked into it and here is where things stand: the request is valid, I've initiated the next step with the owning team, and I'll update this ticket as soon as there's movement. If anything is urgent in the meantime, reply here and I'll prioritise it.";
  }
  return `Hi ${first},

${core}

Best,
People Ops · ${COMPANY}`;
}

function mockReviewSummary(i) {
  const tone = i.rating >= 5 ? 'an exceptional half-year'
    : i.rating === 4 ? 'a strong half-year'
      : i.rating === 3 ? 'a steady half-year' : 'a difficult half-year';
  return `${i.employeeName} had ${tone} for ${i.periodLabel} (${i.rating}/5). Strengths the manager calls out: ${String(i.strengths).trim().replace(/\.$/, '')}. The growth theme for the next period: ${String(i.growthAreas).trim().replace(/\.$/, '')}. Recommended next step: agree one measurable goal against the growth theme in the first two weeks of the new period.

Advisory summary drafted from the manager's evaluation — the evaluation of record is the manager's own text.`;
}

function mockPartnershipBrief(i) {
  return `## Internal brief — ${i.partner} (${i.category})

**What they offer.** ${i.pitch}

**Indicative cost.** ${i.estCostBand} — validate against headcount of ~120 and current benefits spend before any conversation about commercials.

**Fit questions for exploration.**
- What does adoption look like at companies our size after 6 months?
- Contract minimums, lock-in and exit terms
- Data handling: what employee data leaves our systems, under what agreement?
- Pilot option: can we run a 60-day pilot with one department?

**Recommendation.** Worth a 30-minute discovery call; no commitments until the data-handling answer is in writing.

*Source: scout agent — weekly scan (simulated). This brief is an AI draft for internal discussion, not a decision.*`;
}

/** Working-days between two ISO dates (Mon–Fri), excluding non-optional holidays. */
function countWorkingDays(fromIso, toIso, holidays) {
  const set = new Set((holidays || []).filter((h) => !h.optional).map((h) => h.date));
  const from = new Date(`${fromIso}T00:00:00`);
  const to = new Date(`${toIso}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return 0;
  let count = 0;
  const cur = new Date(from);
  while (cur <= to) {
    const dow = cur.getDay();
    const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
    if (dow !== 0 && dow !== 6 && !set.has(iso)) count += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/**
 * Fire side-effects when an approval task resolves to `approved`. Keeps the
 * downstream record (letter, leave, employee) consistent with the decision.
 */
async function applyApprovalSideEffects(tenantId, task, user) {
  if (!task || task.state !== 'approved') return;
  const by = user.name || user.role;

  if (task.type === 'letter_request' || task.type === 'confirmation_letter') {
    const letter = await Hr.getOne('letters', tenantId, task.subjectId);
    if (letter && letter.status !== 'issued') {
      await Hr.update('letters', tenantId, task.subjectId, {
        status: 'issued', issuedAt: nowIso(), issuedByName: by,
      });
      // Confirmation letters also confirm the employee.
      if (task.type === 'confirmation_letter' && task.meta && task.meta.employeeId) {
        await Hr.update('employees', tenantId, task.meta.employeeId, {
          status: 'confirmed', confirmedAt: nowIso(),
        });
      }
      await audit(tenantId, {
        actor: 'user', actorName: by, actorRole: user.role,
        action: 'letter.issued', subjectType: 'letter', subjectId: task.subjectId,
        detail: `${letter.serial || task.subjectId} issued on approval`,
      });
    }
    return;
  }

  if (task.type === 'leave_request') {
    const req = await Hr.getOne('leave', tenantId, task.subjectId);
    if (req && req.status === 'pending') {
      await Hr.update('leave', tenantId, task.subjectId, {
        status: 'approved', decidedByName: by, decidedAt: nowIso(),
      });
      // Deduct working days from the employee's balance bucket.
      const bal = await Hr.getOne('leave_balances', tenantId, req.employeeId);
      if (bal && bal.balances && bal.balances[req.type]) {
        bal.balances[req.type].used += req.workingDays;
        await Hr.create('leave_balances', tenantId, bal);
      }
      await audit(tenantId, {
        actor: 'user', actorName: by, actorRole: user.role,
        action: 'leave.approved', subjectType: 'leave', subjectId: task.subjectId,
        detail: `${req.workingDays} day(s) approved for ${req.employeeId}`,
      });
    }
    return;
  }

  if (task.type === 'probation_termination') {
    await audit(tenantId, {
      actor: 'user', actorName: by, actorRole: user.role,
      action: 'probation.termination_approved', subjectType: 'employee',
      subjectId: task.subjectId,
      detail: 'Termination approved — static policy letter prepared; never auto-sent.',
    });
  }
}

module.exports = {
  COMPANY,
  APPROVAL_CHAINS,
  applyApprovalSideEffects,
  resolveChain,
  buildChainSteps,
  currentStep,
  canActOn,
  nowIso,
  nextId,
  audit,
  AI_ACTOR,
  resolveMyEmployee,
  countWorkingDays,
  mockInductionKit,
  mockEvalSummary,
  mockSelfServiceLetter,
  mockHelpdeskReply,
  mockReviewSummary,
  mockPartnershipBrief,
};
