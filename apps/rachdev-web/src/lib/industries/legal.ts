import type { IndustryConfig } from "./types";

/**
 * Legal (US law-firm) industry config.
 *
 * Content is authored for a US law-firm buyer — client intake & qualification,
 * conflict checks, document drafting, billing, and an always-on docket sentinel
 * watching statutes of limitation and filing deadlines. The hard guardrail is
 * the Unauthorized Practice of Law (UPL) line: agents never give legal advice,
 * interpret the law, or recommend a strategy — an attorney does. English +
 * Spanish. Interactions (Control Tower + relay + knowledge) are fully scripted;
 * no live model is called.
 */
export const legalConfig: IndustryConfig = {
  slug: "legal",
  vertical: "Legal",
  industrySlug: "legal",
  industryName: "Legal",
  icon: "scale",
  tagline:
    "An agent team for client intake, conflict checks, document drafting, billing and docket monitoring — on Clio or MyCase, with an attorney in the loop and a hard UPL guardrail.",
  seoTitle: "Legal AI Agents for Law Firms",
  seoDescription:
    "Rach.Dev is an AI operations layer for law firms — agents for client intake and case qualification, conflict checks, document drafting, billing and a docket sentinel for statutes of limitation and filing deadlines, on top of Clio, MyCase and NetDocuments, with an attorney in the loop and a strict no-legal-advice (UPL) guardrail.",
  seoKeywords: [
    "legal AI agents",
    "law firm AI",
    "client intake automation",
    "case qualification AI",
    "conflict check automation",
    "legal document drafting AI",
    "docket and deadline monitoring",
    "Clio automation",
    "UPL guardrail",
  ],

  // ---------------- HERO ----------------
  eyebrow: "Legal · Agentic Operations Layer",
  h1Lines: ["The AI operations layer", "for your law firm."],
  rotorLead: "Put a team of agents on your",
  rotorWords: ["intake.", "conflict checks.", "drafting.", "billing.", "docket watch."],
  subhead:
    "Rach.Dev runs client intake and case qualification, conflict screening, document drafting, billing and docket monitoring across Clio, MyCase and the tools you already use — with an attorney in the loop on every filing and engagement, and a hard line on legal advice.",
  trustRow: [
    "UPL guardrail — never legal advice",
    "Works with Clio & MyCase",
    "Attorney-in-the-loop",
    "English & Spanish",
  ],
  heroPrimaryCta: { label: "Book a pilot", href: "/contact" },
  heroSecondaryCta: { label: "See the architecture", href: "#architecture" },

  // ---------------- OPERATING PICTURE ----------------
  operateEyebrow: "The operating picture",
  operateTitle: "What an agent team takes off your desk",
  operateIntro:
    "Most of a firm's load isn't legal judgement — it's intake, screening, paperwork and chasing deadlines. Here's where agents own the busywork, mapped to how your firm actually runs.",
  domains: [
    {
      icon: "door",
      title: "The Front Door",
      blurb: "Every inquiry captured, qualified and routed — 24/7, in English or Spanish.",
      bullets: [
        "Multi-channel intake (web form, phone, SMS, chat)",
        "Practice-area questions asked automatically",
        "Structured intake packet ready for attorney review",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "triage",
      title: "Conflicts & Risk",
      blurb: "Conflict check and case screening before a lawyer ever picks up the file.",
      bullets: [
        "Adverse-party and existing-client conflict search",
        "Case-viability scoring against your firm's criteria",
        "Statute-of-limitation flag on time-sensitive matters",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "scribe",
      title: "Document Drafting",
      blurb: "First drafts from your templates — the attorney edits and signs, not types.",
      bullets: [
        "Engagement letters, demand letters, basic contracts",
        "Pulled from your firm's templates and matter facts",
        "Strict UPL guardrails — never legal advice",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "calendar",
      title: "Matter Coordination",
      blurb: "Calendaring, e-filing prep, client updates and the follow-up no one gets to.",
      bullets: [
        "Deadlines and court dates on the matter calendar",
        "E-filing packets staged for attorney review",
        "Proactive case-status updates to the client (EN / ES)",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "revenue",
      title: "Billing & Time",
      blurb: "Capture every billable minute and get clean invoices out the door faster.",
      bullets: [
        "Time capture from matter activity and notes",
        "Pre-bill review against engagement terms",
        "Trust-accounting and retainer rules respected",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "monitor",
      title: "Docket & Deadlines",
      blurb: "The always-on watch on statutes of limitation and filing deadlines.",
      bullets: [
        "Statute-of-limitation and filing-deadline tracking",
        "Court-rule-aware deadline calculation per jurisdiction",
        "Escalation as a deadline approaches — advisory only",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "users",
      title: "Back-Office & Compliance",
      blurb: "Bar-rule checks, records and the compliance paperwork no one wants to do.",
      bullets: [
        "State-bar advertising and solicitation rule checks",
        "Records retention and matter-file hygiene",
        "Client feedback and complaint handling",
      ],
      tag: { label: "In your build", tone: "muted" },
    },
    {
      icon: "knowledge",
      title: "Knowledge Layer",
      blurb: "A role-aware assistant grounded only in your approved sources.",
      bullets: [
        "Separate views for client, attorney, staff",
        "Every answer cites its source",
        "Hard guardrails — never legal advice",
      ],
      tag: { label: "In demo", tone: "live" },
    },
  ],

  // ---------------- CONTROL TOWER ----------------
  towerTitle: "Watch the team run a matter",
  towerIntro:
    "Pick a matter and press play. Watch the agent team run it end to end — an attorney approves every engagement and every filing.",
  subjectNoun: "matter",
  stages: [
    { key: "door", label: "Intake", icon: "door" },
    { key: "conflicts", label: "Conflicts", icon: "shield" },
    { key: "draft", label: "Drafting", icon: "scribe" },
    { key: "review", label: "Review", icon: "diagnostics" },
    { key: "decision", label: "Decision", icon: "decision" },
    { key: "coord", label: "Coordination", icon: "coord" },
    { key: "follow", label: "Follow-up", icon: "follow" },
  ],
  scenarios: [
    {
      key: "sol",
      tabLabel: "SOL deadline risk",
      tabIcon: "alarm",
      subjectName: "Daniel Foster · Auto injury",
      subjectDesc: "Car-accident PI inquiry, deadline near",
      channel: "Web form · Personal injury",
      channelIcon: "door",
      steps: [
        {
          agent: "intake",
          stage: "door",
          title: "Inquiry captured & qualified",
          detail:
            "Web inquiry captured in seconds; practice-area questions asked and a structured PI intake packet built for review.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "monitor",
          stage: "conflicts",
          title: "Statute of limitation — deadline near",
          detail:
            "Accident date puts the two-year PI statute ~5 weeks out. Docket Sentinel flags it urgent and pages the on-call attorney.",
          status: "esc",
          ms: 1400,
        },
        {
          agent: "triage",
          stage: "conflicts",
          title: "Conflict check clear",
          detail:
            "Adverse driver and insurer screened against existing clients and prior matters — no conflict found.",
          status: "ok",
          ms: 1200,
        },
        {
          agent: "scribe",
          stage: "draft",
          title: "Engagement letter drafted",
          detail:
            "Contingency-fee engagement letter drafted from the firm template with the matter facts — no legal advice given.",
          status: "ok",
          ms: 1200,
        },
        {
          agent: "triage",
          stage: "decision",
          title: "Representation approved by the attorney",
          detail:
            "Attorney reviews viability, conflict result and the deadline, then approves taking the case — Rach.Dev never decides this alone.",
          status: "gate",
          gateBy: "Sarah Whitman · Partner",
          ms: 1400,
        },
        {
          agent: "coord",
          stage: "coord",
          title: "Docket armed & filing staged",
          detail:
            "SOL and key dates added to the matter calendar; a preservation-of-claim filing packet staged for attorney sign-off.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "revenue",
          stage: "follow",
          title: "Matter opened & client updated",
          detail:
            "Matter opened in Clio, contingency terms recorded, and the client sent a welcome with next steps.",
          status: "ok",
          ms: 1100,
        },
      ],
    },
    {
      key: "contract",
      tabLabel: "Business client",
      tabIcon: "briefcase",
      subjectName: "Meridian Foods LLC · Vendor contract",
      subjectDesc: "Existing client, contract review request",
      channel: "Email · Business law",
      channelIcon: "mail",
      steps: [
        {
          agent: "intake",
          stage: "door",
          title: "Request logged to the matter",
          detail:
            "Inbound request identified to an existing client and routed to their open corporate matter.",
          status: "ok",
          ms: 1000,
        },
        {
          agent: "triage",
          stage: "conflicts",
          title: "No new conflict; scope confirmed",
          detail:
            "Counterparty screened — no conflict; the request falls inside the existing engagement scope.",
          status: "ok",
          ms: 1000,
        },
        {
          agent: "scribe",
          stage: "draft",
          title: "Redline draft prepared",
          detail:
            "Vendor agreement compared to the firm's standard clause library; a first-pass redline drafted for the attorney.",
          status: "ok",
          ms: 1200,
        },
        {
          agent: "knowledge",
          stage: "review",
          title: "Clause references surfaced — no advice",
          detail:
            "Pulled the firm's approved precedent and playbook notes for the attorney, with sources — and gave no legal opinion.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "scribe",
          stage: "decision",
          title: "Redline released — attorney approves",
          detail:
            "Nothing leaves the firm until the attorney reviews the redline and approves it for the client.",
          status: "gate",
          gateBy: "Marcus Bell · Senior Associate",
          ms: 1200,
        },
        {
          agent: "coord",
          stage: "coord",
          title: "Sent & calendared",
          detail:
            "Approved redline sent to the client; a follow-up and the negotiation call placed on the matter calendar.",
          status: "ok",
          ms: 1000,
        },
        {
          agent: "revenue",
          stage: "follow",
          title: "Time captured & pre-billed",
          detail:
            "Drafting and review time captured against the matter and queued for the next pre-bill review.",
          status: "ok",
          ms: 1000,
        },
      ],
    },
    {
      key: "sms",
      tabLabel: "After-hours text",
      tabIcon: "message",
      subjectName: "Lucía Ramírez · Family law",
      subjectDesc: "After-hours text, in Spanish",
      channel: "SMS · After hours",
      channelIcon: "message",
      steps: [
        {
          agent: "intake",
          stage: "door",
          title: "Spanish text understood & answered",
          detail:
            "Inbound SMS in Spanish recognized at 10:20 PM; prospect engaged and intake questions asked in her own language.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "conflicts",
          title: "Screened & time-sensitivity checked",
          detail:
            "Conflict screen run on the opposing party; no immediate filing deadline detected for the inquiry.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "knowledge",
          stage: "review",
          title: "Grounded answer, no legal advice",
          detail:
            "Answered her question about the firm's process and fees from approved materials, with sources — and explicitly declined to advise on her case.",
          status: "ok",
          ms: 1200,
        },
        {
          agent: "coord",
          stage: "decision",
          title: "Consult slot held — attorney confirms",
          detail:
            "A morning consultation slot is held; the on-call attorney approves before it is promised to the prospect.",
          status: "gate",
          gateBy: "Elena Cruz · Attorney",
          ms: 1200,
        },
        {
          agent: "intake",
          stage: "follow",
          title: "Confirmed in Spanish + reminder",
          detail:
            "Sent the confirmed consultation time and what to bring in Spanish, with a reminder the morning of.",
          status: "ok",
          ms: 1000,
        },
      ],
    },
  ],
  gateNote:
    "Every engagement and filing waits for an attorney. Rach.Dev drafts, screens and stages — a licensed lawyer approves.",
  completeToast: "Matter complete — every engagement and filing was attorney-approved",

  // ---------------- ROSTER (relay) ----------------
  rosterTitle: "Seven specialists, one conductor",
  rosterIntro:
    "Each agent owns one job and hands the next a complete, structured matter context. Atlas routes the work, enforces the attorney-in-the-loop gates and the UPL guardrail, and writes every action to an audit log.",
  rosterClickNote: "Click Ava below — the full intake-to-billing workflow plays out automatically.",
  orchestratorName: "Atlas",
  orchestratorBlurb:
    "Atlas is the orchestrator. It routes each matter to the right specialist, carries shared client and matter context between them, pauses for attorney approval on every engagement and filing, enforces the no-legal-advice line, and records a complete, timestamped audit trail.",
  relayTriggerAgentKey: "intake",
  relayCompleteToast: "Workflow complete — all agents processed Daniel Foster's matter",
  agents: [
    {
      key: "intake",
      name: "Ava",
      role: "Client Intake & Qualification",
      icon: "intake",
      blurb:
        "The front door. Captures every inquiry across web, phone, SMS and chat, asks the right practice-area questions, and builds a structured intake packet — 24/7, in English or Spanish.",
      tags: ["Multi-channel intake", "Case qualification", "EN / ES"],
      pipeSub: "Intake",
      workMs: 2000,
      voice: {
        listeningTitle: "Listening…",
        listeningSub: "Capturing client intake by voice",
        doneTitle: "Intake complete",
        doneSub: "6 fields captured · handing off to the team…",
        handoffToast: "Ava done — watch the team pick it up",
        fields: [
          { label: "Prospect", value: "Daniel Foster" },
          { label: "Matter type", value: "Personal injury — auto accident" },
          { label: "Facts", value: "Rear-ended on I-35; injuries, treatment ongoing" },
          { label: "Incident date", value: "Captured — SOL clock confirmed", ok: true },
          { label: "Conflict screen", value: "No adverse-party conflict found", ok: true },
          { label: "Channel", value: "Web form · English" },
        ],
      },
    },
    {
      key: "triage",
      name: "Marcus",
      role: "Conflicts & Case Screen",
      icon: "shield",
      blurb:
        "Conflicts and risk. Runs the adverse-party and existing-client conflict search, scores case viability against your firm's criteria, and flags any time-sensitive deadline before a lawyer touches the file.",
      tags: ["Conflict search", "Viability scoring", "Deadline flag"],
      pipeSub: "Conflicts",
      workMs: 2100,
      flow: [
        {
          fromLabel: "Context from Ava",
          chips: ["Daniel Foster", "PI — auto accident", "Treatment ongoing"],
        },
        {
          steps: [
            { text: "Conflict search clear — adverse driver + insurer screened", kind: "ok" },
            { text: "Viability scored against firm intake criteria — strong fit", kind: "ok" },
            { text: "Statute of limitation flagged — ~5 weeks out, escalated", kind: "esc" },
          ],
          note: "Marcus screens and scores. The decision to take the case is the attorney's.",
        },
      ],
    },
    {
      key: "scribe",
      name: "Nora",
      role: "Document Drafting",
      icon: "scribe",
      blurb:
        "Document drafting. Builds first drafts — engagement letters, demand letters, contract redlines — from your firm's templates and the matter facts, leaving the attorney to edit and sign, not type.",
      tags: ["Template drafting", "Redlines", "UPL guardrails"],
      pipeSub: "Drafting",
      workMs: 2000,
      flow: [
        {
          fromLabel: "Context from Marcus",
          chips: ["Strong fit", "Contingency PI matter", "SOL ~5 weeks"],
        },
        {
          steps: [
            { text: "Engagement letter drafted from the firm template", kind: "ok" },
            { text: "Matter facts and fee terms merged in cleanly", kind: "ok" },
            { text: "Strategy / legal-opinion request → routed to the attorney", kind: "esc" },
          ],
          note: "Draft only. Nora never gives legal advice — an attorney reviews and signs before anything is sent.",
        },
      ],
    },
    {
      key: "coord",
      name: "Owen",
      role: "Matter Coordination",
      icon: "coord",
      blurb:
        "Matter coordination. Calendars deadlines and court dates, stages e-filing packets, routes documents, and keeps clients informed with proactive case-status updates.",
      tags: ["Calendaring", "E-filing prep", "Client updates"],
      pipeSub: "Coord",
      workMs: 1900,
      flow: [
        {
          fromLabel: "Context from Nora",
          chips: ["Engagement signed", "SOL + key dates", "Client welcome"],
        },
        {
          steps: [
            { text: "SOL and key dates added to the matter calendar", kind: "ok" },
            { text: "Preservation-of-claim filing packet staged for sign-off", kind: "ok" },
            { text: "Client welcome and next-steps update sent (EN / ES)", kind: "ok" },
          ],
        },
      ],
    },
    {
      key: "revenue",
      name: "Riley",
      role: "Billing & Time",
      icon: "revenue",
      blurb:
        "Billing and time. Captures billable activity against the matter, runs pre-bill review against the engagement terms, and respects trust-accounting and retainer rules before an invoice goes out.",
      tags: ["Time capture", "Pre-bill review", "Trust accounting"],
      pipeSub: "Billing",
      workMs: 2000,
      flow: [
        {
          fromLabel: "Context from Owen",
          chips: ["Matter opened", "Contingency terms", "Activity logged"],
        },
        {
          steps: [
            { text: "Billable activity captured against the matter from notes", kind: "ok" },
            { text: "Pre-bill checked against the engagement's fee terms", kind: "ok" },
            { text: "Trust / retainer rules respected → queued for review", kind: "ok" },
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
        "The role-aware knowledge assistant. Answers clients, attorneys and staff from your approved sources only — every answer cited, and a legal question is always handed to a lawyer, never advised.",
      tags: ["Role-aware", "Cited answers", "Never legal advice"],
      pipeSub: "Knowledge",
      workMs: 1900,
      flow: [
        {
          fromLabel: "Context from Riley",
          chips: ["Client view", "Approved sources only", "EN / ES"],
        },
        {
          steps: [
            { text: "Answered process and fee questions from approved materials", kind: "ok" },
            { text: "Every answer carried its source citation", kind: "ok" },
            { text: "Legal-advice request → handed to an attorney, not answered", kind: "esc" },
          ],
          note: "Iris informs. It never gives legal advice, interprets the law, or recommends a strategy.",
        },
      ],
    },
    {
      key: "monitor",
      name: "Hope",
      role: "Docket Sentinel",
      icon: "monitor",
      blurb:
        "The Docket Sentinel. Always on, watching every matter's statutes of limitation, filing deadlines and conflict surface — surfacing a deadline weeks before it bites, and staging the response for the attorney.",
      tags: ["Always-on monitor", "Deadline early-warning", "Advisory only"],
      pipeSub: "Docket",
      workMs: 2400,
      live: { label: "Live · Docket" },
      flow: [
        {
          fromLabel: "Context from the matter team",
          chips: ["Open matters: 214", "SOL clocks running", "E-filing calendars synced"],
        },
        {
          fromLabel: "How Hope calibrates for this firm",
          steps: [
            { text: "Maps each matter to its jurisdiction and court rules", kind: "ok" },
            { text: "Computes statute and filing deadlines per claim type", kind: "ok" },
            { text: "Tiers reminders — 90 / 60 / 30 / 14 / 7 days out", kind: "ok" },
          ],
        },
        {
          fromLabel: "What Hope watches in real time",
          chips: ["SOL clocks", "Filing deadlines", "Court dates", "Conflicts", "Service windows", "Appeal periods"],
          steps: [
            { text: "Statute of limitation approaching with no filing on record", kind: "esc" },
            { text: "Court-ordered filing deadline inside the warning window", kind: "esc" },
            { text: "Response or answer due before the service deadline", kind: "esc" },
            { text: "Appeal period running on an adverse ruling", kind: "esc" },
            { text: "New conflict surfaced as a party is added to a matter", kind: "esc" },
            { text: "Hearing or deposition date with no prep task assigned", kind: "esc" },
          ],
          note: "Hope is advisory. It alerts and stages — an attorney decides and files. Every alert is logged with the matter and the deadline that triggered it.",
        },
      ],
    },
  ],

  // ---------------- ARCHITECTURE ----------------
  archTitle: "One layer over the systems you already run",
  archIntro:
    "Rach.Dev sits on top of your practice-management and document systems — orchestrating agents, enforcing governance and the UPL guardrail, and keeping an attorney in the loop. No rip-and-replace.",
  archLayers: [
    {
      n: "Layer 4",
      title: "Human-in-the-loop",
      icon: "decision",
      body: "Every engagement, filing and outbound document pauses for an attorney to approve. Agents draft and stage; lawyers decide.",
      pills: ["Approval gates", "Attorney sign-off", "Role-based access"],
    },
    {
      n: "Layer 3",
      title: "Governance & audit",
      icon: "shield",
      body: "UPL guardrails, privilege-aware access, conflict controls, and a complete, timestamped audit trail on every action and every document touch.",
      pills: ["UPL guardrail", "Full audit log", "Privilege-aware access", "Source citations"],
    },
    {
      n: "Layer 2",
      title: "Agent orchestration",
      icon: "orchestrator",
      body: "Atlas routes each matter to the right specialist, carries shared client and matter context between agents, and coordinates hand-offs end to end.",
      pills: ["Routing & hand-off", "Shared context", "Escalation paths"],
    },
    {
      n: "Layer 1",
      title: "Integration",
      icon: "plug",
      body: "Bidirectional connectors to your practice-management, document and e-filing systems over the APIs your tools already expose.",
      pills: ["Practice-mgmt APIs", "DMS sync", "Webhooks & APIs"],
    },
  ],
  archBaseLabel: "Works with the systems you already run",
  archBaseSystems: [
    "Clio",
    "MyCase",
    "NetDocuments",
    "Court e-filing",
    "Outlook",
    "iManage",
    "DocuSign",
    "QuickBooks",
  ],

  // ---------------- KNOWLEDGE ----------------
  knowledgeTitle: "A knowledge layer that knows its limits",
  knowledgeIntro:
    "Iris answers clients, attorneys and staff from your approved sources only. Every answer is cited — and a legal question is always handed to an attorney, never advised.",
  knowledgeAgentName: "Iris",
  knowledgeViewLabel: "Client view",
  knowledgeGreeting:
    "Hi, I'm Iris. Ask me about your matter status, fees or what to bring to a consultation — I'll always cite my source.",
  knowledgeDisclaimer:
    "Iris provides information only — never legal advice, an interpretation of the law, or a recommended strategy. Anything that calls for legal judgment is routed to a licensed attorney.",
  knowledge: [
    {
      q: "What's the status of my case?",
      a: "Your matter is in the discovery phase. Your attorney, Sarah Whitman, filed the demand on May 12 and we're awaiting the insurer's response, due by June 30. Your next scheduled item is a status call on June 24 at 2:00 PM. You can view updates anytime from the client portal.",
      src: ["Matter calendar", "Client portal"],
    },
    {
      q: "¿Cuánto cobran por una consulta inicial?",
      a: "La consulta inicial de derecho familiar es gratuita y dura unos 30 minutos. Si decide contratar al bufete, le explicaremos los honorarios por escrito en la carta de representación antes de comenzar. Si desea, puedo conectarla con nuestro equipo para agendar la consulta.",
      src: ["Fee schedule", "Engagement policy"],
    },
    {
      q: "Do I have a strong case, and should I sue?",
      a: "That calls for legal judgment, so I won't advise on it myself. I've routed your question and the facts you shared to an attorney, who will assess the merits and any deadlines and follow up with you directly. If a filing deadline is close, we'll prioritize your consultation.",
      src: ["Matter facts", "Attorney routing"],
    },
  ],

  // ---------------- GOVERNANCE ----------------
  governanceTitle: "Governance, not just guardrails",
  governanceIntro:
    "The controls that let a firm actually deploy agents — enforced in the system, not promised on a slide.",
  guarantees: [
    {
      title: "Attorney in the loop",
      desc: "Every engagement, filing and outbound document waits for a licensed attorney to approve. No agent takes a legal action on its own.",
    },
    {
      title: "Complete audit trail",
      desc: "Every action, hand-off and document access is logged with a timestamp, the agent, the source and the approver — exportable on demand.",
    },
    {
      title: "Privilege & UPL safeguards",
      desc: "Matter data stays in your systems under your control, attorney-client privilege is preserved, and a hard UPL guardrail keeps agents from ever giving legal advice.",
    },
    {
      title: "Grounded with sources",
      desc: "Answers come only from your approved knowledge sources and cite them. No open-web guessing, no ungrounded claims.",
    },
    {
      title: "No vendor lock-in",
      desc: "Standards-based connectors to Clio, MyCase and your DMS, and your data stays yours. Turn an agent off and your systems keep running.",
    },
  ],
  auditTitle: "Live audit log",
  auditIntro: "A sample of what every action looks like on the record.",
  auditLines: [
    { ts: "22:21:04", text: "Inbound SMS (es) received & answered — prospect #1187", tag: "ok", tagLabel: "Logged" },
    { ts: "09:02:18", text: "Conflict search run — no adverse-party conflict found", tag: "ok", tagLabel: "Cleared" },
    { ts: "09:03:46", text: "Matter file accessed: intake pre-load (least privilege)", tag: "mod", tagLabel: "Access" },
    { ts: "09:06:11", text: "Engagement letter drafted — awaiting attorney sign-off", tag: "mod", tagLabel: "Pending" },
    { ts: "09:07:55", text: "Engagement approved by Sarah Whitman, Partner", tag: "ok", tagLabel: "Approved" },
    { ts: "14:40:09", text: "SOL deadline ~5 weeks out — on-call attorney paged", tag: "esc", tagLabel: "Escalated" },
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
      label: "From inquiry to intake packet",
      desc: "Qualified intake and a conflict check done before the prospect calls the next firm on the list.",
    },
    {
      value: "Zero-miss",
      label: "Deadline visibility",
      desc: "Statutes of limitation and filing deadlines watched continuously, surfaced weeks ahead — advisory to the attorney.",
    },
    {
      value: "Hours back",
      label: "For attorneys",
      desc: "Less drafting and chasing, more time on the substantive legal work that needs human judgment.",
    },
  ],
  benchmarks: [
    {
      text: "Firms that contact a new web lead within about five minutes are far more likely to qualify it than firms that wait even 30 minutes — speed to first response is decisive.",
      cite: "Harvard Business Review, The Short Life of Online Sales Leads (2011)",
    },
    {
      text: "Lawyers bill only about 2.6 hours of an 8-hour day on average — roughly a third — with much of the rest lost to intake, admin and non-billable work.",
      cite: "Clio Legal Trends Report",
    },
    {
      text: "Administrative errors such as failure to calendar a known deadline are a leading cause of legal malpractice claims, accounting for a large share of claims year over year.",
      cite: "ABA Standing Committee on Lawyers' Professional Liability, Profile of Legal Malpractice Claims",
    },
  ],
  outcomesNote:
    "Figures above are external benchmarks and pilot targets, not guarantees — we validate every number on your own data before you rely on it. Monitoring agents are advisory: they alert and stage, an attorney acts.",

  // ---------------- CTA ----------------
  ctaTitle: "Start with one workflow. Prove it. Then scale.",
  ctaIntro:
    "We stand up a single workflow on your existing practice-management system, show the audit trail and the outcomes, and expand only once your team trusts it.",
  ctaSteps: [
    {
      n: "01",
      title: "Scope one workflow",
      desc: "Pick the highest-pain workflow — client intake, conflict checks or docket monitoring — and we map it to your systems.",
    },
    {
      n: "02",
      title: "Pilot in your environment",
      desc: "Agents run on Clio or MyCase with an attorney in the loop and a full audit trail, in weeks not quarters.",
    },
    {
      n: "03",
      title: "Measure, then expand",
      desc: "Review the outcomes on your own data, then roll the agent team out practice area by practice area.",
    },
  ],

  // ---------------- FAQ (drives FAQPage JSON-LD) ----------------
  faq: [
    {
      q: "Does Rach.Dev replace our practice-management system?",
      a: "No. Rach.Dev is an operations layer that runs on top of your existing tools — Clio, MyCase, NetDocuments, court e-filing and Outlook — over the APIs they already expose. Your systems of record stay exactly where they are.",
    },
    {
      q: "Do the AI agents give legal advice?",
      a: "Never. A hard Unauthorized Practice of Law (UPL) guardrail keeps agents from giving legal advice, interpreting the law, or recommending a strategy. They draft from your templates, screen and stage; any legal question is routed to a licensed attorney.",
    },
    {
      q: "How is attorney-client privilege protected?",
      a: "Matter data stays in your systems under your control with privilege-aware, least-privilege access. Every document touch is logged, and agent conversations are stored under the firm's control — not shared with third parties.",
    },
    {
      q: "How does the docket sentinel handle deadlines?",
      a: "Docket Sentinel watches every matter's statutes of limitation, filing deadlines, court dates and appeal periods, computes them per jurisdiction, and escalates as a deadline approaches. It is advisory — it alerts and stages, and an attorney decides and files.",
    },
    {
      q: "Do the agents work in languages other than English?",
      a: "Yes. Intake, reminders and client answers support English and Spanish out of the box, across web, phone, SMS and chat.",
    },
  ],
};
