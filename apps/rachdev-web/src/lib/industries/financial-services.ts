import type { IndustryConfig } from "./types";

/**
 * Financial Services (US banking / wealth / fintech) industry config.
 *
 * Content is authored for a US bank, credit union, wealth manager or fintech
 * buyer — KYC/CIP onboarding, BSA/AML, OFAC sanctions screening, SEC/FINRA
 * suitability boundaries, English + Spanish — and renders entirely in the
 * Rach.Dev design system. Interactions (Control Tower + relay + knowledge) are
 * fully scripted; no live model is called.
 */
export const financialServicesConfig: IndustryConfig = {
  slug: "financial-services",
  vertical: "Financial Services",
  industrySlug: "financial-services",
  industryName: "Financial Services",
  icon: "landmark",
  tagline:
    "An agent team for KYC onboarding, identity verification, transaction support, AML/sanctions screening and fraud monitoring — on your core banking stack, with a compliance officer in the loop.",
  seoTitle: "Financial Services AI Agents for Banks, Credit Unions & Fintechs",
  seoDescription:
    "Rach.Dev is a compliance-first AI operations layer for banks, credit unions, wealth managers and fintechs — agents for KYC onboarding, identity verification, transaction support, BSA/AML and sanctions screening, and real-time fraud monitoring, on top of your core banking systems, with a compliance officer in the loop and SEC/FINRA guardrails.",
  seoKeywords: [
    "financial services AI agents",
    "KYC onboarding automation",
    "AML transaction monitoring AI",
    "identity verification agent",
    "fraud detection AI banking",
    "sanctions screening automation",
    "BSA AML compliance agents",
    "fintech onboarding automation",
  ],

  // ---------------- HERO ----------------
  eyebrow: "Financial Services · Agentic Operations Layer",
  h1Lines: ["The AI operations layer", "for your institution."],
  rotorLead: "Put a team of agents on your",
  rotorWords: ["onboarding.", "identity checks.", "transaction support.", "AML & sanctions.", "fraud watch."],
  subhead:
    "Rach.Dev runs KYC onboarding, identity verification, transaction support, AML and sanctions screening, and real-time fraud monitoring across the systems you already use — with a compliance officer in the loop on every regulated decision, and a full audit trail on every action.",
  trustRow: [
    "Compliance-first by design",
    "Works with your core banking stack",
    "Compliance-officer-in-the-loop",
    "English & Spanish",
  ],
  heroPrimaryCta: { label: "Book a pilot", href: "/contact" },
  heroSecondaryCta: { label: "See the architecture", href: "#architecture" },

  // ---------------- OPERATING PICTURE ----------------
  operateEyebrow: "The operating picture",
  operateTitle: "What an agent team takes off your floor",
  operateIntro:
    "Most of an institution's load isn't underwriting judgement — it's identity checks, document chasing, balance questions and alert triage. Here's where agents own the regulated busywork, mapped to how your institution actually runs.",
  domains: [
    {
      icon: "door",
      title: "The Front Door",
      blurb: "Every application captured, qualified and routed — 24/7, in English or Spanish.",
      bullets: [
        "Multi-channel intake (web, phone, SMS, in-branch)",
        "CIP data capture & document collection",
        "Application status, no drop-off at the hard part",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "fingerprint",
      title: "Identity & KYC",
      blurb: "Identity proofed and verified against your KYC and sanctions sources, edge cases routed.",
      bullets: [
        "Document + selfie liveness via verification APIs",
        "OFAC / PEP / watchlist screening on every applicant",
        "Edge cases routed to a compliance officer",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "creditCard",
      title: "Transaction Support",
      blurb: "Balances, transfers and payment troubleshooting — over your core banking, securely.",
      bullets: [
        "Balance & transaction-history inquiries",
        "Transfers, payments & dispute intake",
        "Step-up verification before anything moves",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "shieldAlert",
      title: "AML & Sanctions",
      blurb: "The full loop — screening, alert triage and SAR-ready packets, escalated the moment it trips.",
      bullets: [
        "Sanctions / watchlist hits triaged with context",
        "Structuring & layering patterns flagged",
        "SAR / CTR packets staged for the BSA officer",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "trendingUp",
      title: "Servicing & Coordination",
      blurb: "Onboarding hand-offs, advisor scheduling and the follow-ups customers never get.",
      bullets: [
        "Account funding, card issuance & welcome flows",
        "Advisor / banker scheduling and warm hand-offs",
        "Reminders & nudges (EN / ES)",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "fileCheck",
      title: "Disputes & Recovery",
      blurb: "Chargebacks, Reg E disputes and clean case files — the fastest relief for ops.",
      bullets: [
        "Dispute intake with the right evidence captured",
        "Reg E / chargeback timelines tracked",
        "Provisional-credit packets staged for review",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "users",
      title: "Back-Office & Compliance Ops",
      blurb: "CDD refresh, audit prep and the regulatory paperwork no one wants to do.",
      bullets: [
        "Periodic CDD / EDD refresh reminders & capture",
        "Exam & audit evidence assembled on demand",
        "Complaint logging & response tracking",
      ],
      tag: { label: "In your build", tone: "muted" },
    },
    {
      icon: "knowledge",
      title: "Knowledge Layer",
      blurb: "A role-aware assistant grounded only in your approved sources.",
      bullets: [
        "Separate views for customer, banker, compliance",
        "Every answer cites its source",
        "Hard guardrails — never investment advice",
      ],
      tag: { label: "In demo", tone: "live" },
    },
  ],

  // ---------------- CONTROL TOWER ----------------
  towerTitle: "Watch the team run a case",
  towerIntro:
    "Pick a case and press play. Watch the agent team run it end to end — a compliance officer approves every regulated action.",
  subjectNoun: "customer",
  stages: [
    { key: "door", label: "Front Door", icon: "door" },
    { key: "identity", label: "Identity & KYC", icon: "fingerprint" },
    { key: "screening", label: "Screening", icon: "shieldAlert" },
    { key: "transaction", label: "Transaction", icon: "creditCard" },
    { key: "decision", label: "Decision", icon: "decision" },
    { key: "servicing", label: "Servicing", icon: "trendingUp" },
    { key: "follow", label: "Follow-up", icon: "follow" },
  ],
  scenarios: [
    {
      key: "onboarding",
      tabLabel: "New account",
      tabIcon: "userPlus",
      subjectName: "Robert Daniels · Checking",
      subjectDesc: "New retail checking application — web",
      channel: "Web · Onboarding",
      channelIcon: "door",
      steps: [
        {
          agent: "intake",
          stage: "door",
          title: "Application captured & started",
          detail:
            "CIP fields and ID document collected on the web flow; application opened and saved without the usual drop-off.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "identity",
          title: "Identity proofed & verified",
          detail:
            "Document + selfie liveness matched via the verification API; name, DOB and SSN reconciled to the application.",
          status: "ok",
          ms: 1200,
        },
        {
          agent: "scribe",
          stage: "screening",
          title: "Sanctions & watchlist screen clean",
          detail:
            "OFAC, PEP and internal watchlists screened — no hits; KYC packet assembled with every check cited.",
          status: "ok",
          ms: 1200,
        },
        {
          agent: "coord",
          stage: "transaction",
          title: "Account staged & funding queued",
          detail: "Checking account configured and initial ACH funding (Plaid-linked) staged, pending approval.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "decision",
          title: "Account opening approved by compliance",
          detail:
            "Compliance officer reviews the KYC packet and approves account opening — Rach.Dev never opens an account alone.",
          status: "gate",
          gateBy: "Dana Whitfield · BSA/Compliance",
          ms: 1300,
        },
        {
          agent: "monitor",
          stage: "servicing",
          title: "Fraud & AML watch armed",
          detail:
            "Continuous transaction monitoring enabled on the new account; structuring and anomaly alerts wired to the team.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "revenue",
          stage: "follow",
          title: "Funded, carded & welcomed",
          detail:
            "Account funded after sign-off, debit card issued, and a Spanish-language welcome + next-steps sequence scheduled.",
          status: "ok",
          ms: 1100,
        },
      ],
    },
    {
      key: "aml",
      tabLabel: "AML alert",
      tabIcon: "shieldAlert",
      subjectName: "Vortex Trading LLC · Business",
      subjectDesc: "Rapid cash deposits across branches",
      channel: "System · AML monitor",
      channelIcon: "monitor",
      steps: [
        {
          agent: "monitor",
          stage: "transaction",
          title: "Structuring pattern detected",
          detail:
            "Six cash deposits of $9,400–$9,800 across three branches in 48 hours — a classic sub-$10K structuring signature.",
          status: "esc",
          ms: 1300,
        },
        {
          agent: "triage",
          stage: "screening",
          title: "Beneficial owners re-screened",
          detail:
            "Listed UBOs re-run against OFAC and PEP lists; one related party returns an adverse-media match for review.",
          status: "esc",
          ms: 1300,
        },
        {
          agent: "scribe",
          stage: "screening",
          title: "SAR packet drafted, not filed",
          detail:
            "Transaction timeline, counterparties and prior alerts assembled into a SAR-ready narrative — staged for review only.",
          status: "ok",
          ms: 1200,
        },
        {
          agent: "triage",
          stage: "decision",
          title: "SAR filing decision — BSA officer signs",
          detail:
            "The BSA officer reviews the packet and authorizes the SAR filing and account restriction — never filed automatically.",
          status: "gate",
          gateBy: "Marcus Lowell · BSA Officer",
          ms: 1400,
        },
        {
          agent: "coord",
          stage: "servicing",
          title: "Restriction applied & ticket opened",
          detail:
            "Outbound transfers held on the account after sign-off; an investigation case opened in the case-management system.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "revenue",
          stage: "follow",
          title: "Filed, logged & 90-day review set",
          detail:
            "SAR submitted via the e-filing channel, the full chain logged to the audit trail, and a 90-day continuing review scheduled.",
          status: "ok",
          ms: 1100,
        },
      ],
    },
    {
      key: "sms",
      tabLabel: "After-hours text",
      tabIcon: "message",
      subjectName: "María García · Cardholder",
      subjectDesc: "After-hours text, in Spanish",
      channel: "SMS · After hours",
      channelIcon: "message",
      steps: [
        {
          agent: "intake",
          stage: "door",
          title: "Spanish text understood & answered",
          detail:
            "Inbound SMS in Spanish recognized at 11:40 PM; cardholder identified and replied to in her own language.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "identity",
          title: "Step-up verification passed",
          detail:
            "One-time passcode and knowledge-based check completed before any account detail is discussed.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "monitor",
          stage: "transaction",
          title: "Suspected card fraud flagged",
          detail:
            "Two card-not-present charges in a new country in minutes — flagged as likely fraud, card temporarily frozen.",
          status: "esc",
          ms: 1300,
        },
        {
          agent: "knowledge",
          stage: "decision",
          title: "Grounded answer, no advice",
          detail:
            "Answered her dispute-and-liability questions from approved disclosures, with sources — and did not give investment or legal advice.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "coord",
          stage: "servicing",
          title: "Provisional credit held — analyst confirms",
          detail:
            "A Reg E provisional credit is staged; the on-call fraud analyst approves before it is promised to the customer.",
          status: "gate",
          gateBy: "Priya Nolan · Fraud Analyst",
          ms: 1200,
        },
        {
          agent: "intake",
          stage: "follow",
          title: "Confirmed in Spanish + replacement card",
          detail:
            "Sent the dispute confirmation and replacement-card ETA in Spanish, with a reminder when the new card ships.",
          status: "ok",
          ms: 1000,
        },
      ],
    },
  ],
  gateNote:
    "Every regulated action waits for a compliance officer. Rach.Dev drafts, stages and routes — a human approves.",
  completeToast: "Journey complete — every regulated action was compliance-approved",

  // ---------------- ROSTER (relay) ----------------
  rosterTitle: "Seven specialists, one conductor",
  rosterIntro:
    "Each agent owns one job and hands the next a complete, structured context. Atlas routes the work, enforces the human-in-the-loop gates, and writes every action to an audit log.",
  rosterClickNote: "Click Ava below — the full onboarding-to-servicing workflow plays out automatically.",
  orchestratorName: "Atlas",
  orchestratorBlurb:
    "Atlas is the orchestrator. It routes each case to the right specialist, carries shared customer context between them, pauses for compliance approval on every regulated action, and records a complete, timestamped audit trail.",
  relayTriggerAgentKey: "intake",
  relayCompleteToast: "Workflow complete — all agents processed Robert Daniels' account",
  agents: [
    {
      key: "intake",
      name: "Ava",
      role: "Onboarding · Intake",
      icon: "intake",
      blurb:
        "The front door. Captures every application across web, phone, SMS and branch, collects CIP data and documents, and opens a clean case — 24/7, in English or Spanish, with no drop-off at the hard part.",
      tags: ["Multi-channel intake", "CIP data & documents", "EN / ES"],
      pipeSub: "Intake",
      workMs: 2000,
      voice: {
        listeningTitle: "Listening…",
        listeningSub: "Capturing onboarding details by voice",
        doneTitle: "Intake complete",
        doneSub: "6 fields captured · handing off to the team…",
        handoffToast: "Ava done — watch the team pick it up",
        fields: [
          { label: "Applicant", value: "Robert Daniels" },
          { label: "Product", value: "Retail checking account" },
          { label: "CIP data", value: "Name, DOB, address, SSN captured" },
          { label: "ID document", value: "Driver's license uploaded & legible", ok: true },
          { label: "Identity proofing", value: "Selfie liveness matched to ID", ok: true },
          { label: "Channel", value: "Web · English" },
        ],
      },
    },
    {
      key: "triage",
      name: "Marcus",
      role: "Identity & KYC Screen",
      icon: "fingerprint",
      blurb:
        "Identity & KYC. Proofs identity, screens against OFAC, PEP and watchlists, and escalates any adverse hit straight to a compliance officer — never clearing a risky applicant on its own.",
      tags: ["Identity proofing", "Sanctions & PEP screening", "Escalation"],
      pipeSub: "KYC",
      workMs: 2100,
      flow: [
        {
          fromLabel: "Context from Ava",
          chips: ["Robert Daniels", "Retail checking", "ID + selfie captured"],
        },
        {
          steps: [
            { text: "Document + liveness verified via the verification API", kind: "ok" },
            { text: "OFAC / PEP / watchlist screen clean — no hits", kind: "ok" },
            { text: "Adverse hit would page the compliance officer instantly", kind: "esc" },
          ],
          note: "On any sanctions or adverse-media hit, Marcus stops and routes to a human — it never clears the case alone.",
        },
      ],
    },
    {
      key: "scribe",
      name: "Nora",
      role: "Compliance Documentation",
      icon: "scribe",
      blurb:
        "Compliance documentation. Assembles the KYC packet, drafts SAR/CTR narratives from the transaction record, and keeps every required disclosure attached — leaving the officer to decide, not assemble.",
      tags: ["KYC packets", "SAR / CTR drafting", "Disclosure attach"],
      pipeSub: "Docs",
      workMs: 2000,
      flow: [
        {
          fromLabel: "Context from Marcus",
          chips: ["Screen clean", "CIP complete", "Risk tier: standard"],
        },
        {
          steps: [
            { text: "KYC packet assembled with every check cited", kind: "ok" },
            { text: "Required disclosures attached for this product", kind: "ok" },
            { text: "SAR/CTR narrative drafted only when a pattern trips", kind: "ok" },
          ],
          note: "Draft only. A SAR or CTR is filed solely after a BSA officer reviews and signs.",
        },
      ],
    },
    {
      key: "coord",
      name: "Owen",
      role: "Servicing & Coordination",
      icon: "coord",
      blurb:
        "Servicing & coordination. Stages accounts and funding, books banker and advisor hand-offs, applies restrictions after sign-off, and keeps customers on track with reminders and nudges.",
      tags: ["Account staging", "Funding & hand-offs", "Reminders"],
      pipeSub: "Servicing",
      workMs: 1900,
      flow: [
        {
          fromLabel: "Context from Nora",
          chips: ["Account configured", "ACH funding (Plaid)", "Welcome sequence"],
        },
        {
          steps: [
            { text: "Account staged and initial funding queued for sign-off", kind: "ok" },
            { text: "Funding released and card issued after approval", kind: "ok" },
            { text: "Welcome + next-step reminders scheduled (EN / ES)", kind: "ok" },
          ],
        },
      ],
    },
    {
      key: "revenue",
      name: "Riley",
      role: "Disputes & Recovery",
      icon: "revenue",
      blurb:
        "Disputes & recovery. Intakes Reg E and chargeback disputes, captures the right evidence, tracks the regulatory clock, and stages provisional-credit packets — before anything is promised or paid.",
      tags: ["Reg E disputes", "Chargebacks", "Provisional credit"],
      pipeSub: "Disputes",
      workMs: 2000,
      flow: [
        {
          fromLabel: "Context from Owen",
          chips: ["Card-not-present fraud", "2 charges flagged", "Reg E timeline"],
        },
        {
          steps: [
            { text: "Dispute intake captured with evidence and timeline", kind: "ok" },
            { text: "Reg E / chargeback clock tracked against deadlines", kind: "ok" },
            { text: "Provisional-credit packet staged for analyst sign-off", kind: "ok" },
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
        "The role-aware knowledge assistant. Answers customers, bankers and compliance staff from your approved sources only — every answer cited, and never personalized investment advice.",
      tags: ["Role-aware", "Cited answers", "Never investment advice"],
      pipeSub: "Knowledge",
      workMs: 1900,
      flow: [
        {
          fromLabel: "Context from Riley",
          chips: ["Customer view", "Approved sources only", "EN / ES"],
        },
        {
          steps: [
            { text: "Answered the customer's questions from approved disclosures", kind: "ok" },
            { text: "Every answer carried its source citation", kind: "ok" },
            { text: "Investment-advice request → routed to a licensed advisor", kind: "esc" },
          ],
          note: "Iris informs. It never gives personalized investment advice, recommends securities, or overrides a licensed professional.",
        },
      ],
    },
    {
      key: "monitor",
      name: "Hope",
      role: "Fraud / AML Sentinel",
      icon: "monitor",
      blurb:
        "The Fraud / AML Sentinel. Always on, reading the live transaction stream across every account — flagging structuring, sanctions exposure and account takeover the moment it appears, and staging the response for the team.",
      tags: ["Always-on monitor", "Anomaly & structuring", "Advisory only"],
      pipeSub: "Fraud/AML",
      workMs: 2400,
      live: { label: "Live · Fraud/AML" },
      flow: [
        {
          fromLabel: "Context from the operations team",
          chips: ["Post-open monitoring", "Cash-intensive: watch", "Cross-border: watch"],
        },
        {
          fromLabel: "How Hope calibrates for this customer",
          steps: [
            { text: "Baselines normal volume, velocity and counterparties", kind: "ok" },
            { text: "Tightens thresholds for known structuring + ATO risk", kind: "ok" },
            { text: "Suppresses low-value noise to cut alert fatigue", kind: "ok" },
          ],
        },
        {
          fromLabel: "What Hope reads in real time",
          chips: ["Amount / velocity", "Geo / device", "Counterparties", "Sanctions lists", "Channel", "Patterns"],
          steps: [
            { text: "Structuring — repeated deposits just under the $10K CTR line", kind: "esc" },
            { text: "Sanctions exposure — counterparty matches an OFAC entry", kind: "esc" },
            { text: "Account takeover — login from a new device then a fast transfer", kind: "esc" },
            { text: "Card fraud — card-not-present charges in two countries in minutes", kind: "esc" },
            { text: "Layering — funds split and routed through linked accounts", kind: "esc" },
            { text: "Mule activity — inbound burst followed by rapid pass-through", kind: "esc" },
          ],
          note: "Hope is advisory. It alerts and stages — a compliance officer or fraud analyst decides and acts. Every alert is logged with the signal that triggered it.",
        },
      ],
    },
  ],

  // ---------------- ARCHITECTURE ----------------
  archTitle: "One layer over the systems you already run",
  archIntro:
    "Rach.Dev sits on top of your core banking platform and existing tools — orchestrating agents, enforcing governance, and keeping a compliance officer in the loop. No rip-and-replace.",
  archLayers: [
    {
      n: "Layer 4",
      title: "Human-in-the-loop",
      icon: "decision",
      body: "Every regulated action — account opening, restrictions, SAR/CTR filing, provisional credit — pauses for a compliance officer or analyst to approve. Agents draft and stage; people decide.",
      pills: ["Approval gates", "Compliance sign-off", "Role-based access"],
    },
    {
      n: "Layer 3",
      title: "Governance & audit",
      icon: "shield",
      body: "BSA/AML and SEC/FINRA-aligned controls, least-privilege access, and a complete, timestamped audit trail on every action and every data touch.",
      pills: ["BSA/AML-aligned", "Full audit log", "PII minimization", "Source citations"],
    },
    {
      n: "Layer 2",
      title: "Agent orchestration",
      icon: "orchestrator",
      body: "Atlas routes each case to the right specialist, carries shared context between agents, and coordinates hand-offs end to end.",
      pills: ["Routing & hand-off", "Shared context", "Escalation paths"],
    },
    {
      n: "Layer 1",
      title: "Integration",
      icon: "plug",
      body: "Bidirectional connectors to your core banking platform, account-data aggregator, KYC/sanctions APIs and CRM over the standards your systems already speak.",
      pills: ["Core banking APIs", "Plaid / aggregation", "Webhooks & APIs"],
    },
  ],
  archBaseLabel: "Works with the systems you already run",
  archBaseSystems: [
    "Core banking (FIS, Fiserv, Jack Henry)",
    "Plaid",
    "Sanctions / KYC APIs (LexisNexis, Refinitiv World-Check)",
    "Identity verification (Onfido, Persona, Socure)",
    "Salesforce Financial Services Cloud",
    "Twilio",
    "FinCEN BSA E-Filing",
    "Snowflake",
  ],

  // ---------------- KNOWLEDGE ----------------
  knowledgeTitle: "A knowledge layer that knows its limits",
  knowledgeIntro:
    "Iris answers customers, bankers and compliance staff from your approved sources only. Every answer is cited — and an investment or suitability question is always handed to a licensed advisor, never answered.",
  knowledgeAgentName: "Iris",
  knowledgeViewLabel: "Customer view",
  knowledgeGreeting:
    "Hi, I'm Iris. Ask me about your account, a transaction or a dispute — I'll always cite my source.",
  knowledgeDisclaimer:
    "Iris provides information only — never personalized investment, tax or legal advice. Anything requiring a licensed professional is routed to one.",
  knowledge: [
    {
      q: "Why was my account application put on hold?",
      a: "Your application is in a standard identity-verification review — a routine step for every new account under our Customer Identification Program. A compliance specialist is reviewing the documents you uploaded and will follow up within one business day. You can check status anytime by replying here or signing in to online banking.",
      src: ["CIP / KYC policy", "Onboarding status system"],
    },
    {
      q: "¿Por qué se congeló mi tarjeta y cómo recupero mi dinero?",
      a: "Congelamos su tarjeta temporalmente porque detectamos dos cargos inusuales en otro país en pocos minutos, lo que suele indicar fraude. Su responsabilidad por cargos no autorizados reportados a tiempo es limitada según la Regulación E. Ya abrimos una disputa y un analista revisará un crédito provisional; le enviaremos una tarjeta de reemplazo. Si no reconoce los cargos, confírmelo aquí.",
      src: ["Reg E disclosure", "Cardholder agreement", "Fraud case file"],
    },
    {
      q: "Should I move my savings into this fund — is it a good investment for me?",
      a: "That's a personalized investment question, so I won't advise on it myself — that requires a licensed professional. I've routed your question to a licensed financial advisor who can review your goals and suitability, and I can book a call. For general education, I can share our approved, non-advice materials with sources. This is information, not a recommendation.",
      src: ["SEC/FINRA disclosure policy", "Advisor routing", "Approved education library"],
    },
  ],

  // ---------------- GOVERNANCE ----------------
  governanceTitle: "Governance, not just guardrails",
  governanceIntro:
    "The controls that let a regulated institution actually deploy agents — enforced in the system, not promised on a slide.",
  guarantees: [
    {
      title: "Compliance officer in the loop",
      desc: "Every regulated action — account opening, restrictions, SAR/CTR filing, provisional credit — waits for a compliance officer or analyst to approve. No agent takes a regulated action on its own.",
    },
    {
      title: "Complete audit trail",
      desc: "Every action, hand-off and data access is logged with a timestamp, the agent, the source and the approver — exam- and audit-ready, exportable on demand.",
    },
    {
      title: "BSA/AML & SEC/FINRA-aligned",
      desc: "Least-privilege PII access, encryption in transit and at rest, role-based permissions, mandatory disclosures, and SEC/FINRA suitability guardrails — compliance built in, not bolted on.",
    },
    {
      title: "Grounded with sources",
      desc: "Answers come only from your approved knowledge sources and cite them. No open-web guessing, no ungrounded claims, never personalized investment advice.",
    },
    {
      title: "No vendor lock-in",
      desc: "Standards-based connectors to your core banking and data systems, and your data stays yours. Turn an agent off and your systems keep running.",
    },
  ],
  auditTitle: "Live audit log",
  auditIntro: "A sample of what every action looks like on the record.",
  auditLines: [
    { ts: "23:41:02", text: "Inbound SMS (es) received & answered — cardholder #7731", tag: "ok", tagLabel: "Logged" },
    { ts: "09:12:55", text: "Identity proofed — document + liveness matched", tag: "ok", tagLabel: "Verified" },
    { ts: "09:13:20", text: "PII accessed: KYC packet assembly (least privilege)", tag: "mod", tagLabel: "PII" },
    { ts: "09:15:08", text: "Account opening staged — awaiting compliance sign-off", tag: "mod", tagLabel: "Pending" },
    { ts: "09:15:47", text: "Account opening approved by Dana Whitfield, Compliance", tag: "ok", tagLabel: "Approved" },
    { ts: "14:02:31", text: "Structuring pattern detected — BSA officer paged", tag: "esc", tagLabel: "Escalated" },
  ],

  // ---------------- OUTCOMES ----------------
  outcomesTitle: "What changes when agents own the busywork",
  outcomesIntro: "Directional outcomes our pilots target — validated on your own data, never assumed.",
  outcomes: [
    {
      value: "24/7",
      label: "Coverage, every channel",
      desc: "Web, phone, SMS and branch answered around the clock, in English and Spanish — no after-hours voicemail.",
    },
    {
      value: "Minutes",
      label: "From apply to verified",
      desc: "CIP capture, identity proofing and screening done before the applicant has a chance to drop off.",
    },
    {
      value: "Faster",
      label: "Alert triage & SARs",
      desc: "Sanctions and structuring alerts triaged with context and SAR-ready packets staged — less manual assembly.",
    },
    {
      value: "Hours back",
      label: "For compliance teams",
      desc: "Less document chasing and packet building, more time on the judgment calls that need a human.",
    },
  ],
  benchmarks: [
    {
      text: "The IMF and FATF have long estimated that the amount of money laundered globally each year is on the order of 2–5% of global GDP — a scale that makes effective AML monitoring a strategic priority.",
      cite: "FATF / IMF, money-laundering scale estimate",
    },
    {
      text: "US consumers lost roughly $43 billion to identity fraud in 2023, underscoring the stakes for stronger onboarding and fraud controls.",
      cite: "Javelin Strategy & Research, 2024 Identity Fraud Study",
    },
    {
      text: "About 70% of financial institutions reported losing clients in the past year due to slow, inefficient onboarding and KYC processes — friction that automation directly targets.",
      cite: "Fenergo, KYC & onboarding trends survey (reported 2025)",
    },
  ],
  outcomesNote:
    "Figures above are external benchmarks and pilot targets, not guarantees — we validate every number on your own data before you rely on it. Monitoring agents are advisory: they alert and stage, a compliance officer acts.",

  // ---------------- CTA ----------------
  ctaTitle: "Start with one workflow. Prove it. Then scale.",
  ctaIntro:
    "We stand up a single workflow on your existing core banking stack, show the audit trail and the outcomes, and expand only once your team trusts it.",
  ctaSteps: [
    {
      n: "01",
      title: "Scope one workflow",
      desc: "Pick the highest-pain workflow — KYC onboarding, transaction support or AML triage — and we map it to your systems.",
    },
    {
      n: "02",
      title: "Pilot in your environment",
      desc: "Agents run on your core banking stack with a compliance officer in the loop and a full audit trail, in weeks not quarters.",
    },
    {
      n: "03",
      title: "Measure, then expand",
      desc: "Review the outcomes on your own data, then roll the agent team out workflow by workflow.",
    },
  ],

  // ---------------- FAQ (drives FAQPage JSON-LD) ----------------
  faq: [
    {
      q: "Does Rach.Dev replace our core banking system?",
      a: "No. Rach.Dev is an operations layer that runs on top of your existing core banking platform (FIS, Fiserv, Jack Henry and others) and tools like Plaid and Salesforce Financial Services Cloud via secure APIs. Your systems of record stay exactly where they are.",
    },
    {
      q: "How does Rach.Dev handle compliance?",
      a: "Rach.Dev is built compliance-first: least-privilege PII access, encryption in transit and at rest, role-based permissions, a full audit trail, mandatory disclosures, and SEC/FINRA and BSA/AML guardrails. Every regulated action waits for a compliance officer to approve, and controls are validated per deployment.",
    },
    {
      q: "Do the AI agents make regulated decisions on their own?",
      a: "No. Every regulated action — account opening, account restrictions, SAR/CTR filing, provisional credit — pauses for a compliance officer or analyst to approve. The agents draft, stage and route; a human decides. The fraud and AML monitor is advisory only.",
    },
    {
      q: "Will the agents give customers investment advice?",
      a: "No. The agents never provide personalized investment, tax or legal advice or recommend securities. Any suitability or investment question is routed to a licensed advisor, with mandatory disclosures applied — informational answers only, always cited.",
    },
    {
      q: "How do the agents detect fraud and money laundering?",
      a: "The always-on Fraud/AML Sentinel baselines normal account behavior and watches the live transaction stream for structuring, sanctions exposure, account takeover, card fraud and layering. It triages alerts with context and stages SAR-ready packets, but a BSA officer or fraud analyst makes every filing and account decision.",
    },
  ],
};
