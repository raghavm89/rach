'use strict';

const { Router } = require('express');
const { authenticate, authorize, roles } = require('@rach/identity');
const { HR } = roles;
const { asyncHandler } = require('@rach/core');
const ctrl = require('../controllers/hrController');
const ops = require('../controllers/hrOpsController');

const router = Router();
router.use(authenticate);

// HR workspace: Org Admin + HR staff roles (and platform admin).
const hr = authorize(...HR.staff);
// Deleting records (e.g. requisitions) is a governance action.
const hrDelete = authorize(...HR.director);
// Employee self-service (My Space) — the employee plus admins (for testing).
const employee = authorize(...HR.employee);

router.get('/summary',  hr, asyncHandler(ctrl.summary));
// Config routes must precede /:entity so 'config' isn't treated as an entity.
router.get('/config',   hr, asyncHandler(ctrl.getConfig));
router.put('/config',   hr, asyncHandler(ctrl.patchConfig));
router.post('/jd/draft', hr, asyncHandler(ctrl.draftJd));             // JD-writer agent → routes a jd_approval
router.post('/approvals/:id/act', hr, asyncHandler(ctrl.actApproval)); // approve | request_changes

// ── Layers 2–4 module actions (must precede the generic /:entity routes) ──────

// Onboarding
router.post('/onboarding/:id/checklist',            hr, asyncHandler(ops.toggleChecklistItem));
router.post('/onboarding/:id/invites',              hr, asyncHandler(ops.sendInvites));
router.post('/onboarding/:id/induction-kit',        hr, asyncHandler(ops.generateInductionKit));
router.post('/onboarding/:id/induction-kit/approve', hr, asyncHandler(ops.approveInductionKit));
router.post('/onboarding/:id/module',               hr, asyncHandler(ops.completeModule));

// Probation
router.post('/probation/:id/checkin',               hr, asyncHandler(ops.recordCheckIn));
router.post('/probation/:id/approve-summary',       hr, asyncHandler(ops.approveEvalSummary));
router.post('/probation/evaluations/:taskId/submit', hr, asyncHandler(ops.submitEvaluation));
router.post('/probation/employees/:id/confirm',     hr, asyncHandler(ops.confirmEmployee));
router.post('/probation/employees/:id/extend',      hr, asyncHandler(ops.extendProbation));
router.post('/probation/employees/:id/terminate',   hr, asyncHandler(ops.initiateTermination)); // director-only (in ctrl)

// Leave & letters (employee self-service)
router.post('/leave/apply',    employee, asyncHandler(ops.applyLeave));
router.post('/letters/request', employee, asyncHandler(ops.requestLetter));

// Helpdesk
router.post('/helpdesk/ask',            employee, asyncHandler(ops.askHr));
router.post('/tickets/:id/draft-reply', hr,       asyncHandler(ops.draftTicketReply));
router.post('/tickets/:id/reply',       hr,       asyncHandler(ops.sendTicketReply));

// Reviews
router.post('/reviews/:id/record',          hr, asyncHandler(ops.recordReviewEvaluation));
router.post('/reviews/:id/approve-summary', hr, asyncHandler(ops.approveReviewSummary));

// Partnerships
router.post('/partnerships/:id/decide', hr, asyncHandler(ops.decidePartnership));
router.post('/partnerships/:id/brief',  hr, asyncHandler(ops.draftPartnershipBrief));

// Announcements (audited create — precedes generic POST /:entity)
router.post('/announcements', hr, asyncHandler(ops.createAnnouncement));

// My Space (employee's own record + records)
router.get('/me', employee, asyncHandler(ops.mySpace));

// ── Generic entity CRUD (Layer 1 + Layer 2–4 reads) ──────────────────────────
router.get('/:entity',  hr, asyncHandler(ctrl.list));
router.post('/:entity', hr, asyncHandler(ctrl.create));
router.delete('/:entity/:id', hrDelete, asyncHandler(ctrl.remove));

module.exports = router;
