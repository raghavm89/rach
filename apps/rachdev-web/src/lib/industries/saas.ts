import type { IndustryConfig } from "./types";

/**
 * SaaS (US B2B software) industry config.
 *
 * Content is authored for a US SaaS / cloud-software buyer — SOC 2, GDPR,
 * SLA contracts, English + Spanish — and renders entirely in the Rach.Dev
 * design system. Interactions (Control Tower + relay + knowledge) are fully
 * scripted; no live model is called.
 *
 * The seven agent keys mirror the medical config for predictability, but each
 * is re-cast for SaaS:
 *   intake    = Onboarding & tier-1 support (front door / relay trigger)
 *   triage    = Issue triage & severity scoring
 *   scribe    = Bug report & ticket drafting
 *   coord     = Onboarding & success orchestration
 *   revenue   = Billing, subscriptions & dunning
 *   knowledge = Docs / help-center assistant
 *   monitor   = Churn / SLA Sentinel (always-on proactive monitor)
 * The risk/escalation owner is the "triage" Security & SLA screen, which trips
 * the hard guardrail and routes incidents/breaches to a human on-call.
 */
export const saasConfig: IndustryConfig = {
  slug: "saas",
  vertical: "SaaS",
  industrySlug: "saas",
  industryName: "SaaS",
  icon: "boxes",
  tagline:
    "An agent team for onboarding, tier-1 support, structured bug reports, billing and churn/SLA monitoring — on Zendesk, Stripe and your stack, with an engineer in the loop on anything risky.",
  seoTitle: "SaaS AI Agents for Support, Onboarding & Churn",
  seoDescription:
    "Rach.Dev is an AI operations layer for SaaS companies — agents for onboarding, tier-1 support, structured bug-report escalation, billing and subscriptions, docs answers, and always-on churn/SLA monitoring, on top of Zendesk, Intercom, Stripe and Salesforce, with a human in the loop on every breach, incident or refund.",
  seoKeywords: [
    "SaaS AI agents",
    "AI customer support automation",
    "tier-1 support automation",
    "SaaS onboarding automation",
    "churn prevention AI",
    "SLA monitoring AI",
    "SOC 2 AI agents",
    "Zendesk AI automation",
  ],

  // ---------------- HERO ----------------
  eyebrow: "SaaS · Agentic Operations Layer",
  h1Lines: ["The AI operations layer", "for your SaaS company."],
  rotorLead: "Put a team of agents on your",
  rotorWords: ["onboarding.", "tier-1 support.", "bug triage.", "billing & dunning.", "churn watch."],
  subhead:
    "Rach.Dev runs onboarding, tier-1 support, structured bug-report escalation, billing and churn/SLA monitoring across the tools you already use — Zendesk, Intercom, Stripe, Segment, Salesforce — with an engineer in the loop on every incident, breach or refund, and a full audit trail on every action.",
  trustRow: [
    "SOC 2-aligned by design",
    "Works with your existing stack",
    "Human-in-the-loop on risk",
    "English & Spanish",
  ],
  heroPrimaryCta: { label: "Book a pilot", href: "/contact" },
  heroSecondaryCta: { label: "See the architecture", href: "#architecture" },

  // ---------------- OPERATING PICTURE ----------------
  operateEyebrow: "The operating picture",
  operateTitle: "What an agent team takes off your roadmap",
  operateIntro:
    "Most of a SaaS team's load isn't shipping product — it's answering the same tier-1 tickets, chasing onboarding, and finding churn too late. Here's where agents own the busywork, mapped to how your company actually runs.",
  domains: [
    {
      icon: "door",
      title: "The Front Door",
      blurb: "Every inquiry captured, identified and routed — 24/7, in-app, email or chat, English or Spanish.",
      bullets: [
        "Multi-channel intake (in-app chat, email, SMS, WhatsApp, portal)",
        "Account match & plan / entitlement lookup",
        "Deflects the common 'how do I…' before it becomes a ticket",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "triage",
      title: "Triage & Severity",
      blurb: "Severity scoring with explicit security/SLA red-flags and instant escalation to on-call.",
      bullets: [
        "Routes by severity (P1–P4) and affected plan tier",
        "Security/breach signals page the on-call engineer",
        "Matches to the right team by product area",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "scribe",
      title: "Bug Reports & Tickets",
      blurb: "Reproducible bug reports drafted for engineering — the engineer decides what to do.",
      bullets: [
        "Captures environment, version, repro steps and logs",
        "Drafts the ticket and links related reports",
        "Attaches the trace ID and status-page context",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "diagnostics",
      title: "Diagnostics & Status",
      blurb: "The full loop — reproduce, check status, and escalate the moment it's an incident.",
      bullets: [
        "Walks the customer through diagnostic steps",
        "Checks the live status page and known issues",
        "Incident signals routed to PagerDuty on-call",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "calendar",
      title: "Onboarding & Success",
      blurb: "Activation steps, training and the check-ins customers never quite get to.",
      bullets: [
        "Guided setup, integrations and first-value milestones",
        "Schedules onboarding calls and training",
        "Reminders & adoption nudges (EN / ES)",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "revenue",
      title: "Billing & Subscriptions",
      blurb: "The fastest ROI for a CFO: recover failed payments, answer invoice questions cleanly.",
      bullets: [
        "Invoice, proration and plan-change questions",
        "Failed-payment dunning & card-update nudges",
        "Refunds & credits drafted — a human approves",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "users",
      title: "Feedback & Roadmap",
      blurb: "Feature requests captured, deduped and themed for product — no more scattered asks.",
      bullets: [
        "Collects requests across chat, email and calls",
        "Dedupes and tags by theme and account value",
        "Surfaces trends for the roadmap review",
      ],
      tag: { label: "In your build", tone: "muted" },
    },
    {
      icon: "knowledge",
      title: "Knowledge Layer",
      blurb: "A role-aware assistant grounded only in your approved docs and help center.",
      bullets: [
        "Separate views for customer, support, engineering",
        "Every answer cites its source doc",
        "Hard guardrails — never security/legal counsel",
      ],
      tag: { label: "In demo", tone: "live" },
    },
  ],

  // ---------------- CONTROL TOWER ----------------
  towerTitle: "Watch the team run a ticket",
  towerIntro:
    "Pick a case and press play. Watch the agent team run it end to end — a human approves every risky action.",
  subjectNoun: "account",
  stages: [
    { key: "door", label: "Front Door", icon: "door" },
    { key: "triage", label: "Triage", icon: "triage" },
    { key: "diagnostics", label: "Diagnostics", icon: "diagnostics" },
    { key: "report", label: "Bug Report", icon: "scribe" },
    { key: "decision", label: "Decision", icon: "decision" },
    { key: "coord", label: "Resolution", icon: "coord" },
    { key: "follow", label: "Follow-up", icon: "follow" },
  ],
  scenarios: [
    {
      key: "incident",
      tabLabel: "Security incident",
      tabIcon: "shieldAlert",
      subjectName: "Northwind Logistics · Enterprise plan",
      subjectDesc: "Possible data exposure reported by a customer",
      channel: "In-app chat · Business hours",
      channelIcon: "message",
      steps: [
        {
          agent: "intake",
          stage: "door",
          title: "Account identified & report opened",
          detail:
            "Matched to the Enterprise workspace, entitlement and SLA tier confirmed, support conversation opened in seconds.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "triage",
          title: "Red-flag: possible data exposure",
          detail:
            "Report of another tenant's data visible → P1 security signal. On-call engineer and security lead paged immediately; no auto-remediation attempted.",
          status: "esc",
          ms: 1300,
        },
        {
          agent: "scribe",
          stage: "report",
          title: "Incident report pre-built",
          detail:
            "Affected account, version, screenshots, trace IDs and recent deploys assembled for the responder on arrival.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "coord",
          stage: "diagnostics",
          title: "Containment workflow staged",
          detail:
            "Suspected scope drafted, status-page note prepared, and the security runbook queued — nothing published until a human approves.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "decision",
          title: "Breach response approved by security lead",
          detail:
            "Security lead confirms scope, customer notification and status-page update — Rach.Dev never declares or discloses a breach on its own.",
          status: "gate",
          gateBy: "Dana Whitfield · Security Lead",
          ms: 1300,
        },
        {
          agent: "monitor",
          stage: "coord",
          title: "SLA & blast-radius watch armed",
          detail:
            "Continuous watch on affected tenants and SLA clocks enabled; further anomalies wired straight to the incident channel.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "intake",
          stage: "follow",
          title: "Customer updated & post-mortem queued",
          detail:
            "Customer kept informed on the approved cadence; a post-incident review and remediation tasks scheduled with the owners.",
          status: "ok",
          ms: 1100,
        },
      ],
    },
    {
      key: "onboarding",
      tabLabel: "New-account onboarding",
      tabIcon: "userPlus",
      subjectName: "BrightPath Health · Pro plan",
      subjectDesc: "New team setting up their workspace",
      channel: "Email · Business hours",
      channelIcon: "mail",
      steps: [
        {
          agent: "intake",
          stage: "door",
          title: "New account verified & welcomed",
          detail:
            "Admin identified, plan and seats confirmed, onboarding conversation opened with their environment context.",
          status: "ok",
          ms: 1000,
        },
        {
          agent: "triage",
          stage: "triage",
          title: "Routine onboarding confirmed",
          detail: "No security or SLA flags; standard Pro-plan setup path, no on-call escalation needed.",
          status: "ok",
          ms: 1000,
        },
        {
          agent: "coord",
          stage: "diagnostics",
          title: "Setup checklist staged",
          detail: "SSO, first integration and seat invites mapped to their stack so the team hits first value fast.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "knowledge",
          stage: "report",
          title: "Setup questions answered with sources",
          detail: "Configuration questions answered from approved docs, each with a citation — no guessing.",
          status: "ok",
          ms: 1000,
        },
        {
          agent: "revenue",
          stage: "decision",
          title: "Seat add-on quote — owner approves",
          detail:
            "Admin asks to add 10 seats mid-term; a prorated quote is drafted from Stripe, and the account owner approves before any charge.",
          status: "gate",
          gateBy: "Marcus Bell · Account Owner",
          ms: 1200,
        },
        {
          agent: "coord",
          stage: "coord",
          title: "Onboarding call + training set",
          detail: "Kickoff call booked with their CSM and a training session scheduled after seats are provisioned.",
          status: "ok",
          ms: 1000,
        },
        {
          agent: "monitor",
          stage: "follow",
          title: "Activation watch armed",
          detail: "Adoption milestones tracked; a nudge fires if first-value steps stall in the first 14 days.",
          status: "ok",
          ms: 1000,
        },
      ],
    },
    {
      key: "afterhours",
      tabLabel: "After-hours chat",
      tabIcon: "message",
      subjectName: "María Gómez · Acme Studios",
      subjectDesc: "After-hours WhatsApp message, in Spanish",
      channel: "WhatsApp · After hours",
      channelIcon: "message",
      steps: [
        {
          agent: "intake",
          stage: "door",
          title: "Spanish message understood & answered",
          detail:
            "Inbound WhatsApp in Spanish recognized at 11:50 PM; account identified and replied to in her own language.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "triage",
          title: "Severity scored safely",
          detail:
            "Login failure on a single account, no security signal → P3, handled now with a clear path if it escalates.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "knowledge",
          stage: "diagnostics",
          title: "Grounded fix, no security advice",
          detail:
            "Walked her through a password reset and SSO check from approved docs, with sources — and did not give security or compliance counsel.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "scribe",
          stage: "report",
          title: "Follow-up bug report drafted",
          detail:
            "Captured the SSO error, browser and trace ID into a draft ticket for the team in case the reset doesn't hold.",
          status: "ok",
          ms: 1000,
        },
        {
          agent: "revenue",
          stage: "decision",
          title: "Goodwill credit — manager approves",
          detail:
            "A small service credit for the disruption is drafted; the support manager approves before it is applied to her account.",
          status: "gate",
          gateBy: "Priya Anders · Support Manager",
          ms: 1200,
        },
        {
          agent: "intake",
          stage: "follow",
          title: "Confirmed in Spanish + morning check-in",
          detail:
            "Sent the resolution and the credit confirmation in Spanish, with a follow-up scheduled for the morning.",
          status: "ok",
          ms: 1000,
        },
      ],
    },
  ],
  gateNote: "Every risky action waits for a human. Rach.Dev drafts, stages and routes — a person approves refunds, breaches and incidents.",
  completeToast: "Journey complete — every risky action was human-approved",

  // ---------------- ROSTER (relay) ----------------
  rosterTitle: "Seven specialists, one conductor",
  rosterIntro:
    "Each agent owns one job and hands the next a complete, structured context. Atlas routes the work, enforces the human-in-the-loop gates, and writes every action to an audit log.",
  rosterClickNote: "Click Ava below — the full onboarding-to-billing workflow plays out automatically.",
  orchestratorName: "Atlas",
  orchestratorBlurb:
    "Atlas is the orchestrator. It routes each ticket to the right specialist, carries shared account context between them, pauses for human approval on every risky action — refunds, incidents, breach disclosure — and records a complete, timestamped audit trail.",
  relayTriggerAgentKey: "intake",
  relayCompleteToast: "Workflow complete — all agents processed BrightPath Health's onboarding",
  agents: [
    {
      key: "intake",
      name: "Ava",
      role: "Onboarding & Tier-1 Support",
      icon: "intake",
      blurb:
        "The front door. Captures every inquiry across in-app chat, email, SMS and WhatsApp, identifies the account and plan, and deflects the common tier-1 questions — 24/7, in English or Spanish.",
      tags: ["Multi-channel intake", "Account & entitlement lookup", "EN / ES"],
      pipeSub: "Intake",
      workMs: 2000,
      voice: {
        listeningTitle: "Listening…",
        listeningSub: "Capturing the support request by voice",
        doneTitle: "Intake complete",
        doneSub: "6 fields captured · handing off to the team…",
        handoffToast: "Ava done — watch the team pick it up",
        fields: [
          { label: "Account", value: "BrightPath Health · Pro plan" },
          { label: "Request", value: "New workspace setup — SSO + first integration" },
          { label: "Context", value: "5 seats, US region; admin invited team yesterday" },
          { label: "Identity", value: "Matched to workspace (admin verified)", ok: true },
          { label: "Entitlement", value: "Pro plan active — SLA tier confirmed", ok: true },
          { label: "Channel", value: "Email · English" },
        ],
      },
    },
    {
      key: "triage",
      name: "Marcus",
      role: "Security & SLA Triage",
      icon: "shieldAlert",
      blurb:
        "Triage & severity. Scores every ticket (P1–P4), watches for security and SLA red-flags, and escalates straight to the on-call engineer — never sitting on a possible breach or incident.",
      tags: ["Severity scoring", "Security/SLA red-flags", "Escalation"],
      pipeSub: "Triage",
      workMs: 2100,
      flow: [
        {
          fromLabel: "Context from Ava",
          chips: ["BrightPath Health · Pro", "New workspace setup", "No security signal"],
        },
        {
          steps: [
            { text: "Severity scored — P3 onboarding, no SLA risk", kind: "ok" },
            { text: "Security scan clear (no exposure, no auth anomaly)", kind: "ok" },
            { text: "Escalation path armed — any breach signal pages on-call", kind: "ok" },
          ],
          note: "On a security or breach signal, Marcus pages a human immediately and never attempts auto-remediation.",
        },
      ],
    },
    {
      key: "scribe",
      name: "Nora",
      role: "Bug Report Drafting",
      icon: "scribe",
      blurb:
        "The ticket scribe. Turns a vague complaint into a reproducible bug report — environment, version, repro steps, logs and trace IDs — so engineers fix instead of interrogate.",
      tags: ["Repro steps", "Env & logs capture", "Structured tickets"],
      pipeSub: "Scribe",
      workMs: 2000,
      flow: [
        {
          fromLabel: "Context from Marcus",
          chips: ["P3 onboarding", "SSO config question", "Chrome · US region"],
        },
        {
          steps: [
            { text: "Captured environment, version and exact repro steps", kind: "ok" },
            { text: "Attached logs, trace ID and related prior reports", kind: "ok" },
            { text: "Drafted a clean ticket — flagged for engineering review", kind: "ok" },
          ],
          note: "Draft only. The ticket is filed and prioritized solely after a human reviews it.",
        },
      ],
    },
    {
      key: "coord",
      name: "Owen",
      role: "Onboarding & Success",
      icon: "coord",
      blurb:
        "Success coordination. Stages setup checklists, books onboarding and training calls, routes integrations, and keeps accounts on track with adoption nudges and reminders.",
      tags: ["Setup checklists", "Onboarding & training", "Reminders"],
      pipeSub: "Coord",
      workMs: 1900,
      flow: [
        {
          fromLabel: "Context from Nora",
          chips: ["SSO + first integration", "Kickoff call", "Adoption: pending"],
        },
        {
          steps: [
            { text: "Setup checklist staged so the team hits first value fast", kind: "ok" },
            { text: "Kickoff call booked with the CSM after seats provision", kind: "ok" },
            { text: "Training session + adoption nudges scheduled (EN / ES)", kind: "ok" },
          ],
        },
      ],
    },
    {
      key: "revenue",
      name: "Riley",
      role: "Billing & Subscriptions",
      icon: "revenue",
      blurb:
        "Billing & subscriptions. Answers invoice, proration and plan-change questions, runs failed-payment dunning, and drafts refunds and credits — but a human approves every cent that moves.",
      tags: ["Invoices & proration", "Dunning", "Refunds — human-approved"],
      pipeSub: "Billing",
      workMs: 2000,
      flow: [
        {
          fromLabel: "Context from Owen",
          chips: ["+10 seats mid-term", "Prorated quote", "Stripe subscription"],
        },
        {
          steps: [
            { text: "Prorated seat quote drafted from the Stripe subscription", kind: "ok" },
            { text: "Plan rules and tax checked for this account's region", kind: "ok" },
            { text: "Charge staged — flagged for account-owner approval", kind: "esc" },
          ],
          note: "Riley never charges, refunds or credits on its own. Money moves only after a human signs off.",
        },
      ],
    },
    {
      key: "knowledge",
      name: "Iris",
      role: "Docs & Help Assistant",
      icon: "knowledge",
      blurb:
        "The role-aware knowledge assistant. Answers customers, support and engineering from your approved docs and help center only — every answer cited, and never security, legal or compliance counsel.",
      tags: ["Role-aware", "Cited answers", "Never security/legal advice"],
      pipeSub: "Knowledge",
      workMs: 1900,
      flow: [
        {
          fromLabel: "Context from Riley",
          chips: ["Customer view", "Approved docs only", "EN / ES"],
        },
        {
          steps: [
            { text: "Answered the setup questions from approved docs", kind: "ok" },
            { text: "Every answer carried its source citation", kind: "ok" },
            { text: "Security/compliance question → handed to a human, not answered", kind: "esc" },
          ],
          note: "Iris informs. It never gives security, legal or compliance advice, and never overrides a human owner.",
        },
      ],
    },
    {
      key: "monitor",
      name: "Hope",
      role: "Churn / SLA Sentinel",
      icon: "monitor",
      blurb:
        "The Churn / SLA Sentinel. Always on, reading usage, support sentiment, SLA clocks and renewal dates for every account — flagging a quiet account before it cancels, and staging the save for customer success.",
      tags: ["Always-on monitor", "Early-warning", "Advisory only"],
      pipeSub: "Sentinel",
      workMs: 2400,
      live: { label: "Live · Accounts" },
      flow: [
        {
          fromLabel: "Context from customer success",
          chips: ["Usage: declining", "Sentiment: negative", "Renewal: 38 days"],
        },
        {
          fromLabel: "How Hope calibrates for this account",
          steps: [
            { text: "Baselines usage, seats and feature adoption for this account", kind: "ok" },
            { text: "Weights signals by plan tier, ARR and renewal proximity", kind: "ok" },
            { text: "Suppresses noisy alerts to cut false-alarm fatigue", kind: "ok" },
          ],
        },
        {
          fromLabel: "What Hope reads in real time",
          chips: ["Logins / DAU", "Feature usage", "Ticket sentiment", "SLA clocks", "Invoices", "Renewal date"],
          steps: [
            { text: "Usage cliff — active seats dropping with no new logins", kind: "esc" },
            { text: "Sentiment — support tone turning negative across tickets", kind: "esc" },
            { text: "SLA risk — first-response or resolution clock nearing breach", kind: "esc" },
            { text: "Champion loss — the power user stops logging in", kind: "esc" },
            { text: "Billing — repeated failed payment before renewal", kind: "esc" },
            { text: "Renewal — high-ARR account approaching term with low adoption", kind: "esc" },
          ],
          note: "Hope is advisory. It alerts and stages a save play — a human in customer success decides and acts. Every alert is logged with the signal that triggered it.",
        },
      ],
    },
  ],

  // ---------------- ARCHITECTURE ----------------
  archTitle: "One layer over the stack you already run",
  archIntro:
    "Rach.Dev sits on top of your support desk, billing and data tools — orchestrating agents, enforcing governance, and keeping a human in the loop on anything risky. No rip-and-replace.",
  archLayers: [
    {
      n: "Layer 4",
      title: "Human-in-the-loop",
      icon: "decision",
      body: "Every risky action — refunds, credits, incident disclosure, breach response — pauses for a human to approve. Agents draft and stage; people decide.",
      pills: ["Approval gates", "On-call sign-off", "Role-based access"],
    },
    {
      n: "Layer 3",
      title: "Governance & audit",
      icon: "shield",
      body: "SOC 2-aligned controls, least-privilege access, GDPR data handling, and a complete, timestamped audit trail on every action and every data touch.",
      pills: ["SOC 2-aligned", "Full audit log", "GDPR data handling", "Source citations"],
    },
    {
      n: "Layer 2",
      title: "Agent orchestration",
      icon: "orchestrator",
      body: "Atlas routes each ticket to the right specialist, carries shared account context between agents, and coordinates hand-offs end to end.",
      pills: ["Routing & hand-off", "Shared context", "Escalation paths"],
    },
    {
      n: "Layer 1",
      title: "Integration",
      icon: "plug",
      body: "Bidirectional connectors to your support desk, billing, CRM, product analytics, status page and on-call over the APIs your stack already exposes.",
      pills: ["REST & webhooks", "OAuth scopes", "Event streams"],
    },
  ],
  archBaseLabel: "Works with the systems you already run",
  archBaseSystems: [
    "Zendesk",
    "Intercom",
    "Segment",
    "Stripe",
    "Salesforce",
    "Statuspage",
    "PagerDuty",
    "Slack",
    "Jira",
    "HubSpot",
  ],

  // ---------------- KNOWLEDGE ----------------
  knowledgeTitle: "A knowledge layer that knows its limits",
  knowledgeIntro:
    "Iris answers customers, support and engineering from your approved docs and help center only. Every answer is cited — and a security, legal or compliance question is always handed to a human, never improvised.",
  knowledgeAgentName: "Iris",
  knowledgeViewLabel: "Customer view",
  knowledgeGreeting:
    "Hi, I'm Iris. Ask me about setup, your plan, billing or how a feature works — I'll always cite my source.",
  knowledgeDisclaimer:
    "Iris provides product information only — never security, legal or compliance advice. Anything sensitive is routed to a human owner.",
  knowledge: [
    {
      q: "How do I set up SSO for my workspace?",
      a: "On the Pro plan you can enable SAML SSO under Settings → Security → Single Sign-On. Add your identity provider's metadata URL, map the email attribute, and run the test login before enforcing it for the team. Full step-by-step with screenshots is in the linked guide — reply here if any step doesn't match your IdP.",
      src: ["Help Center · SSO setup", "Security settings docs"],
    },
    {
      q: "¿Por qué me cobraron de más este mes?",
      a: "Su factura subió porque agregó 10 asientos a mitad del ciclo, así que se aplicó un cargo prorrateado por los días restantes. En la próxima factura el monto vuelve al precio mensual completo del nuevo total de asientos. Si quiere un desglose línea por línea o un ajuste, puedo conectarla con nuestro equipo de facturación.",
      src: ["Stripe subscription", "Billing policy · proration"],
    },
    {
      q: "We think another tenant could see our data — is this a breach we have to report?",
      a: "That's a security and legal question, so I won't advise on it myself. I've opened a P1 security report, paged our on-call engineer and security lead, and preserved the relevant trace IDs. A human from our security team will contact you directly about scope and any required notification. If you have a regulatory deadline, tell us and we'll prioritize it.",
      src: ["Security runbook", "On-call routing", "Incident policy"],
    },
  ],

  // ---------------- GOVERNANCE ----------------
  governanceTitle: "Governance, not just guardrails",
  governanceIntro:
    "The controls that let a SaaS company actually deploy agents — enforced in the system, not promised on a slide.",
  guarantees: [
    {
      title: "Human in the loop on risk",
      desc: "Every refund, credit, incident disclosure and breach response waits for a human to approve. No agent moves money or declares an incident on its own.",
    },
    {
      title: "Complete audit trail",
      desc: "Every action, hand-off and data access is logged with a timestamp, the agent, the source and the approver — exportable on demand for your SOC 2 evidence.",
    },
    {
      title: "SOC 2-aligned & GDPR-ready",
      desc: "Least-privilege access, encryption in transit and at rest, role-based permissions, configurable retention and right-to-deletion — privacy built in, not bolted on.",
    },
    {
      title: "Grounded with sources",
      desc: "Answers come only from your approved docs and help center and cite them. No open-web guessing, no ungrounded claims to a customer.",
    },
    {
      title: "No vendor lock-in",
      desc: "Standards-based connectors (REST, webhooks, OAuth) and your data stays yours. Turn an agent off and your stack keeps running exactly as before.",
    },
  ],
  auditTitle: "Live audit log",
  auditIntro: "A sample of what every action looks like on the record.",
  auditLines: [
    { ts: "23:50:14", text: "Inbound WhatsApp (es) received & answered — account #2207", tag: "ok", tagLabel: "Logged" },
    { ts: "09:04:32", text: "Entitlement verified — Pro plan, SLA tier confirmed", tag: "ok", tagLabel: "Verified" },
    { ts: "09:05:11", text: "Customer data accessed: workspace config (least privilege)", tag: "mod", tagLabel: "Data" },
    { ts: "09:07:48", text: "Prorated seat charge drafted — +10 seats, awaiting sign-off", tag: "mod", tagLabel: "Pending" },
    { ts: "09:08:22", text: "Charge approved by Marcus Bell, Account Owner", tag: "ok", tagLabel: "Approved" },
    { ts: "14:21:09", text: "P1 security signal (possible data exposure) — on-call paged", tag: "esc", tagLabel: "Escalated" },
  ],

  // ---------------- OUTCOMES ----------------
  outcomesTitle: "What changes when agents own the busywork",
  outcomesIntro: "Directional outcomes our pilots target — validated on your own data, never assumed.",
  outcomes: [
    {
      value: "24/7",
      label: "Coverage, every channel",
      desc: "In-app chat, email, SMS and WhatsApp answered around the clock, in English and Spanish — no after-hours backlog.",
    },
    {
      value: "Minutes",
      label: "From ticket to repro",
      desc: "Environment, repro steps and logs assembled before an engineer ever opens the ticket.",
    },
    {
      value: "Earlier",
      label: "Churn caught in time",
      desc: "Usage, sentiment and renewal signals flagged weeks before renewal — not at the cancel screen.",
    },
    {
      value: "Hours back",
      label: "For your engineers",
      desc: "Less tier-1 firefighting and information-gathering, more time on the roadmap.",
    },
  ],
  benchmarks: [
    {
      text: "Across customer service issues, only about 14% are fully resolved in self-service today — leaving a large tier-1 volume that grounded, escalation-aware agents can deflect or speed up.",
      cite: "Gartner, press release, 2024",
    },
    {
      text: "Increasing customer retention rates by roughly 5% has been associated with profit increases of about 25% to 95%, which is why catching churn early matters so much in SaaS.",
      cite: "Reichheld / Bain & Company, Harvard Business Review, 2014",
    },
    {
      text: "Acquiring a new customer can cost roughly 5 to 25 times more than retaining an existing one, so preventing a cancel is usually far cheaper than replacing the revenue.",
      cite: "Harvard Business Review (Gallo), 2014",
    },
  ],
  outcomesNote:
    "Figures above are external benchmarks and pilot targets, not guarantees — we validate every number on your own data before you rely on it. Monitoring agents are advisory: they alert and stage, a human acts.",

  // ---------------- CTA ----------------
  ctaTitle: "Start with one workflow. Prove it. Then scale.",
  ctaIntro:
    "We stand up a single workflow on your existing stack, show the audit trail and the outcomes, and expand only once your team trusts it.",
  ctaSteps: [
    {
      n: "01",
      title: "Scope one workflow",
      desc: "Pick the highest-pain workflow — tier-1 support, onboarding or churn monitoring — and we map it to your stack.",
    },
    {
      n: "02",
      title: "Pilot in your environment",
      desc: "Agents run on Zendesk, Stripe and your tools with a human in the loop and a full audit trail, in weeks not quarters.",
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
      q: "Does Rach.Dev replace our support desk or billing system?",
      a: "No. Rach.Dev is an operations layer that runs on top of your existing tools — Zendesk or Intercom for support, Stripe for billing, Salesforce or HubSpot for CRM — over their APIs and webhooks. Your systems of record stay exactly where they are.",
    },
    {
      q: "Is Rach.Dev SOC 2 and GDPR ready?",
      a: "Rach.Dev is built to align with SOC 2 and support GDPR: least-privilege access, encryption in transit and at rest, role-based permissions, a full audit trail for evidence, and configurable retention plus right-to-deletion. Compliance is validated per deployment.",
    },
    {
      q: "Do the AI agents issue refunds or handle incidents on their own?",
      a: "No. Every risky action — refunds, credits, incident disclosure, breach response — pauses for a human to approve. The agents draft, stage and route; a person decides. Monitoring agents are advisory only.",
    },
    {
      q: "How do the agents help engineering instead of adding noise?",
      a: "Tier-1 agents resolve or deflect common questions, and when something needs engineering they hand over a structured bug report — environment, version, repro steps, logs and trace IDs — so your engineers fix instead of interrogating the customer.",
    },
    {
      q: "How does churn monitoring actually work?",
      a: "The Churn / SLA Sentinel reads usage, support sentiment, SLA clocks and renewal dates across your accounts, then flags a quiet or at-risk account early and stages a save play for customer success. It is advisory — a human decides whether and how to reach out.",
    },
  ],
};
