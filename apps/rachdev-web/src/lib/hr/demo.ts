/**
 * HR industry — demo data + domain helpers, ported as-is from HR Layers
 * (demo-level). Self-contained: reads the seed JSON, no backend. The dashboard
 * screens render this restyled to the RachDev design system.
 */
import requisitionsJson from '@/data/hr/requisitions.json';
import applicationsJson from '@/data/hr/applications.json';
import candidatesJson from '@/data/hr/candidates.json';
import approvalsJson from '@/data/hr/approvals.json';
import interviewsJson from '@/data/hr/interviews.json';
import offersJson from '@/data/hr/offers.json';
import auditJson from '@/data/hr/audit.json';

const IST = 'Asia/Kolkata';

// ── Types (minimal shapes the screens use) ───────────────────────────────────
export type Role = 'hr_executive' | 'hr_director' | 'project_manager' | 'employee';
export type Stage = 'applied' | 'screening' | 'voice_screen' | 'hr_interview' | 'pm_interview' | 'offer' | 'rejected';
export type InterviewRound = 'hr_video' | 'pm_technical';
export type ApprovalType =
  | 'jd_approval' | 'posting' | 'rejection_batch' | 'offer' | 'policy_override'
  | 'leave_request' | 'letter_request' | 'probation_evaluation'
  | 'confirmation_letter' | 'probation_termination';
export type ApprovalStepState = 'pending' | 'approved' | 'changes_requested' | 'rejected';

export type RequisitionStatus = 'draft' | 'jd_review' | 'open' | 'offer_stage' | 'closed';
export type InterviewStatus = 'scheduled' | 'completed' | 'no_show' | 'rescheduled' | 'cancelled';
export type OfferStatus = 'draft' | 'pending_approval' | 'approved' | 'sent_for_esign';

export interface Band { min: number; max: number }
export interface Requisition {
  id: string; title: string; dept: string; hiringManager: string;
  headcount: number; compBandINR: Band; status: RequisitionStatus; createdAt: string;
  screening?: { scoreThreshold?: number };
  location?: string; workMode?: string; minExperienceYears?: number;
  noticeNeedDays?: number; mustHaves?: string[];
}
export interface BiasFlag { phrase: string; reason: string; rewrite: string }
export interface Candidate { id: string; name: string; source?: string; agencyName?: string }
export interface Application {
  id: string; candidateId: string; requisitionId: string;
  stage: Stage; appliedAt: string; stageChangedAt: string;
  resumeParsed?: { currentTitle?: string; currentCompany?: string };
  aiScore?: { value: number } | null;
  policyFlags?: { overriddenAt?: string | null }[];
}
export interface Interview {
  id: string; applicationId: string; round: InterviewRound;
  status: InterviewStatus; scheduledAt: string; interviewerName?: string; note?: string;
}
export interface Offer {
  id: string; applicationId: string; ctcINR: number; inBand?: boolean;
  status: OfferStatus; createdAt: string;
}
export interface AuditEvent {
  id: string; actor: string; actorName: string; actorRole?: string;
  action: string; subjectType: string; subjectId: string; detail: string;
  at: string; modelVersion?: string;
}
export interface ApprovalStep {
  role: Role; state: ApprovalStepState; actedByName?: string; actedAt?: string; comment?: string;
}
export interface ApprovalTask {
  id: string; type: ApprovalType; title: string; summary: string;
  state: 'pending' | 'approved' | 'rejected'; createdByName?: string;
  createdAt: string; resolvedAt?: string; chain: ApprovalStep[];
  subjectId?: string; jd?: string; biasFlags?: BiasFlag[]; [k: string]: unknown;
}

// ── Labels ───────────────────────────────────────────────────────────────────
export const ROLE_LABELS: Record<Role, string> = {
  hr_executive: 'HR Executive',
  hr_director: 'HR Director',
  project_manager: 'Project Manager',
  employee: 'Employee',
};
export const STAGE_LABELS: Record<Stage, string> = {
  applied: 'Applied', screening: 'Screening', voice_screen: 'Voice screen',
  hr_interview: 'HR interview', pm_interview: 'PM interview', offer: 'Offer', rejected: 'Rejected',
};
export const PIPELINE_STAGES: Stage[] = ['applied', 'screening', 'voice_screen', 'hr_interview', 'pm_interview', 'offer'];
export const ROUND_LABELS: Record<InterviewRound, string> = {
  hr_video: 'HR interview (video)', pm_technical: 'PM technical round',
};
export const APPROVAL_TYPE_LABELS: Record<ApprovalType, string> = {
  jd_approval: 'Job description', posting: 'Job posting', rejection_batch: 'Rejection batch',
  offer: 'Offer', policy_override: 'Policy override',
  leave_request: 'Leave request', letter_request: 'Letter request',
  probation_evaluation: 'Probation evaluation', confirmation_letter: 'Confirmation letter',
  probation_termination: 'Probation termination',
};
export const REQ_STATUS_LABELS: Record<RequisitionStatus, string> = {
  draft: 'Draft', jd_review: 'JD in review', open: 'Open', offer_stage: 'Offer stage', closed: 'Closed',
};
export const INTERVIEW_STATUS_LABELS: Record<InterviewStatus, string> = {
  scheduled: 'Scheduled', completed: 'Completed', no_show: 'No show', rescheduled: 'Rescheduled', cancelled: 'Cancelled',
};
export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  draft: 'Draft', pending_approval: 'Pending approval', approved: 'Approved', sent_for_esign: 'Sent for e-sign',
};

// ── Seed data ────────────────────────────────────────────────────────────────
export const requisitions = requisitionsJson as unknown as Requisition[];
export const applications = applicationsJson as unknown as Application[];
export const candidates = candidatesJson as unknown as Candidate[];
export const approvals = approvalsJson as unknown as ApprovalTask[];
export const interviews = interviewsJson as unknown as Interview[];
export const offers = offersJson as unknown as Offer[];
export const audit = auditJson as unknown as AuditEvent[];

export const reqById = (id: string) => requisitions.find((r) => r.id === id);
export const appById = (id: string) => applications.find((a) => a.id === id);
export const candById = (id: string) => candidates.find((c) => c.id === id);
export const appsForReq = (reqId: string) => applications.filter((a) => a.requisitionId === reqId);

// ── Approval-chain logic (ported) ────────────────────────────────────────────
export function currentStep(task: ApprovalTask): ApprovalStep | undefined {
  return task.chain.find((s) => s.state === 'pending');
}
export function canActOn(task: ApprovalTask, role: Role): boolean {
  if (task.state !== 'pending') return false;
  const step = currentStep(task);
  return !!step && step.role === role;
}

// ── Date helpers (IST) ───────────────────────────────────────────────────────
export function daysBetween(aIso: string, bIso?: string): number {
  const a = new Date(aIso).getTime();
  const b = bIso ? new Date(bIso).getTime() : Date.now();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}
export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: IST });
}
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: IST }).toUpperCase();
}
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: IST });
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: IST });
  return `${date}, ${time.toUpperCase()}`;
}
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: IST });
}
export function formatLPA(inr: number): string {
  const l = inr / 100_000;
  return `₹${Number.isInteger(l) ? l : l.toFixed(1)} LPA`;
}
export function formatBand(b: Band): string {
  const f = (n: number) => { const l = n / 100_000; return Number.isInteger(l) ? l.toString() : l.toFixed(1); };
  return `₹${f(b.min)}–${f(b.max)} LPA`;
}
export function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: IST });
}

// ============================================================================
// Layers 2–4 (Onboard · Operate · Discover) — types + labels
// ============================================================================

export type EmployeeStatus = 'probation' | 'confirmed' | 'exited';
export interface Employee {
  id: string; empCode: string; name: string; title: string; dept: string;
  managerName: string; email: string; location: string; joinDate: string;
  status: EmployeeStatus; probationDays?: number; probationExtendedTo?: string;
  confirmedAt?: string; userRef?: string; candidateRef?: string; applicationRef?: string;
}
export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  probation: 'On probation', confirmed: 'Confirmed', exited: 'Exited',
};

export type ChecklistOwner = 'employee' | 'hr' | 'it' | 'manager';
export interface OnboardingChecklistItem {
  id: string; item: string; owner: ChecklistOwner; status: 'pending' | 'done';
  doneAt?: string; doneByName?: string;
}
export interface InductionModule {
  key: 'posh' | 'code_of_conduct' | 'infosec'; label: string; mandatory: true;
  status: 'pending' | 'completed'; completedAt?: string;
}
export interface InductionKit {
  body: string; status: 'draft' | 'approved'; approvedByName?: string; approvedAt?: string;
  modules: InductionModule[];
}
export interface OnboardingPlan {
  id: string; employeeId?: string; joinerName: string; candidateRef?: string; buddyName: string;
  day1: { date: string; location: string; reportingTo: string; schedule: string[] };
  checklist: OnboardingChecklistItem[]; bgvStatus: 'clear' | 'in_progress';
  provisioning: { item: string; status: 'requested' | 'in_progress' | 'done' }[];
  invites: { channel: string; status: 'not_sent' | 'invited' }[];
  inductionKit?: InductionKit;
}

export type CheckpointDay = 7 | 30 | 60 | 90;
export interface ProbationEvaluation {
  rating: 1 | 2 | 3 | 4 | 5; strengths: string; growthAreas: string;
  submittedByName: string; submittedAt: string;
  summaryDraft?: { body: string; status: 'draft' | 'approved'; approvedByName?: string; approvedAt?: string };
}
export interface ProbationCheckpoint {
  id: string; employeeId: string; day: CheckpointDay; due: string;
  status: 'pending' | 'due' | 'completed';
  checkIn?: { notes: string; byName: string; at: string };
  evaluation?: ProbationEvaluation; approvalTaskId?: string; completedAt?: string;
}

export type LeaveTypeKey = 'casual' | 'sick' | 'earned';
export const LEAVE_TYPE_LABELS: Record<LeaveTypeKey, string> = {
  casual: 'Casual leave', sick: 'Sick leave', earned: 'Earned leave',
};
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export interface LeaveRequest {
  id: string; employeeId: string; type: LeaveTypeKey; from: string; to: string;
  workingDays: number; reason?: string; status: LeaveStatus; approvalTaskId?: string;
  decidedByName?: string; decidedAt?: string; decisionComment?: string; appliedAt: string;
}
export interface LeaveBalance {
  id?: string; employeeId: string;
  balances: Record<LeaveTypeKey, { entitled: number; used: number }>;
}

export interface PayslipRecord {
  id: string; employeeId: string; month: string; grossINR: number; netINR: number;
  status: string; note?: string;
}

export type LetterKind = 'employment_verification' | 'address_proof' | 'confirmation';
export const LETTER_KIND_LABELS: Record<LetterKind, string> = {
  employment_verification: 'Employment verification letter',
  address_proof: 'Address proof letter', confirmation: 'Confirmation letter',
};
export type LetterStatus = 'requested' | 'pending_approval' | 'issued' | 'rejected';
export const LETTER_STATUS_LABELS: Record<LetterStatus, string> = {
  requested: 'Requested', pending_approval: 'Pending approval', issued: 'Issued', rejected: 'Rejected',
};
export interface Letter {
  id: string; employeeId: string; kind: LetterKind; serial: string; status: LetterStatus;
  body?: string; requestedAt: string; issuedAt?: string; issuedByName?: string;
  approvalTaskId?: string; note?: string;
}

export type TicketStatus = 'open' | 'awaiting_employee' | 'resolved';
export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open', awaiting_employee: 'Awaiting employee', resolved: 'Resolved',
};
export interface TicketReply { authorName: string; body: string; at: string; viaAiDraft?: boolean }
export interface HrTicket {
  id: string; employeeId: string; subject: string; body: string;
  source: 'bot_escalation' | 'direct'; createdAt: string; slaDueAt: string;
  status: TicketStatus; replies: TicketReply[]; resolvedAt?: string;
  replyDraft?: { body: string; status: 'draft' };
}

export interface ReviewCycle {
  id: string; name: string; periodLabel: string; due: string;
  status: 'active' | 'closed'; reminderSentAt?: string;
}
export interface ReviewEvaluation {
  id: string; cycleId: string; employeeId: string; managerName: string; managerRole: Role;
  status: 'pending' | 'submitted'; rating?: 1 | 2 | 3 | 4 | 5; strengths?: string; growthAreas?: string;
  submittedAt?: string;
  summaryDraft?: { body: string; status: 'draft' | 'approved'; approvedByName?: string; approvedAt?: string };
}

export type PartnershipStatus = 'new' | 'exploring' | 'declined' | 'archived';
export const PARTNERSHIP_STATUS_LABELS: Record<PartnershipStatus, string> = {
  new: 'New', exploring: 'Exploring', declined: 'Declined', archived: 'Archived',
};
export interface PartnershipOpportunity {
  id: string; partner: string; category: string; pitch: string; estCostBand: string;
  status: PartnershipStatus; receivedAt: string; decidedByName?: string; decidedAt?: string;
  declineReason?: string; brief?: { body: string; status: 'draft' };
}

export interface Holiday { date: string; name: string; scope: 'national' | 'karnataka'; optional?: boolean }
export interface Announcement {
  id: string; title: string; body: string; authorName: string; at: string; pinned?: boolean;
}

/** Format a payslip / calendar month "2026-07" → "Jul 2026". */
export function formatMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, (mo || 1) - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}
export function formatINR(n: number): string {
  return `₹${(n || 0).toLocaleString('en-IN')}`;
}
