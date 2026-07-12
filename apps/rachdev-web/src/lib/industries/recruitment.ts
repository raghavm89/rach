import type { IndustryConfig } from "./types";

/**
 * Recruitment (US talent acquisition) industry config.
 *
 * Content is authored for a US staffing firm / in-house TA team buyer — EEOC and
 * ban-the-box guardrails, job-relevant screening criteria only, ATS systems of
 * record (Greenhouse / Lever / Workday), English + Spanish — and renders
 * entirely in the Rach.Dev design system. Interactions (Control Tower + relay +
 * knowledge) are fully scripted; no live model is called.
 */
export const recruitmentConfig: IndustryConfig = {
  slug: "recruitment",
  vertical: "Recruitment",
  industrySlug: "recruitment",
  industryName: "Recruitment",
  icon: "userSearch",
  tagline:
    "An agent team for sourcing, screening, scheduling, offers and pipeline watch — on your existing ATS, with EEOC and ban-the-box guardrails and a recruiter in the loop.",
  seoTitle: "Recruitment AI Agents for Staffing & Talent Acquisition",
  seoDescription:
    "Rach.Dev is an AI operations layer for staffing firms and in-house talent teams — agents for candidate screening, interview scheduling, offers, onboarding and pipeline monitoring, on top of your existing ATS, with EEOC and ban-the-box guardrails and a recruiter in the loop on every hiring decision.",
  seoKeywords: [
    "recruitment AI agents",
    "AI candidate screening",
    "interview scheduling automation",
    "talent acquisition automation",
    "ATS automation",
    "EEOC compliant screening AI",
    "ban-the-box hiring",
    "recruiting pipeline monitoring",
  ],

  // ---------------- HERO ----------------
  eyebrow: "Recruitment · Agentic Operations Layer",
  h1Lines: ["The AI operations layer", "for your hiring pipeline."],
  rotorLead: "Put a team of agents on your",
  rotorWords: ["sourcing.", "screening.", "scheduling.", "offers.", "pipeline watch."],
  subhead:
    "Rach.Dev runs sourcing, candidate screening, interview scheduling, offers and onboarding across the systems you already use — with job-relevant, EEOC-aware guardrails, a recruiter in the loop on every hiring decision, and a full audit trail on every action.",
  trustRow: [
    "EEOC & ban-the-box aware",
    "Works with your existing ATS",
    "Recruiter-in-the-loop",
    "English & Spanish",
  ],
  heroPrimaryCta: { label: "Book a pilot", href: "/contact" },
  heroSecondaryCta: { label: "See the architecture", href: "#architecture" },

  // ---------------- OPERATING PICTURE ----------------
  operateEyebrow: "The operating picture",
  operateTitle: "What an agent team takes off your desk",
  operateIntro:
    "Most of recruiting isn't judgement — it's chasing résumés, herding calendars and re-keying notes into the ATS. Here's where agents own the busywork, mapped to how your hiring pipeline actually runs.",
  domains: [
    {
      icon: "door",
      title: "The Front Door",
      blurb: "Every applicant captured, parsed and routed — 24/7, in English or Spanish.",
      bullets: [
        "Multi-channel intake (apply page, job boards, SMS, referrals)",
        "Résumé parse & ATS record creation",
        "Acknowledgement and next-step reply in seconds",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "triage",
      title: "Screen & Fairness",
      blurb: "Job-relevant scoring with explicit EEOC and ban-the-box guardrails.",
      bullets: [
        "Scores against the configured, job-relevant rubric only",
        "Never asks protected-class or prohibited questions",
        "Flags every borderline call for recruiter review",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "scribe",
      title: "Sourcing & Outreach",
      blurb: "Drafts JD-matched outreach and re-engages your talent pool — you approve the send.",
      bullets: [
        "LinkedIn + talent-pool matches to the open req",
        "Personalized outreach drafts from approved templates",
        "Replies parsed; interested candidates staged for review",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "calendar",
      title: "Interview Logistics",
      blurb: "The multi-party calendar nightmare, solved end to end.",
      bullets: [
        "Finds slots across candidate and full panel",
        "Sends confirmations, prep packs and reminders",
        "Handles reschedules without a human in the chain",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "fileSignature",
      title: "Offer & Onboarding",
      blurb: "Offers drafted, never sent without sign-off; new hires guided through day one to ninety.",
      bullets: [
        "Offer letter drafted from the approved band & policy",
        "Background-check and reference workflows kicked off",
        "Onboarding buddy answers benefits, IT and policy Qs",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "revenue",
      title: "Req & Placement Health",
      blurb: "The metrics a TA lead lives by: time-to-fill, source quality, placement status.",
      bullets: [
        "Time-to-fill and stage-conversion tracking per req",
        "Source-of-hire and cost-per-hire roll-ups",
        "Placement / start confirmation and fee tracking",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "users",
      title: "Compliance & Records",
      blurb: "The OFCCP/EEO paperwork and retention no one wants to own.",
      bullets: [
        "EEO/OFCCP applicant-flow logging",
        "Configurable candidate-data retention & deletion",
        "Audit-ready record of every screen decision",
      ],
      tag: { label: "In your build", tone: "muted" },
    },
    {
      icon: "knowledge",
      title: "Knowledge Layer",
      blurb: "A role-aware assistant grounded only in your approved sources.",
      bullets: [
        "Separate views for candidate, recruiter, hiring manager",
        "Every answer cites its source",
        "Hard guardrails — never legal or eligibility advice",
      ],
      tag: { label: "In demo", tone: "live" },
    },
  ],

  // ---------------- CONTROL TOWER ----------------
  towerTitle: "Watch the team run a req",
  towerIntro:
    "Pick a candidate and press play. Watch the agent team run the pipeline end to end — a recruiter or hiring manager approves every hiring decision.",
  subjectNoun: "candidate",
  stages: [
    { key: "apply", label: "Apply", icon: "door" },
    { key: "screen", label: "Screen", icon: "triage" },
    { key: "source", label: "Sourcing", icon: "scribe" },
    { key: "schedule", label: "Schedule", icon: "calendar" },
    { key: "decision", label: "Decision", icon: "decision" },
    { key: "offer", label: "Offer", icon: "fileSignature" },
    { key: "onboard", label: "Onboard", icon: "follow" },
  ],
  scenarios: [
    {
      key: "screen",
      tabLabel: "Inbound applicant",
      tabIcon: "userPlus",
      subjectName: "Jordan Avery · Senior Backend Engineer",
      subjectDesc: "Applied via careers page — req #ENG-204",
      channel: "Apply page · Greenhouse",
      channelIcon: "door",
      steps: [
        {
          agent: "intake",
          stage: "apply",
          title: "Applicant parsed & created",
          detail:
            "Résumé parsed, candidate record created in Greenhouse against req #ENG-204, and an acknowledgement sent in seconds.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "screen",
          title: "Job-relevant screen scored",
          detail:
            "Scored against the configured rubric — 7 yrs Go, distributed systems, US work authorization confirmed by the candidate. No protected-class questions asked.",
          status: "ok",
          ms: 1300,
        },
        {
          agent: "scribe",
          stage: "source",
          title: "Recruiter brief assembled",
          detail:
            "Skills match, salary expectation and a cited highlight reel pulled together so the recruiter reviews a complete picture, not a raw résumé.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "coord",
          stage: "schedule",
          title: "Panel interview booked",
          detail:
            "Found a slot across the candidate and the four-person panel, sent confirmations, prep pack and reminders.",
          status: "ok",
          ms: 1200,
        },
        {
          agent: "triage",
          stage: "decision",
          title: "Advance to onsite — recruiter approves",
          detail:
            "Recommendation to advance is staged; the recruiter reviews the scorecard and approves before the candidate moves forward — Rach.Dev never decides this alone.",
          status: "gate",
          gateBy: "Megan Calhoun · Recruiter",
          ms: 1300,
        },
        {
          agent: "revenue",
          stage: "offer",
          title: "Offer drafted, hiring manager signs",
          detail:
            "Offer letter drafted at the approved band; the hiring manager reviews and e-signs before anything is sent to the candidate.",
          status: "gate",
          gateBy: "David Okonkwo · Hiring Manager",
          ms: 1300,
        },
        {
          agent: "coord",
          stage: "onboard",
          title: "Onboarding kicked off",
          detail:
            "After sign-off, background check and onboarding tasks created, day-one logistics and IT setup queued, ATS stage updated.",
          status: "ok",
          ms: 1100,
        },
      ],
    },
    {
      key: "sms",
      tabLabel: "After-hours text",
      tabIcon: "message",
      subjectName: "Lucía Ramírez · Warehouse Associate",
      subjectDesc: "After-hours text, in Spanish",
      channel: "SMS · After hours",
      channelIcon: "message",
      steps: [
        {
          agent: "intake",
          stage: "apply",
          title: "Spanish text understood & answered",
          detail:
            "Inbound SMS in Spanish recognized at 9:50 PM; candidate matched to the open warehouse req and replied to in her own language.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "screen",
          title: "Knockout questions, fairly asked",
          detail:
            "Job-relevant must-haves checked — shift availability, lift requirement, work authorization. Ban-the-box: no criminal-history question in this jurisdiction.",
          status: "ok",
          ms: 1200,
        },
        {
          agent: "knowledge",
          stage: "source",
          title: "Grounded answer, no eligibility advice",
          detail:
            "Answered her pay-and-shift question from the approved job posting in Spanish, with sources — and did not advise on legal work-eligibility, which it routed to a human.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "coord",
          stage: "schedule",
          title: "Morning screen held — recruiter confirms",
          detail:
            "A 9:00 AM phone-screen slot is held; the on-shift recruiter approves before it is promised to the candidate.",
          status: "gate",
          gateBy: "Tyler Brooks · Recruiter",
          ms: 1200,
        },
        {
          agent: "intake",
          stage: "onboard",
          title: "Confirmed in Spanish + reminders",
          detail:
            "Sent the confirmed time and what to bring in Spanish, with a reminder the morning of the screen.",
          status: "ok",
          ms: 1000,
        },
      ],
    },
    {
      key: "compliance",
      tabLabel: "Compliance catch",
      tabIcon: "shieldAlert",
      subjectName: "Priya N. · Account Executive",
      subjectDesc: "Hiring manager pushes a non-job-relevant filter",
      channel: "Recruiter request · Lever",
      channelIcon: "shieldAlert",
      steps: [
        {
          agent: "intake",
          stage: "apply",
          title: "Candidate pulled into the req",
          detail:
            "Candidate sourced from the talent pool and added to the sales req in Lever with full prior-application history attached.",
          status: "ok",
          ms: 1000,
        },
        {
          agent: "triage",
          stage: "screen",
          title: "Disallowed filter blocked",
          detail:
            "A request to screen out by graduation year (an age proxy) is refused — not a job-relevant criterion under EEOC. The screen runs on the approved rubric only.",
          status: "esc",
          ms: 1400,
        },
        {
          agent: "monitor",
          stage: "screen",
          title: "Fairness review escalated",
          detail:
            "Pipeline Sentinel logs the blocked criterion, snapshots the request, and routes a fairness review to the named TA compliance owner before the pipeline proceeds.",
          status: "esc",
          ms: 1300,
        },
        {
          agent: "triage",
          stage: "decision",
          title: "Compliant rubric approved",
          detail:
            "TA compliance reviews and signs off on the corrected, job-relevant rubric; only then does screening continue.",
          status: "gate",
          gateBy: "Hannah Whitaker · TA Compliance",
          ms: 1300,
        },
        {
          agent: "scribe",
          stage: "source",
          title: "Brief assembled on merits",
          detail:
            "Recruiter brief built strictly from job-relevant skills and outcomes, with the fairness note attached for the record.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "coord",
          stage: "schedule",
          title: "Interview scheduled",
          detail:
            "Slot booked with the candidate and panel; confirmations and a structured-interview guide sent.",
          status: "ok",
          ms: 1100,
        },
      ],
    },
  ],
  gateNote:
    "Every hiring decision waits for a person. Rach.Dev drafts, scores and stages — a recruiter or hiring manager approves.",
  completeToast: "Pipeline complete — every hiring decision was human-approved",

  // ---------------- ROSTER (relay) ----------------
  rosterTitle: "Seven specialists, one conductor",
  rosterIntro:
    "Each agent owns one job and hands the next a complete, structured context. Atlas routes the work, enforces the human-in-the-loop gates and the EEOC guardrails, and writes every action to an audit log.",
  rosterClickNote: "Click Ava below — the full apply-to-onboarding workflow plays out automatically.",
  orchestratorName: "Atlas",
  orchestratorBlurb:
    "Atlas is the orchestrator. It routes each candidate to the right specialist, carries shared req context between them, pauses for recruiter or hiring-manager approval on every hiring decision, enforces job-relevant screening, and records a complete, timestamped audit trail.",
  relayTriggerAgentKey: "intake",
  relayCompleteToast: "Workflow complete — all agents processed Jordan Avery's application",
  agents: [
    {
      key: "intake",
      name: "Ava",
      role: "Candidate Intake",
      icon: "intake",
      blurb:
        "The front door. Captures every applicant across the careers page, job boards, SMS and referrals, parses the résumé, creates the ATS record, and replies — 24/7, in English or Spanish.",
      tags: ["Multi-channel intake", "Résumé parsing", "EN / ES"],
      pipeSub: "Intake",
      workMs: 2000,
      voice: {
        listeningTitle: "Listening…",
        listeningSub: "Capturing candidate intake by voice",
        doneTitle: "Intake complete",
        doneSub: "6 fields captured · handing off to the team…",
        handoffToast: "Ava done — watch the team pick it up",
        fields: [
          { label: "Candidate", value: "Jordan Avery" },
          { label: "Role applied", value: "Senior Backend Engineer · req #ENG-204" },
          { label: "Experience", value: "7 yrs Go, distributed systems, AWS" },
          { label: "Work authorization", value: "Confirmed by candidate — US authorized", ok: true },
          { label: "ATS record", value: "Created in Greenhouse · profile linked", ok: true },
          { label: "Channel", value: "Careers page · English" },
        ],
      },
    },
    {
      key: "triage",
      name: "Marcus",
      role: "Screening & Fairness",
      icon: "triage",
      blurb:
        "Screening & fairness. Scores candidates against the configured, job-relevant rubric, enforces EEOC and ban-the-box guardrails, and escalates anything non-compliant — never running a disallowed filter.",
      tags: ["Job-relevant scoring", "EEOC guardrails", "Escalation"],
      pipeSub: "Screen",
      workMs: 2100,
      flow: [
        {
          fromLabel: "Context from Ava",
          chips: ["Jordan Avery", "Senior Backend Engineer", "US work authorized"],
        },
        {
          steps: [
            { text: "Scored on the approved rubric — skills, depth, role fit", kind: "ok" },
            { text: "Guardrail check: no protected-class or ban-the-box questions", kind: "ok" },
            { text: "Disallowed criterion (e.g. age proxy) → blocked and escalated", kind: "esc" },
          ],
          note: "Marcus screens on job-relevant criteria only. Non-compliant requests are refused, never silently applied.",
        },
      ],
    },
    {
      key: "scribe",
      name: "Nora",
      role: "Sourcing & Briefs",
      icon: "scribe",
      blurb:
        "Sourcing & briefs. Matches the talent pool and LinkedIn to the open req, drafts personalized outreach from approved templates, and assembles a complete, cited recruiter brief — you approve every send.",
      tags: ["Talent-pool matching", "Outreach drafts", "Recruiter briefs"],
      pipeSub: "Source",
      workMs: 2000,
      flow: [
        {
          fromLabel: "Context from Marcus",
          chips: ["Strong skills match", "Salary expectation: in band", "Cleared screen"],
        },
        {
          steps: [
            { text: "Talent-pool and LinkedIn matches surfaced for the req", kind: "ok" },
            { text: "Outreach draft built from an approved template", kind: "ok" },
            { text: "Cited recruiter brief assembled — sent only after approval", kind: "ok" },
          ],
          note: "Draft only. Outreach goes out solely after a recruiter approves it.",
        },
      ],
    },
    {
      key: "coord",
      name: "Owen",
      role: "Interview Coordination",
      icon: "coord",
      blurb:
        "Interview coordination. Finds slots across the candidate and the full panel, sends confirmations, prep packs and reminders, and handles reschedules without a human ever joining the calendar chain.",
      tags: ["Multi-party scheduling", "Confirmations & prep", "Reschedules"],
      pipeSub: "Coord",
      workMs: 1900,
      flow: [
        {
          fromLabel: "Context from Nora",
          chips: ["4-person panel", "Onsite loop", "Candidate availability"],
        },
        {
          steps: [
            { text: "Slot found across candidate and full interview panel", kind: "ok" },
            { text: "Confirmations, prep pack and reminders sent", kind: "ok" },
            { text: "Reschedule handled end to end; ATS calendar synced", kind: "ok" },
          ],
        },
      ],
    },
    {
      key: "revenue",
      name: "Riley",
      role: "Offers & Pipeline Metrics",
      icon: "revenue",
      blurb:
        "Offers & pipeline metrics. Drafts the offer letter at the approved band, kicks off background and reference checks after sign-off, and tracks time-to-fill, source-of-hire and placement status per req.",
      tags: ["Offer drafting", "Time-to-fill & source", "Placement tracking"],
      pipeSub: "Offers",
      workMs: 2000,
      flow: [
        {
          fromLabel: "Context from Owen",
          chips: ["Panel: advance", "Band: L5 approved", "Start: ~3 weeks"],
        },
        {
          steps: [
            { text: "Offer letter drafted at the approved comp band", kind: "ok" },
            { text: "Background + reference checks staged for after sign-off", kind: "ok" },
            { text: "Offer awaits hiring-manager e-signature before any send", kind: "esc" },
          ],
          note: "Riley drafts and tracks. No offer is sent until a hiring manager signs.",
        },
      ],
    },
    {
      key: "knowledge",
      name: "Iris",
      role: "Knowledge Assistant",
      icon: "knowledge",
      blurb:
        "The role-aware knowledge assistant. Answers candidates, recruiters and hiring managers from your approved sources only — every answer cited, and never legal, immigration or eligibility advice.",
      tags: ["Role-aware", "Cited answers", "Never legal advice"],
      pipeSub: "Knowledge",
      workMs: 1900,
      flow: [
        {
          fromLabel: "Context from Riley",
          chips: ["Candidate view", "Approved sources only", "EN / ES"],
        },
        {
          steps: [
            { text: "Answered candidate questions from the job posting & policy", kind: "ok" },
            { text: "Every answer carried its source citation", kind: "ok" },
            { text: "Legal / work-eligibility question → handed to a human, not answered", kind: "esc" },
          ],
          note: "Iris informs. It never gives legal, immigration or eligibility advice, or makes a hiring call.",
        },
      ],
    },
    {
      key: "monitor",
      name: "Hope",
      role: "Pipeline Sentinel",
      icon: "monitor",
      blurb:
        "The Pipeline Sentinel. Always on, reading the live state of every open req — flagging aging reqs, candidates going cold and offer-decline risk before a top candidate slips away, and staging the nudge for the recruiter.",
      tags: ["Always-on monitor", "Aging & decline risk", "Advisory only"],
      pipeSub: "Pipeline",
      workMs: 2400,
      live: { label: "Live · Pipeline" },
      flow: [
        {
          fromLabel: "Context from the recruiting team",
          chips: ["Open reqs: 38", "Hot candidates", "Offers outstanding"],
        },
        {
          fromLabel: "How Hope calibrates for this team",
          steps: [
            { text: "Baselines normal stage velocity per req and per recruiter", kind: "ok" },
            { text: "Tightens thresholds for hard-to-fill and high-priority reqs", kind: "ok" },
            { text: "Suppresses noise so only real risk reaches a recruiter", kind: "ok" },
          ],
        },
        {
          fromLabel: "What Hope watches in real time",
          chips: ["Req age", "Stage stall", "Candidate silence", "Competing offers", "Offer aging", "Source dry-up"],
          steps: [
            { text: "Aging req — open past your time-to-fill target with no movement", kind: "esc" },
            { text: "Candidate going cold — no contact since the last interview", kind: "esc" },
            { text: "Offer-decline risk — verbal accepted elsewhere or offer aging out", kind: "esc" },
            { text: "Panel bottleneck — interviews stalled waiting on one interviewer", kind: "esc" },
            { text: "Pipeline thinning — top-of-funnel drying up for a critical req", kind: "esc" },
            { text: "Fairness drift — adverse-impact signal in a stage's pass rates", kind: "esc" },
          ],
          note: "Hope is advisory. It alerts and stages a nudge — a recruiter decides and acts. Every alert is logged with the signal that triggered it.",
        },
      ],
    },
  ],

  // ---------------- ARCHITECTURE ----------------
  archTitle: "One layer over the systems you already run",
  archIntro:
    "Rach.Dev sits on top of your ATS and existing tools — orchestrating agents, enforcing governance and EEOC guardrails, and keeping a recruiter in the loop. No rip-and-replace.",
  archLayers: [
    {
      n: "Layer 4",
      title: "Human-in-the-loop",
      icon: "decision",
      body: "Every hiring decision — advance, reject, offer — pauses for a recruiter or hiring manager to approve. Agents draft, score and stage; people decide.",
      pills: ["Approval gates", "Recruiter sign-off", "Role-based access"],
    },
    {
      n: "Layer 3",
      title: "Governance & audit",
      icon: "shield",
      body: "EEOC and ban-the-box guardrails, job-relevant criteria only, configurable candidate-data retention, and a complete, timestamped audit trail on every action and decision.",
      pills: ["EEOC-aware", "Full audit log", "Data retention", "Source citations"],
    },
    {
      n: "Layer 2",
      title: "Agent orchestration",
      icon: "orchestrator",
      body: "Atlas routes each candidate to the right specialist, carries shared req context between agents, and coordinates hand-offs end to end.",
      pills: ["Routing & hand-off", "Shared context", "Escalation paths"],
    },
    {
      n: "Layer 1",
      title: "Integration",
      icon: "plug",
      body: "Bidirectional connectors to your ATS, calendars, sourcing channels and HRIS over the standards your systems already speak.",
      pills: ["ATS APIs", "Calendar & email", "Webhooks & APIs"],
    },
  ],
  archBaseLabel: "Works with the systems you already run",
  archBaseSystems: [
    "Greenhouse",
    "Lever",
    "Workday",
    "LinkedIn Recruiter",
    "Indeed",
    "Google Calendar",
    "Microsoft 365",
    "Twilio",
    "Checkr",
    "Bamboo HR",
  ],

  // ---------------- KNOWLEDGE ----------------
  knowledgeTitle: "A knowledge layer that knows its limits",
  knowledgeIntro:
    "Iris answers candidates, recruiters and hiring managers from your approved sources only. Every answer is cited — and a legal, immigration or eligibility question is always handed to a human, never advised.",
  knowledgeAgentName: "Iris",
  knowledgeViewLabel: "Candidate view",
  knowledgeGreeting:
    "Hi, I'm Iris. Ask me about this role, the interview process or next steps — I'll always cite my source.",
  knowledgeDisclaimer:
    "Iris provides information only — never legal, immigration or work-eligibility advice, and never a hiring decision. Anything regulated is routed to a qualified human.",
  knowledge: [
    {
      q: "What are the next steps after my interview?",
      a: "Your onsite loop with the engineering panel is scheduled for Thursday, June 11 at 1:00 PM. After the loop, the panel submits scorecards and your recruiter, Megan Calhoun, follows up within two business days. You can reschedule anytime by replying here.",
      src: ["Greenhouse pipeline", "Interview schedule"],
    },
    {
      q: "¿Cuánto paga este puesto y qué turno es?",
      a: "Según la publicación del empleo, este puesto de almacén paga entre $19 y $22 por hora, en el turno de mañana (7:00 AM a 3:30 PM), de lunes a viernes. Los beneficios comienzan a los 30 días. Si necesita más detalles, puedo conectarla con un reclutador.",
      src: ["Job posting", "Compensation band"],
    },
    {
      q: "Can you tell me if my visa makes me eligible to work here?",
      a: "That's a legal work-authorization question, so I won't advise on it myself. I've routed your question to our recruiting and HR team, who can walk you through the eligibility and documentation steps. You may also wish to consult a qualified immigration attorney.",
      src: ["HR routing", "Work-authorization policy"],
    },
  ],

  // ---------------- GOVERNANCE ----------------
  governanceTitle: "Governance, not just guardrails",
  governanceIntro:
    "The controls that let a talent team actually deploy agents — enforced in the system, not promised on a slide.",
  guarantees: [
    {
      title: "Recruiter in the loop",
      desc: "Every hiring decision — advance, reject, offer — waits for a recruiter or hiring manager to approve. No agent advances, rejects or offers on its own.",
    },
    {
      title: "Complete audit trail",
      desc: "Every action, hand-off, screen decision and data access is logged with a timestamp, the agent, the source and the approver — exportable on demand for OFCCP/EEO review.",
    },
    {
      title: "EEOC & data-retention aligned",
      desc: "Screening runs on job-relevant criteria only, with ban-the-box rules configurable per jurisdiction, and candidate data kept to a configurable retention window then deleted.",
    },
    {
      title: "Grounded with sources",
      desc: "Answers come only from your approved sources — job postings, policies, the ATS — and cite them. No open-web guessing, no ungrounded claims about a role.",
    },
    {
      title: "No vendor lock-in",
      desc: "Standards-based connectors to your ATS and tools, and your candidate data stays yours. Turn an agent off and your systems keep running.",
    },
  ],
  auditTitle: "Live audit log",
  auditIntro: "A sample of what every action looks like on the record.",
  auditLines: [
    { ts: "21:51:09", text: "Inbound SMS (es) received & answered — candidate #7714", tag: "ok", tagLabel: "Logged" },
    { ts: "08:32:40", text: "Résumé parsed & ATS record created — req #ENG-204", tag: "ok", tagLabel: "Created" },
    { ts: "08:33:12", text: "Screen scored on job-relevant rubric — no protected-class data used", tag: "mod", tagLabel: "EEO" },
    { ts: "08:34:05", text: "Offer letter drafted (L5 band) — awaiting sign-off", tag: "mod", tagLabel: "Pending" },
    { ts: "08:35:47", text: "Offer approved by David Okonkwo, Hiring Manager", tag: "ok", tagLabel: "Approved" },
    { ts: "10:14:22", text: "Disallowed filter (age proxy) blocked — fairness review escalated", tag: "esc", tagLabel: "Escalated" },
  ],

  // ---------------- OUTCOMES ----------------
  outcomesTitle: "What changes when agents own the busywork",
  outcomesIntro: "Directional outcomes our pilots target — validated on your own data, never assumed.",
  outcomes: [
    {
      value: "24/7",
      label: "Coverage, every channel",
      desc: "Apply page, job boards and SMS answered around the clock, in English and Spanish — no candidate waiting on a reply.",
    },
    {
      value: "Minutes",
      label: "From apply to recruiter brief",
      desc: "Résumé parsed, job-relevant screen scored and a cited brief assembled before a recruiter opens the record.",
    },
    {
      value: "Faster",
      label: "Time-to-fill",
      desc: "Scheduling, nudges and aging-req alerts compress the dead time between stages — fewer top candidates lost to a competing offer.",
    },
    {
      value: "Hours back",
      label: "For recruiters",
      desc: "Less screening, scheduling and re-keying, more time on relationships, calibration and the judgment calls that need a human.",
    },
  ],
  benchmarks: [
    {
      text: "Across US employers, time-to-fill has historically averaged roughly six weeks (about 42 days), which is enough delay for top candidates to take a competing offer.",
      cite: "SHRM Talent Acquisition Benchmarking Report",
    },
    {
      text: "SHRM benchmarking data puts the average cost per hire at roughly $4,700, with total cost to hire often estimated at three to four times the role's salary.",
      cite: "SHRM, The Real Costs of Recruitment",
    },
    {
      text: "Candidate-experience research finds that roughly 6 in 10 candidates lose interest in a role after about two weeks with no post-interview update — slow, silent pipelines cost you the hire.",
      cite: "RecruitBPM, Candidate Experience Statistics",
    },
  ],
  outcomesNote:
    "Figures above are external benchmarks and pilot targets, not guarantees — we validate every number on your own data before you rely on it. Monitoring agents are advisory: they alert and stage, a recruiter acts.",

  // ---------------- CTA ----------------
  ctaTitle: "Start with one req type. Prove it. Then scale.",
  ctaIntro:
    "We stand up a single workflow on your existing ATS, show the audit trail and the outcomes, and expand only once your team trusts it.",
  ctaSteps: [
    {
      n: "01",
      title: "Scope one workflow",
      desc: "Pick the highest-pain workflow — high-volume screening, scheduling or pipeline watch — and we map it to your ATS.",
    },
    {
      n: "02",
      title: "Pilot in your environment",
      desc: "Agents run on your ATS with a recruiter in the loop, EEOC guardrails on, and a full audit trail, in weeks not quarters.",
    },
    {
      n: "03",
      title: "Measure, then expand",
      desc: "Review the outcomes on your own data — time-to-fill, source quality, candidate experience — then roll the agent team out req type by req type.",
    },
  ],

  // ---------------- FAQ (drives FAQPage JSON-LD) ----------------
  faq: [
    {
      q: "Does Rach.Dev replace our ATS?",
      a: "No. Rach.Dev is an operations layer that runs on top of your existing ATS (Greenhouse, Lever, Workday and others) over their APIs. Your system of record stays exactly where it is.",
    },
    {
      q: "How do the agents stay EEOC compliant?",
      a: "Screening runs on job-relevant criteria only — never protected characteristics. Ban-the-box and fair-chance rules are configurable per jurisdiction, disallowed filters are refused and escalated, and every screen decision is logged for OFCCP/EEO review.",
    },
    {
      q: "Do the AI agents make hiring decisions?",
      a: "No. Every hiring decision — advance, reject, offer — pauses for a recruiter or hiring manager to approve. The agents draft, score, schedule and stage; a human decides. Monitoring agents are advisory only.",
    },
    {
      q: "Do the agents work in languages other than English?",
      a: "Yes. Intake, screening questions, reminders and candidate answers support English and Spanish out of the box, across the careers page, SMS and email.",
    },
    {
      q: "How is candidate data handled and retained?",
      a: "Candidate data is kept to a configurable retention window and then deleted to meet your policy and applicable regulations. Access is role-based, and every data touch is written to the audit trail.",
    },
  ],
};
