import type { IndustryConfig } from "./types";

/**
 * Education (US colleges & universities) industry config.
 *
 * Content is authored for a US higher-ed buyer — FERPA + Title IX, SIS
 * (Banner / PeopleSoft / Workday Student), LMS (Canvas / Blackboard) and a
 * Slate CRM, English + Spanish — and renders entirely in the Rach.Dev design
 * system. Interactions (Control Tower + relay + knowledge) are fully scripted;
 * no live model is called.
 */
export const educationConfig: IndustryConfig = {
  slug: "education",
  vertical: "Education",
  industrySlug: "education",
  industryName: "Education",
  icon: "graduation",
  tagline:
    "An agent team for admissions advising, FERPA/Title IX safeguards, course planning, financial-aid follow-up and at-risk monitoring — on your SIS, LMS and CRM, with an advisor in the loop.",
  seoTitle: "Education AI Agents for Colleges & Universities",
  seoDescription:
    "Rach.Dev is an AI operations layer for colleges and universities — agents for admissions advising, enrollment, FERPA-safe records, course planning, financial-aid follow-up and at-risk student monitoring, on top of your existing SIS (Banner, PeopleSoft, Workday Student), LMS (Canvas, Blackboard) and CRM (Slate), with an advisor in the loop on every high-stakes action.",
  seoKeywords: [
    "education AI agents",
    "college admissions automation",
    "enrollment advising AI",
    "FERPA AI agents",
    "student retention AI",
    "at-risk student early warning",
    "Banner PeopleSoft automation",
    "Canvas LMS automation",
    "higher education chatbot",
  ],

  // ---------------- HERO ----------------
  eyebrow: "Education · Agentic Operations Layer",
  h1Lines: ["The AI operations layer", "for your campus."],
  rotorLead: "Put a team of agents on your",
  rotorWords: ["admissions.", "advising.", "records.", "financial aid.", "retention watch."],
  subhead:
    "Rach.Dev runs admissions advising, enrollment, FERPA-safe records, course planning, financial-aid follow-up and at-risk student monitoring across the systems you already use — with an advisor in the loop on every high-stakes action, and a full audit trail on every record touched.",
  trustRow: [
    "FERPA-aligned by design",
    "Works with your SIS, LMS & CRM",
    "Advisor-in-the-loop",
    "English & Spanish",
  ],
  heroPrimaryCta: { label: "Book a pilot", href: "/contact" },
  heroSecondaryCta: { label: "See the architecture", href: "#architecture" },

  // ---------------- OPERATING PICTURE ----------------
  operateEyebrow: "The operating picture",
  operateTitle: "What an agent team takes off your campus",
  operateIntro:
    "Most of a campus's load isn't teaching — it's coordination, paperwork and chasing. Here's where agents own the busywork, mapped to how your institution actually runs, from the inquiry form to the diploma.",
  domains: [
    {
      icon: "door",
      title: "The Front Door",
      blurb: "Every inquiry captured, qualified and routed — 24/7, in English or Spanish.",
      bullets: [
        "Multi-channel intake (web, phone, SMS, chat, Slate inquiry)",
        "Identity match & SIS record linkage",
        "Program fit, deadlines & application status surfaced instantly",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "shield",
      title: "Records & Safety",
      blurb: "FERPA-safe record sharing and Title IX-aware routing — verified before anything is released.",
      bullets: [
        "Identity verified before any education record is shared",
        "Harassment / discrimination reports routed to the Title IX office",
        "Directory vs. protected data separated on every answer",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "scribe",
      title: "Academic Planning",
      blurb: "Degree audits, prerequisite checks and a draft plan — the advisor decides.",
      bullets: [
        "Degree-audit pull from the SIS, gaps surfaced",
        "Prerequisite & hold checks before any registration",
        "Draft semester plan staged for advisor sign-off",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "diagnostics",
      title: "Financial Aid",
      blurb: "The full loop, with missing-document and packaging alerts surfaced before deadlines.",
      bullets: [
        "FAFSA / verification document follow-up",
        "Aid-package status and disbursement questions answered",
        "Deadline & SAP (satisfactory academic progress) flags",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "calendar",
      title: "Student Success",
      blurb: "Registration, advising holds, referrals and the follow-up students never get.",
      bullets: [
        "Registration, schedule & advising-hold orchestration",
        "Tutoring, counseling & resource referrals",
        "Reminders & nudges across the term (EN / ES)",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "revenue",
      title: "Bursar & Enrollment Ops",
      blurb: "The fastest ROI for a CFO: keep enrolled students enrolled, clear what blocks them.",
      bullets: [
        "Tuition balance, payment-plan & 1098-T questions",
        "Registration-hold clearance once a balance is resolved",
        "Summer-melt and re-enrollment outreach",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "users",
      title: "Back-Office & Faculty",
      blurb: "Transcripts, credentialing and the compliance paperwork no one wants to do.",
      bullets: [
        "Transcript & enrollment-verification requests",
        "Clery / Title IX / accreditation reporting support",
        "Faculty roster, grade-submission & syllabus reminders",
      ],
      tag: { label: "In your build", tone: "muted" },
    },
    {
      icon: "knowledge",
      title: "Knowledge Layer",
      blurb: "A role-aware assistant grounded only in your approved sources.",
      bullets: [
        "Separate views for prospect, student, staff",
        "Every answer cites its source",
        "Hard guardrails — never legal, immigration or clinical advice",
      ],
      tag: { label: "In demo", tone: "live" },
    },
  ],

  // ---------------- CONTROL TOWER ----------------
  towerTitle: "Watch the team run a student case",
  towerIntro:
    "Pick a case and press play. Watch the agent team run it end to end — an advisor or compliance officer approves every high-stakes action.",
  subjectNoun: "student",
  stages: [
    { key: "door", label: "Front Door", icon: "door" },
    { key: "records", label: "Records & Safety", icon: "shield" },
    { key: "planning", label: "Academic Plan", icon: "scribe" },
    { key: "aid", label: "Financial Aid", icon: "diagnostics" },
    { key: "decision", label: "Decision", icon: "decision" },
    { key: "success", label: "Student Success", icon: "coord" },
    { key: "follow", label: "Follow-up", icon: "follow" },
  ],
  scenarios: [
    {
      key: "applicant",
      tabLabel: "Prospective applicant",
      tabIcon: "userPlus",
      subjectName: "Jordan Reeves · Transfer prospect",
      subjectDesc: "Wants to transfer into the BS Nursing track for fall",
      channel: "Web · Slate inquiry",
      channelIcon: "door",
      steps: [
        {
          agent: "intake",
          stage: "door",
          title: "Inquiry captured & matched",
          detail:
            "Slate inquiry recognized, matched to a prior application record, and a transfer-advising thread opened in seconds.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "records",
          title: "Identity verified before any record shared",
          detail:
            "Confirmed name, date of birth and student ID against the SIS before surfacing any protected record — FERPA gate cleared.",
          status: "ok",
          ms: 1200,
        },
        {
          agent: "scribe",
          stage: "planning",
          title: "Transfer credit audit drafted",
          detail:
            "Prior coursework mapped against the nursing plan; 47 of 60 credits provisionally apply, 3 prerequisites still open.",
          status: "ok",
          ms: 1200,
        },
        {
          agent: "coord",
          stage: "aid",
          title: "Aid & deadline path queued",
          detail: "FAFSA-on-file checked, priority-deadline timeline shared, net-price estimate staged for the advisor.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "decision",
          title: "Admission recommendation — advisor signs",
          detail:
            "A provisional transfer-admit recommendation is drafted; an admissions advisor reviews and approves before anything is promised.",
          status: "gate",
          gateBy: "Dean Alicia Monroe · Admissions",
          ms: 1300,
        },
        {
          agent: "coord",
          stage: "success",
          title: "Onboarding set in motion",
          detail:
            "Orientation slot held, advising hold pre-cleared, and a prerequisite plan shared once the offer is approved.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "revenue",
          stage: "follow",
          title: "Enrolled & nudged",
          detail:
            "Deposit and registration steps explained, summer-melt reminders scheduled, and a first-term check-in pre-booked.",
          status: "ok",
          ms: 1100,
        },
      ],
    },
    {
      key: "titleix",
      tabLabel: "Title IX report",
      tabIcon: "shieldAlert",
      subjectName: "Anonymous · Current student",
      subjectDesc: "Disclosing possible harassment via the support chat",
      channel: "Chat · Student portal",
      channelIcon: "message",
      steps: [
        {
          agent: "intake",
          stage: "door",
          title: "Disclosure recognized in chat",
          detail:
            "Student opened the support chat asking a routine question, then disclosed possible harassment by another student.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "records",
          title: "Title IX trigger — routed to a human",
          detail:
            "Harassment language detected. The agent stops self-service, shares safety resources, and routes the report to the Title IX office immediately.",
          status: "esc",
          ms: 1300,
        },
        {
          agent: "knowledge",
          stage: "planning",
          title: "Rights & options shared, no advice",
          detail:
            "Surfaced the institution's reporting options and support resources from approved policy — and explicitly did not assess or adjudicate the claim.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "decision",
          title: "Case opened — coordinator confirms",
          detail:
            "A Title IX case record is staged with the disclosure and timestamp; the coordinator reviews and formally opens it.",
          status: "gate",
          gateBy: "Marcus Bell · Title IX Coordinator",
          ms: 1300,
        },
        {
          agent: "coord",
          stage: "success",
          title: "Supportive measures coordinated",
          detail:
            "Counseling and academic-flexibility resources offered; a follow-up with the student scheduled by the office, not the agent.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "intake",
          stage: "follow",
          title: "Confidential record logged",
          detail:
            "The interaction is written to a restricted, access-controlled audit log — visible only to the Title IX office.",
          status: "ok",
          ms: 1000,
        },
      ],
    },
    {
      key: "sms",
      tabLabel: "After-hours text",
      tabIcon: "message",
      subjectName: "Sofía Ramírez · 1st-year student",
      subjectDesc: "After-hours text about a registration hold, in Spanish",
      channel: "SMS · After hours",
      channelIcon: "message",
      steps: [
        {
          agent: "intake",
          stage: "door",
          title: "Spanish text understood & answered",
          detail:
            "Inbound SMS in Spanish recognized at 10:20 PM; student identified and replied to in her own language.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "records",
          title: "Identity verified before account detail",
          detail:
            "Confirmed student ID and date of birth before discussing any account specifics — FERPA gate cleared over SMS.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "revenue",
          stage: "aid",
          title: "Hold explained: unpaid balance",
          detail:
            "Registration hold traced to a $640 bursar balance; payment-plan options and the disbursement timeline explained.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "knowledge",
          stage: "planning",
          title: "Grounded answer, no aid advice",
          detail:
            "Answered her financial-aid question from approved materials with sources — and routed an eligibility judgment to a financial-aid counselor.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "coord",
          stage: "decision",
          title: "Payment plan staged — bursar approves",
          detail:
            "A payment plan that would clear the hold is staged; the bursar's office approves before it is offered to the student.",
          status: "gate",
          gateBy: "Dana Whitfield · Bursar",
          ms: 1200,
        },
        {
          agent: "intake",
          stage: "follow",
          title: "Confirmed in Spanish + reminders",
          detail:
            "Sent the approved plan and next steps in Spanish, with a reminder before the registration deadline.",
          status: "ok",
          ms: 1000,
        },
      ],
    },
  ],
  gateNote: "Every high-stakes action waits for a person. Rach.Dev drafts, stages and routes — an advisor, bursar or coordinator approves.",
  completeToast: "Journey complete — every high-stakes action was human-approved",

  // ---------------- ROSTER (relay) ----------------
  rosterTitle: "Seven specialists, one conductor",
  rosterIntro:
    "Each agent owns one job and hands the next a complete, structured context. Atlas routes the work, enforces the human-in-the-loop gates, and writes every action to an audit log.",
  rosterClickNote: "Click Ava below — the full inquiry-to-enrollment workflow plays out automatically.",
  orchestratorName: "Atlas",
  orchestratorBlurb:
    "Atlas is the orchestrator. It routes each case to the right specialist, carries shared student context between them, pauses for advisor or compliance approval on every high-stakes action, and records a complete, timestamped audit trail.",
  relayTriggerAgentKey: "intake",
  relayCompleteToast: "Workflow complete — all agents processed Jordan Reeves's case",
  agents: [
    {
      key: "intake",
      name: "Ava",
      role: "Admissions · Enrollment Advising",
      icon: "intake",
      blurb:
        "The front door. Captures every inquiry across web, phone, SMS, chat and Slate, matches the student to the SIS, and opens a clean advising thread — 24/7, in English or Spanish.",
      tags: ["Multi-channel intake", "SIS / Slate match", "EN / ES"],
      pipeSub: "Intake",
      workMs: 2000,
      voice: {
        listeningTitle: "Listening…",
        listeningSub: "Capturing the student inquiry by voice",
        doneTitle: "Intake complete",
        doneSub: "6 fields captured · handing off to the team…",
        handoffToast: "Ava done — watch the team pick it up",
        fields: [
          { label: "Student", value: "Jordan Reeves · Transfer prospect" },
          { label: "Goal", value: "Transfer into BS Nursing for fall" },
          { label: "Background", value: "60 community-college credits, 3.4 GPA" },
          { label: "Identity", value: "Matched to record (student ID verified)", ok: true },
          { label: "FAFSA", value: "On file — verification complete", ok: true },
          { label: "Channel", value: "Web · English" },
        ],
      },
    },
    {
      key: "triage",
      name: "Marcus",
      role: "Records & Compliance Gate",
      icon: "shield",
      blurb:
        "Records & compliance. Verifies identity before any education record is shared, separates directory from protected data, and routes Title IX or harassment disclosures straight to the right office — never sitting on a safety issue.",
      tags: ["FERPA identity check", "Title IX routing", "Escalation"],
      pipeSub: "Records",
      workMs: 2100,
      flow: [
        {
          fromLabel: "Context from Ava",
          chips: ["Jordan Reeves · Transfer", "Student ID on file", "Slate inquiry"],
        },
        {
          steps: [
            { text: "Identity verified — ID + DOB matched before any record shared", kind: "ok" },
            { text: "Directory vs. protected data separated on every answer", kind: "ok" },
            { text: "Title IX / harassment language → routed to a human, not handled", kind: "esc" },
          ],
          note: "FERPA gate. No protected record is released until identity is verified; safety disclosures escalate immediately.",
        },
      ],
    },
    {
      key: "scribe",
      name: "Nora",
      role: "Academic Planner",
      icon: "scribe",
      blurb:
        "Academic planner. Runs the degree audit, checks prerequisites and holds, and drafts a semester plan — leaving the advisor to decide and sign, not to dig through the SIS.",
      tags: ["Degree audit", "Prerequisite checks", "Draft plan"],
      pipeSub: "Planner",
      workMs: 2000,
      flow: [
        {
          fromLabel: "Context from Marcus",
          chips: ["Identity verified", "Transfer credits: 60", "Target: BS Nursing"],
        },
        {
          steps: [
            { text: "Degree audit pulled — 47 of 60 credits provisionally apply", kind: "ok" },
            { text: "3 open prerequisites and 0 active holds surfaced", kind: "ok" },
            { text: "Draft semester plan staged for advisor sign-off", kind: "ok" },
          ],
          note: "Draft only. Nothing registers until an advisor reviews and signs the plan.",
        },
      ],
    },
    {
      key: "coord",
      name: "Owen",
      role: "Student Success Coordination",
      icon: "coord",
      blurb:
        "Student success coordination. Books advising, clears holds after approval, opens tutoring and counseling referrals, and keeps students on track with reminders and nudges across the term.",
      tags: ["Scheduling", "Referrals & holds", "Reminders"],
      pipeSub: "Success",
      workMs: 1900,
      flow: [
        {
          fromLabel: "Context from Nora",
          chips: ["Orientation slot", "Advising hold: clearable", "Prereq plan"],
        },
        {
          steps: [
            { text: "Orientation slot held so onboarding is ready on approval", kind: "ok" },
            { text: "Advising hold pre-cleared, pending advisor sign-off", kind: "ok" },
            { text: "Tutoring + check-in reminders scheduled for the first term", kind: "ok" },
          ],
        },
      ],
    },
    {
      key: "revenue",
      name: "Riley",
      role: "Bursar & Enrollment Ops",
      icon: "revenue",
      blurb:
        "Bursar & enrollment ops. Explains balances, payment plans and 1098-T questions, surfaces what blocks registration, and runs summer-melt and re-enrollment outreach — clearing the friction that quietly costs enrollment.",
      tags: ["Balances & plans", "Hold clearance", "Re-enrollment"],
      pipeSub: "Bursar",
      workMs: 2000,
      flow: [
        {
          fromLabel: "Context from Owen",
          chips: ["Balance: $640", "Payment plan available", "Hold: registration"],
        },
        {
          steps: [
            { text: "Balance traced and payment-plan options explained clearly", kind: "ok" },
            { text: "Hold-clearance path staged for the bursar to approve", kind: "ok" },
            { text: "Summer-melt and re-enrollment nudges queued", kind: "ok" },
          ],
        },
      ],
    },
    {
      key: "knowledge",
      name: "Iris",
      role: "Knowledge Assistant",
      icon: "knowledge",
      blurb:
        "The role-aware knowledge assistant. Answers prospects, students and staff from your approved sources only — every answer cited, and never legal, immigration or clinical advice.",
      tags: ["Role-aware", "Cited answers", "Never regulated advice"],
      pipeSub: "Knowledge",
      workMs: 1900,
      flow: [
        {
          fromLabel: "Context from Riley",
          chips: ["Student view", "Approved sources only", "EN / ES"],
        },
        {
          steps: [
            { text: "Answered the student's questions from approved materials", kind: "ok" },
            { text: "Every answer carried its source citation", kind: "ok" },
            { text: "Immigration / legal-status question → handed to a DSO, not answered", kind: "esc" },
          ],
          note: "Iris informs. It never gives legal, immigration or clinical advice and never overrides a counselor.",
        },
      ],
    },
    {
      key: "monitor",
      name: "Hope",
      role: "At-Risk Student Sentinel",
      icon: "monitor",
      blurb:
        "The At-Risk Student Sentinel. Always on, reading attendance, grades and LMS engagement for every monitored student — flagging a quiet slide weeks before it becomes a withdrawal, and staging the outreach for an advisor.",
      tags: ["Always-on monitor", "Early-warning", "Advisory only"],
      pipeSub: "Sentinel",
      workMs: 2400,
      live: { label: "Live · Retention" },
      flow: [
        {
          fromLabel: "Context from the success team",
          chips: ["First-year cohort", "Midterm window", "Financial-stress flag"],
        },
        {
          fromLabel: "How Hope calibrates for this student",
          steps: [
            { text: "Baselines attendance, grades and LMS activity per student", kind: "ok" },
            { text: "Tightens thresholds for known financial-stress and DFW risk", kind: "ok" },
            { text: "Suppresses noise so advisors see real signals, not every dip", kind: "ok" },
          ],
        },
        {
          fromLabel: "What Hope watches in real time",
          chips: ["Attendance", "Grades / GPA", "LMS logins", "Assignment submission", "Holds", "Aid status"],
          steps: [
            { text: "Engagement drop — no LMS login in 10+ days mid-term", kind: "esc" },
            { text: "Attendance slide — multiple consecutive absences", kind: "esc" },
            { text: "Grade slip — a gateway course trending toward a DFW", kind: "esc" },
            { text: "Missed work — assignments unsubmitted past due", kind: "esc" },
            { text: "Financial risk — unpaid balance plus a registration hold", kind: "esc" },
            { text: "Aid risk — satisfactory-academic-progress threshold at risk", kind: "esc" },
          ],
          note: "Hope is advisory. It alerts and stages outreach — an advisor decides and acts. Every alert is logged with the signal that triggered it.",
        },
      ],
    },
  ],

  // ---------------- ARCHITECTURE ----------------
  archTitle: "One layer over the systems you already run",
  archIntro:
    "Rach.Dev sits on top of your SIS, LMS and CRM — orchestrating agents, enforcing governance, and keeping an advisor in the loop. No rip-and-replace.",
  archLayers: [
    {
      n: "Layer 4",
      title: "Human-in-the-loop",
      icon: "decision",
      body: "Every high-stakes action — admission offers, registration, hold clearance, Title IX intake — pauses for a person to approve. Agents draft and stage; people decide.",
      pills: ["Approval gates", "Advisor sign-off", "Role-based access"],
    },
    {
      n: "Layer 3",
      title: "Governance & audit",
      icon: "shield",
      body: "FERPA-aligned controls, identity verification before any record release, minimum-necessary access, and a complete, timestamped audit trail on every action and data touch.",
      pills: ["FERPA-aligned", "Full audit log", "Record minimization", "Source citations"],
    },
    {
      n: "Layer 2",
      title: "Agent orchestration",
      icon: "orchestrator",
      body: "Atlas routes each case to the right specialist, carries shared student context between agents, and coordinates hand-offs from inquiry to enrollment.",
      pills: ["Routing & hand-off", "Shared context", "Escalation paths"],
    },
    {
      n: "Layer 1",
      title: "Integration",
      icon: "plug",
      body: "Bidirectional connectors to your SIS, LMS, CRM, telephony and payment systems over the standards your campus already speaks.",
      pills: ["SIS / LMS APIs", "LTI / OneRoster", "Webhooks & SSO"],
    },
  ],
  archBaseLabel: "Works with the systems you already run",
  archBaseSystems: [
    "Ellucian Banner",
    "Oracle PeopleSoft Campus",
    "Workday Student",
    "Canvas",
    "Blackboard Learn",
    "Slate",
    "Salesforce Education Cloud",
    "Twilio",
    "Okta SSO",
    "TouchNet",
  ],

  // ---------------- KNOWLEDGE ----------------
  knowledgeTitle: "A knowledge layer that knows its limits",
  knowledgeIntro:
    "Iris answers prospects, students and staff from your approved sources only. Every answer is cited — and a regulated question (legal, immigration, clinical) is always handed to a licensed professional, never answered.",
  knowledgeAgentName: "Iris",
  knowledgeViewLabel: "Student view",
  knowledgeGreeting:
    "Hi, I'm Iris. Ask me about admissions, registration, financial aid or campus policies — I'll always cite my source.",
  knowledgeDisclaimer:
    "Iris provides information only — never legal, immigration or clinical advice. Anything regulated is routed to a licensed professional, and protected records are shared only after identity is verified.",
  knowledge: [
    {
      q: "What's the priority deadline to apply for fall financial aid?",
      a: "The priority FAFSA deadline for the upcoming fall term is March 1. Submitting by then keeps you eligible for institutional grants and work-study, which are awarded until funds run out. You can check your application status anytime in the student portal, and I can remind you a week before the deadline.",
      src: ["Financial Aid Office calendar", "Student portal"],
    },
    {
      q: "¿Cómo verifico mi identidad para hablar de mi cuenta?",
      a: "Para proteger su expediente bajo FERPA, primero confirmo su identidad: necesito su número de estudiante y su fecha de nacimiento. Una vez verificados, puedo hablar de su saldo, sus retenciones y sus pasos de inscripción. Sin esa verificación, solo puedo compartir información pública del catálogo.",
      src: ["FERPA policy", "Registrar's office"],
    },
    {
      q: "I'm on an F-1 visa — will dropping a class affect my status?",
      a: "That's an immigration question, so I won't advise on it myself — getting it wrong could put your status at risk. I've routed you to a Designated School Official (DSO) in the international student office, who can review your full situation. Please don't drop the class until you've spoken with them.",
      src: ["International Student Services", "DSO routing"],
    },
  ],

  // ---------------- GOVERNANCE ----------------
  governanceTitle: "Governance, not just guardrails",
  governanceIntro:
    "The controls that let an institution actually deploy agents — enforced in the system, not promised on a slide.",
  guarantees: [
    {
      title: "Human in the loop",
      desc: "Every high-stakes action — admission offers, registration, hold clearance, Title IX intake — waits for an advisor or officer to approve. No agent takes it alone.",
    },
    {
      title: "Complete audit trail",
      desc: "Every action, hand-off and record access is logged with a timestamp, the agent, the source and the approver — exportable on demand.",
    },
    {
      title: "FERPA-aligned by design",
      desc: "Identity verified before any education record is shared, minimum-necessary access, role-based permissions, and directory data kept separate from protected records.",
    },
    {
      title: "Grounded with sources",
      desc: "Answers come only from your approved knowledge sources and cite them. No open-web guessing, and never legal, immigration or clinical advice.",
    },
    {
      title: "No vendor lock-in",
      desc: "Standards-based connectors to your SIS, LMS and CRM, and your data stays yours. Turn an agent off and your systems keep running.",
    },
  ],
  auditTitle: "Live audit log",
  auditIntro: "A sample of what every action looks like on the record.",
  auditLines: [
    { ts: "22:21:04", text: "Inbound SMS (es) received & answered — student #20418", tag: "ok", tagLabel: "Logged" },
    { ts: "22:21:39", text: "Identity verified (ID + DOB) before account detail shared", tag: "ok", tagLabel: "Verified" },
    { ts: "22:22:12", text: "Education record accessed: bursar balance (minimum necessary)", tag: "mod", tagLabel: "FERPA" },
    { ts: "22:23:50", text: "Payment plan drafted — $640 balance, awaiting approval", tag: "mod", tagLabel: "Pending" },
    { ts: "22:24:31", text: "Payment plan approved by Dana Whitfield, Bursar", tag: "ok", tagLabel: "Approved" },
    { ts: "14:08:17", text: "Title IX disclosure detected — routed to coordinator", tag: "esc", tagLabel: "Escalated" },
  ],

  // ---------------- OUTCOMES ----------------
  outcomesTitle: "What changes when agents own the busywork",
  outcomesIntro: "Directional outcomes our pilots target — validated on your own data, never assumed.",
  outcomes: [
    {
      value: "24/7",
      label: "Coverage, every channel",
      desc: "Web, phone, SMS and chat answered around the clock, in English and Spanish — no after-hours voicemail.",
    },
    {
      value: "Minutes",
      label: "From inquiry to answer",
      desc: "Identity verified, records surfaced and a draft plan staged before a student ever waits for an advising slot.",
    },
    {
      value: "Earlier",
      label: "At-risk students caught",
      desc: "Attendance, grade and engagement slides flagged weeks before a withdrawal — outreach staged for an advisor.",
    },
    {
      value: "Hours back",
      label: "For advisors & staff",
      desc: "Less SIS digging and chasing, more time on the conversations that need human judgment.",
    },
  ],
  benchmarks: [
    {
      text: "In a national survey, roughly 59% of college students said financial stress had made them consider dropping out — a quiet, addressable risk an always-on agent can surface early.",
      cite: "Ellucian Student Voice Report, 2024",
    },
    {
      text: "Georgia State pairs ~800 daily risk alerts with human advisors and has reported higher graduation rates and effectively closed achievement gaps across race, income and first-gen status.",
      cite: "Georgia State University, GPS Advising / Student Success",
    },
    {
      text: "About 10–40% of college-intending students never enroll the fall after admission (\"summer melt\"), with higher rates for low-income students — and proactive, personalized outreach measurably helps.",
      cite: "EdResearch for Action (Castleman & Page), Summer Melt brief",
    },
  ],
  outcomesNote:
    "Figures above are external benchmarks and pilot targets, not guarantees — we validate every number on your own data before you rely on it. Monitoring agents are advisory: they alert and stage, an advisor acts.",

  // ---------------- CTA ----------------
  ctaTitle: "Start with one office. Prove it. Then scale.",
  ctaIntro:
    "We stand up a single workflow on your existing SIS, LMS and CRM, show the audit trail and the outcomes, and expand only once your team trusts it.",
  ctaSteps: [
    {
      n: "01",
      title: "Scope one workflow",
      desc: "Pick the highest-pain workflow — admissions advising, financial-aid follow-up or at-risk monitoring — and we map it to your systems.",
    },
    {
      n: "02",
      title: "Pilot in your environment",
      desc: "Agents run on your SIS, LMS and CRM with an advisor in the loop and a full audit trail, in weeks not semesters.",
    },
    {
      n: "03",
      title: "Measure, then expand",
      desc: "Review the outcomes on your own data, then roll the agent team out office by office.",
    },
  ],

  // ---------------- FAQ (drives FAQPage JSON-LD) ----------------
  faq: [
    {
      q: "Does Rach.Dev replace our SIS or LMS?",
      a: "No. Rach.Dev is an operations layer that runs on top of your existing SIS (Banner, PeopleSoft, Workday Student), LMS (Canvas, Blackboard) and CRM (Slate) over their APIs and standards like LTI. Your systems of record stay exactly where they are.",
    },
    {
      q: "Is Rach.Dev FERPA compliant?",
      a: "Rach.Dev is built to align with FERPA: identity is verified before any education record is shared, access is minimum-necessary and role-based, directory data is kept separate from protected records, and every record touch is written to a full audit trail. Compliance is validated per deployment.",
    },
    {
      q: "How does it handle Title IX or harassment reports?",
      a: "The compliance agent detects harassment or discrimination language, stops self-service, shares safety resources, and routes the disclosure straight to your Title IX office. The agent never assesses or adjudicates a claim — a coordinator opens and owns the case.",
    },
    {
      q: "Do the agents work in languages other than English?",
      a: "Yes. Intake, reminders and student answers support English and Spanish out of the box, across web, phone, SMS and chat.",
    },
    {
      q: "Do the agents make admissions or aid decisions on their own?",
      a: "No. Every high-stakes action — admission offers, registration, hold clearance, payment plans — pauses for an advisor, bursar or officer to approve. The agents draft, stage and route; a person decides. Monitoring agents are advisory only.",
    },
  ],
};
