import type { IndustryConfig } from "./types";

/**
 * Professional Services (US firms) industry config.
 *
 * Authored for a US consultancy / agency / accounting / architecture-firm buyer —
 * billable utilization, scope creep, client confidentiality, professional-licensing
 * scope, and the cash-flow drag of late invoices. Agents run on top of the firm's
 * existing PSA stack (HubSpot, Monday.com, Harvest, QuickBooks, Slack) with an
 * engagement owner in the loop on every client-facing commitment. Interactions
 * (Control Tower + relay + knowledge) are fully scripted; no live model is called.
 */
export const professionalServicesConfig: IndustryConfig = {
  slug: "professional-services",
  vertical: "Professional Services",
  industrySlug: "professional-services",
  industryName: "Professional Services",
  icon: "briefcase",
  tagline:
    "An agent team for proposal intake, scoping, deliverable drafting, project coordination and billing — on your PSA stack, with an engagement lead in the loop and a Project-Health Sentinel watching scope, deadlines and cash.",
  seoTitle: "AI Agents for Professional Services Firms",
  seoDescription:
    "Rach.Dev is an AI operations layer for consultancies, agencies, accounting and architecture firms — agents for proposal and lead intake, scope/risk screening, deliverable drafting, project coordination and billing, on top of HubSpot, Monday.com, Harvest and QuickBooks, with an engagement lead in the loop and an always-on Project-Health Sentinel for scope creep, deadline risk and overdue invoices.",
  seoKeywords: [
    "professional services AI agents",
    "consulting firm automation",
    "proposal automation",
    "billable utilization software",
    "scope creep monitoring",
    "PSA automation",
    "agency operations AI",
    "accounting firm AI agents",
  ],

  // ---------------- HERO ----------------
  eyebrow: "Professional Services · Agentic Operations Layer",
  h1Lines: ["The AI operations layer", "for your firm."],
  rotorLead: "Put a team of agents on your",
  rotorWords: ["proposals.", "scoping.", "deliverables.", "project comms.", "billing.", "utilization."],
  subhead:
    "Rach.Dev runs proposal and lead intake, scope and conflict screening, deliverable drafting, project coordination and billing across the tools you already use — with an engagement lead in the loop on every client commitment, and a full audit trail on every action.",
  trustRow: [
    "Client confidentiality by design",
    "Works with your existing PSA stack",
    "Engagement-lead-in-the-loop",
    "English & Spanish",
  ],
  heroPrimaryCta: { label: "Book a pilot", href: "/contact" },
  heroSecondaryCta: { label: "See the architecture", href: "#architecture" },

  // ---------------- OPERATING PICTURE ----------------
  operateEyebrow: "The operating picture",
  operateTitle: "What an agent team takes off your bench",
  operateIntro:
    "Most of a firm's load isn't expertise — it's the proposals, status emails, timesheet chasing and invoice follow-ups that eat billable hours. Here's where agents own the non-billable busywork, mapped to how your firm actually runs.",
  domains: [
    {
      icon: "door",
      title: "The Front Door",
      blurb: "Every inbound lead and RFP captured, qualified and routed — 24/7, in English or Spanish.",
      bullets: [
        "Multi-channel intake (web form, email, phone, referral)",
        "Lead qualified against your ICP and service lines",
        "Logged to HubSpot with the right owner assigned",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "shieldAlert",
      title: "Scope & Conflict Screen",
      blurb: "Every engagement screened for conflicts, confidentiality and licensing scope before it starts.",
      bullets: [
        "Conflict-of-interest check across active clients",
        "Confidentiality / data-isolation requirements flagged",
        "Licensed-opinion requests routed to a credentialed pro",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "scribe",
      title: "Proposals & Deliverables",
      blurb: "First drafts from your past work, services catalog and pricing — the partner decides.",
      bullets: [
        "Proposal draft from prior wins + rate cards",
        "SOW + scope-of-work boundaries spelled out",
        "Deliverable drafts grounded in your templates",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "listChecks",
      title: "Delivery & Scope Control",
      blurb: "The plan, the tasks and the change orders — so out-of-scope work never goes unpriced.",
      bullets: [
        "Project plan + tasks pushed to Monday.com",
        "Out-of-scope requests flagged as change orders",
        "Time tracked against budget in Harvest",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "coord",
      title: "Client Communication",
      blurb: "Proactive status, scheduling and the follow-ups clients say they never get.",
      bullets: [
        "Status updates drafted from real project data",
        "Meetings, reviews and kickoffs scheduled",
        "Reminders & nudges (EN / ES)",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "revenue",
      title: "Billing & Cash",
      blurb: "The fastest ROI for a managing partner: bill on time, collect faster.",
      bullets: [
        "Invoices generated from tracked time + milestones",
        "Line-item questions answered for the client",
        "Payment reminders before AR goes stale",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "users",
      title: "Back-Office & Workforce",
      blurb: "Timesheets, staffing and the firm paperwork no one wants to do.",
      bullets: [
        "Timesheet completion nudges & utilization rollups",
        "Resourcing & bench visibility across projects",
        "Engagement-letter & retention-policy filing",
      ],
      tag: { label: "In your build", tone: "muted" },
    },
    {
      icon: "knowledge",
      title: "Knowledge Layer",
      blurb: "A role-aware assistant grounded only in your approved sources.",
      bullets: [
        "Separate views for client, consultant, partner",
        "Every answer cites its source",
        "Hard guardrails — never licensed professional advice",
      ],
      tag: { label: "In demo", tone: "live" },
    },
  ],

  // ---------------- CONTROL TOWER ----------------
  towerTitle: "Watch the team run an engagement",
  towerIntro:
    "Pick an engagement and press play. Watch the agent team run it end to end — an engagement lead approves every client commitment.",
  subjectNoun: "engagement",
  stages: [
    { key: "door", label: "Lead Intake", icon: "door" },
    { key: "screen", label: "Scope Screen", icon: "shieldAlert" },
    { key: "proposal", label: "Proposal", icon: "scribe" },
    { key: "delivery", label: "Delivery", icon: "listChecks" },
    { key: "decision", label: "Decision", icon: "decision" },
    { key: "comms", label: "Coordination", icon: "coord" },
    { key: "billing", label: "Billing", icon: "follow" },
  ],
  scenarios: [
    {
      key: "rfp",
      tabLabel: "New RFP",
      tabIcon: "briefcase",
      subjectName: "Northwind Logistics · Brand refresh",
      subjectDesc: "Inbound RFP — agency engagement, ~$120K",
      channel: "Web form · RFP",
      channelIcon: "door",
      steps: [
        {
          agent: "intake",
          stage: "door",
          title: "RFP captured & qualified",
          detail:
            "Inbound RFP parsed, matched to the brand & creative service line, and logged to HubSpot with the right partner assigned.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "screen",
          title: "Conflict & scope screen clear",
          detail:
            "No conflict with active clients; confidentiality requirements noted, project sits inside the firm's services scope.",
          status: "ok",
          ms: 1200,
        },
        {
          agent: "scribe",
          stage: "proposal",
          title: "Proposal draft assembled",
          detail:
            "First-draft proposal pulled from past brand wins, the services catalog and the rate card — staged for partner review.",
          status: "ok",
          ms: 1300,
        },
        {
          agent: "revenue",
          stage: "delivery",
          title: "Pricing & SOW boundaries set",
          detail:
            "Fixed-fee estimate built from the rate card; scope-of-work boundaries and exclusions drafted to prevent later creep.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "decision",
          title: "Proposal approved by the partner",
          detail:
            "The engagement partner reviews scope, price and terms, then approves the send — Rach.Dev never commits the firm alone.",
          status: "gate",
          gateBy: "Laura Bennett · Partner",
          ms: 1300,
        },
        {
          agent: "coord",
          stage: "comms",
          title: "Sent, scheduled & planned",
          detail:
            "Proposal sent to the client, a walkthrough call booked, and a draft project plan staged in Monday.com on signature.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "revenue",
          stage: "billing",
          title: "Billing schedule armed",
          detail:
            "Milestone invoice schedule drafted in QuickBooks and tied to the SOW, ready to fire on each signed milestone.",
          status: "ok",
          ms: 1100,
        },
      ],
    },
    {
      key: "scope",
      tabLabel: "Scope-creep escalation",
      tabIcon: "shieldAlert",
      subjectName: "Cedar & Vale Architects · Civic center",
      subjectDesc: "Active project — out-of-scope request mid-delivery",
      channel: "Email · Active project",
      channelIcon: "mail",
      steps: [
        {
          agent: "intake",
          stage: "door",
          title: "Client request captured",
          detail:
            "Client emails asking to add two new floor-plan options and a public-consultation deck — logged against the active engagement.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "monitor",
          stage: "screen",
          title: "Scope creep detected",
          detail:
            "Sentinel flags the ask as outside the signed SOW — project is already at 82% of budget with two milestones left.",
          status: "esc",
          ms: 1300,
        },
        {
          agent: "triage",
          stage: "screen",
          title: "Licensing scope check",
          detail:
            "Confirms the new deliverables fall within the firm's licensed architectural scope; no unlicensed-opinion risk.",
          status: "ok",
          ms: 1200,
        },
        {
          agent: "scribe",
          stage: "proposal",
          title: "Change order drafted",
          detail:
            "Drafts a priced change order for the added scope, with revised timeline and a note on the budget impact.",
          status: "ok",
          ms: 1300,
        },
        {
          agent: "revenue",
          stage: "decision",
          title: "Change order approved before any work",
          detail:
            "The principal approves the change-order price and revised SOW — no out-of-scope hours are logged until it's signed.",
          status: "gate",
          gateBy: "David Okafor · Principal",
          ms: 1300,
        },
        {
          agent: "coord",
          stage: "comms",
          title: "Plan & client updated",
          detail:
            "Revised plan pushed to Monday.com, new tasks assigned, and the client sent the change order for signature.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "revenue",
          stage: "billing",
          title: "Billing updated to match",
          detail:
            "QuickBooks invoice schedule updated to reflect the approved change order so the added scope is actually billed.",
          status: "ok",
          ms: 1100,
        },
      ],
    },
    {
      key: "afterhours",
      tabLabel: "After-hours WhatsApp",
      tabIcon: "message",
      subjectName: "Sofía Ramírez · Vega Consulting client",
      subjectDesc: "After-hours billing question, in Spanish",
      channel: "WhatsApp · After hours",
      channelIcon: "message",
      steps: [
        {
          agent: "intake",
          stage: "door",
          title: "Spanish message understood & answered",
          detail:
            "Inbound WhatsApp in Spanish at 9:50 PM; client identified against the active engagement and replied to in her own language.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "knowledge",
          stage: "screen",
          title: "Invoice line-item explained, no advice",
          detail:
            "Answered her question about a line item from the approved invoice and SOW, with sources — and did not offer a licensed opinion.",
          status: "ok",
          ms: 1200,
        },
        {
          agent: "revenue",
          stage: "billing",
          title: "Payment plan request flagged",
          detail:
            "She asks to split the invoice into two payments — staged as a draft arrangement, not promised, pending an account-lead OK.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "coord",
          stage: "decision",
          title: "Payment plan held — account lead confirms",
          detail:
            "A two-payment plan is drafted; the account lead approves the terms before anything is confirmed to the client.",
          status: "gate",
          gateBy: "Megan Portersfield · Account Lead",
          ms: 1300,
        },
        {
          agent: "intake",
          stage: "comms",
          title: "Confirmed in Spanish + reminders",
          detail:
            "Sent the confirmed payment-plan terms in Spanish, with a reminder before each installment is due.",
          status: "ok",
          ms: 1000,
        },
      ],
    },
  ],
  gateNote:
    "Every client commitment waits for an engagement lead. Rach.Dev drafts, prices and stages — a human approves before anything is sent or billed.",
  completeToast: "Engagement complete — every client commitment was lead-approved",

  // ---------------- ROSTER (relay) ----------------
  rosterTitle: "Seven specialists, one conductor",
  rosterIntro:
    "Each agent owns one job and hands the next a complete, structured context. Atlas routes the work, enforces the human-in-the-loop gates, and writes every action to an audit log.",
  rosterClickNote: "Click Ava below — the full lead-to-invoice workflow plays out automatically.",
  orchestratorName: "Atlas",
  orchestratorBlurb:
    "Atlas is the orchestrator. It routes each engagement to the right specialist, carries shared client context between them, pauses for an engagement lead's approval on every client commitment, and records a complete, timestamped audit trail.",
  relayTriggerAgentKey: "intake",
  relayCompleteToast: "Workflow complete — all agents processed the Northwind Logistics engagement",
  agents: [
    {
      key: "intake",
      name: "Ava",
      role: "Front Desk · Proposal & Lead Intake",
      icon: "intake",
      blurb:
        "The front door. Captures every inbound lead and RFP across web form, email, phone and referral, qualifies it against your ICP and service lines, and logs a clean opportunity to HubSpot — 24/7, in English or Spanish.",
      tags: ["Multi-channel intake", "Lead qualification", "EN / ES"],
      pipeSub: "Intake",
      workMs: 2000,
      voice: {
        listeningTitle: "Listening…",
        listeningSub: "Capturing the lead brief by voice",
        doneTitle: "Intake complete",
        doneSub: "6 fields captured · handing off to the team…",
        handoffToast: "Ava done — watch the team pick it up",
        fields: [
          { label: "Prospect", value: "Northwind Logistics" },
          { label: "Request", value: "Brand refresh + new website" },
          { label: "Budget signal", value: "~$120K, decision in 4 weeks" },
          { label: "Service line", value: "Matched: Brand & Creative", ok: true },
          { label: "Owner", value: "Logged to HubSpot — partner assigned", ok: true },
          { label: "Channel", value: "Web form · English" },
        ],
      },
    },
    {
      key: "triage",
      name: "Marcus",
      role: "Scope & Conflict Screen",
      icon: "shieldAlert",
      blurb:
        "Scope & conflict screen. Checks every engagement for conflicts of interest, confidentiality requirements and professional-licensing scope before work starts — and routes anything needing a licensed opinion to a credentialed pro.",
      tags: ["Conflict checks", "Confidentiality", "Licensing scope"],
      pipeSub: "Screen",
      workMs: 2100,
      flow: [
        {
          fromLabel: "Context from Ava",
          chips: ["Northwind Logistics", "Brand & Creative", "~$120K"],
        },
        {
          steps: [
            { text: "Conflict-of-interest scan across active clients — clear", kind: "ok" },
            { text: "Confidentiality & data-isolation requirements noted", kind: "ok" },
            { text: "Sits inside firm's services scope — no licensed-opinion risk", kind: "ok" },
          ],
          note: "If a request needs a licensed opinion, Marcus routes it to a credentialed professional — never answered by an agent.",
        },
      ],
    },
    {
      key: "scribe",
      name: "Nora",
      role: "Proposals & Deliverables",
      icon: "scribe",
      blurb:
        "Proposals & deliverables. Drafts proposals from your past wins, services catalog and rate card, spells out scope-of-work boundaries, and grounds deliverable drafts in your templates — leaving the partner to decide, not write from scratch.",
      tags: ["Proposal drafting", "SOW boundaries", "Grounded in your work"],
      pipeSub: "Drafting",
      workMs: 2000,
      flow: [
        {
          fromLabel: "Context from Marcus",
          chips: ["Conflict clear", "Brand refresh + site", "Confidentiality noted"],
        },
        {
          steps: [
            { text: "Proposal drafted from past brand wins + services catalog", kind: "ok" },
            { text: "Scope-of-work boundaries and exclusions written in", kind: "ok" },
            { text: "Staged for partner review — nothing sent yet", kind: "ok" },
          ],
          note: "Draft only. The proposal is sent solely after an engagement lead approves it.",
        },
      ],
    },
    {
      key: "coord",
      name: "Owen",
      role: "Project Coordination",
      icon: "coord",
      blurb:
        "Project coordination. Pushes plans and tasks to Monday.com, schedules kickoffs and reviews, drafts proactive client status updates from real project data, and keeps everyone on track with reminders and nudges.",
      tags: ["Project plans", "Client comms", "Scheduling"],
      pipeSub: "Coord",
      workMs: 1900,
      flow: [
        {
          fromLabel: "Context from Nora",
          chips: ["Proposal approved", "Plan → Monday.com", "Kickoff call"],
        },
        {
          steps: [
            { text: "Project plan + tasks staged in Monday.com on signature", kind: "ok" },
            { text: "Kickoff and review meetings scheduled with the client", kind: "ok" },
            { text: "Proactive status updates drafted from real project data", kind: "ok" },
          ],
        },
      ],
    },
    {
      key: "revenue",
      name: "Riley",
      role: "Billing & Cash",
      icon: "revenue",
      blurb:
        "Billing & cash. Generates invoices from tracked time and milestones in QuickBooks, answers client line-item questions, prices change orders, and chases payment before AR goes stale — so the firm bills what it earns and collects faster.",
      tags: ["Invoicing", "Change orders", "AR follow-up"],
      pipeSub: "Billing",
      workMs: 2000,
      flow: [
        {
          fromLabel: "Context from Owen",
          chips: ["Milestone schedule", "Harvest time → invoice", "QuickBooks"],
        },
        {
          steps: [
            { text: "Invoices generated from tracked time + signed milestones", kind: "ok" },
            { text: "Change orders priced before any out-of-scope work begins", kind: "ok" },
            { text: "Payment reminders staged before AR ages past terms", kind: "ok" },
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
        "The role-aware knowledge assistant. Answers clients, consultants and partners from your approved sources only — every answer cited, scoped per client engagement, and never a licensed professional opinion.",
      tags: ["Role-aware", "Cited answers", "Never licensed advice"],
      pipeSub: "Knowledge",
      workMs: 1900,
      flow: [
        {
          fromLabel: "Context from Riley",
          chips: ["Client view", "This engagement only", "EN / ES"],
        },
        {
          steps: [
            { text: "Answered client questions from approved SOW + materials", kind: "ok" },
            { text: "Every answer carried its source citation", kind: "ok" },
            { text: "Licensed-opinion request → handed to a credentialed pro", kind: "esc" },
          ],
          note: "Iris informs. It never gives a licensed professional opinion, and never crosses data between client engagements.",
        },
      ],
    },
    {
      key: "monitor",
      name: "Hope",
      role: "Project-Health Sentinel",
      icon: "monitor",
      blurb:
        "The Project-Health Sentinel. Always on, reading the live signal across every active engagement — flagging scope creep, deadline slippage, overdue invoices and sagging utilization before they become a write-off or a client crisis, and staging the response for the engagement lead.",
      tags: ["Always-on monitor", "Early-warning", "Advisory only"],
      pipeSub: "Sentinel",
      workMs: 2400,
      live: { label: "Live · Portfolio" },
      flow: [
        {
          fromLabel: "Context from the firm",
          chips: ["Active engagements", "Budgets & burn", "AR aging", "Utilization"],
        },
        {
          fromLabel: "How Hope calibrates for this firm",
          steps: [
            { text: "Baselines each project's budget, timeline and scope of work", kind: "ok" },
            { text: "Tightens thresholds for fixed-fee and at-risk engagements", kind: "ok" },
            { text: "Suppresses noise so leads see only signals that matter", kind: "ok" },
          ],
        },
        {
          fromLabel: "What Hope watches in real time",
          chips: ["Budget burn", "Timeline", "Scope vs. SOW", "AR aging", "Utilization", "Client sentiment"],
          steps: [
            { text: "Scope creep — work requested beyond the signed SOW", kind: "esc" },
            { text: "Budget risk — burn outpacing milestones toward overrun", kind: "esc" },
            { text: "Deadline slippage — a milestone trending past its date", kind: "esc" },
            { text: "Overdue invoice — AR aging past terms, cash at risk", kind: "esc" },
            { text: "Utilization dip — billable hours falling below target", kind: "esc" },
            { text: "Client risk — sentiment souring or silence on a key thread", kind: "esc" },
          ],
          note: "Hope is advisory. It alerts and stages — an engagement lead decides and acts. Every alert is logged with the signal that triggered it.",
        },
      ],
    },
  ],

  // ---------------- ARCHITECTURE ----------------
  archTitle: "One layer over the systems you already run",
  archIntro:
    "Rach.Dev sits on top of your PSA stack and existing tools — orchestrating agents, enforcing governance, and keeping an engagement lead in the loop. No rip-and-replace.",
  archLayers: [
    {
      n: "Layer 4",
      title: "Human-in-the-loop",
      icon: "decision",
      body: "Every client commitment — proposals, change orders, payment terms — pauses for an engagement lead to approve. Agents draft, price and stage; people decide.",
      pills: ["Approval gates", "Partner sign-off", "Role-based access"],
    },
    {
      n: "Layer 3",
      title: "Governance & audit",
      icon: "shield",
      body: "Per-client data isolation, confidentiality controls, and a complete, timestamped audit trail on every action and every data touch — with retention policies you set.",
      pills: ["Client data isolation", "Full audit log", "Confidentiality", "Source citations"],
    },
    {
      n: "Layer 2",
      title: "Agent orchestration",
      icon: "orchestrator",
      body: "Atlas routes each engagement to the right specialist, carries shared client context between agents, and coordinates hand-offs end to end.",
      pills: ["Routing & hand-off", "Shared context", "Escalation paths"],
    },
    {
      n: "Layer 1",
      title: "Integration",
      icon: "plug",
      body: "Bidirectional connectors to your CRM, project, time-tracking and accounting tools over the APIs your systems already expose.",
      pills: ["CRM & PSA APIs", "Webhooks", "Two-way sync"],
    },
  ],
  archBaseLabel: "Works with the systems you already run",
  archBaseSystems: [
    "HubSpot",
    "Monday.com",
    "Harvest",
    "QuickBooks",
    "Slack",
    "Salesforce",
    "Asana",
    "Xero",
    "DocuSign",
    "Microsoft 365",
  ],

  // ---------------- KNOWLEDGE ----------------
  knowledgeTitle: "A knowledge layer that knows its limits",
  knowledgeIntro:
    "Iris answers clients, consultants and partners from your approved sources only. Every answer is cited and scoped to the right engagement — and any request for a licensed professional opinion is always handed to a credentialed human, never answered by an agent.",
  knowledgeAgentName: "Iris",
  knowledgeViewLabel: "Client view",
  knowledgeGreeting:
    "Hi, I'm Iris. Ask me about your project status, scope, deliverables or an invoice — I'll always cite my source.",
  knowledgeDisclaimer:
    "Iris provides information only — never a licensed professional opinion (legal, tax, audit or licensed-architecture advice). Anything requiring a licensed judgment is routed to a credentialed professional.",
  knowledge: [
    {
      q: "Where does my project stand right now?",
      a: "Your brand refresh is in the design-concept phase — 2 of 5 milestones complete, on schedule for the June 30 review. The two approved logo directions are in your shared Monday.com board, and your next checkpoint is the concept walkthrough on June 17. You can see live status anytime in your client portal.",
      src: ["Monday.com project board", "Engagement SOW", "Client portal"],
    },
    {
      q: "¿Por qué hay un cargo adicional en mi factura?",
      a: "Ese cargo corresponde a la orden de cambio firmada el 22 de mayo, que agregó dos opciones extra de diseño fuera del alcance original. Está detallado por línea en la factura y vinculado al contrato. Si desea revisarlo con su contacto de cuenta, con gusto lo coordino.",
      src: ["Signed change order", "Invoice line items", "Engagement SOW"],
    },
    {
      q: "Can you tell me how to structure this deal to lower our taxes?",
      a: "That calls for a licensed professional opinion, so I won't advise on it myself. I've routed your question to a licensed CPA on your engagement team, who will follow up directly. I can share the general scope of services in your SOW in the meantime, but tax structuring guidance has to come from a credentialed professional.",
      src: ["Engagement SOW", "Credentialed-pro routing"],
    },
  ],

  // ---------------- GOVERNANCE ----------------
  governanceTitle: "Governance, not just guardrails",
  governanceIntro:
    "The controls that let a firm actually deploy agents on client work — enforced in the system, not promised on a slide.",
  guarantees: [
    {
      title: "Engagement lead in the loop",
      desc: "Every proposal, change order and payment term waits for an engagement lead to approve. No agent commits the firm or bills a client on its own.",
    },
    {
      title: "Complete audit trail",
      desc: "Every action, hand-off and data access is logged with a timestamp, the agent, the source and the approver — exportable on demand.",
    },
    {
      title: "Client confidentiality by design",
      desc: "Each client's data is isolated and segmented — agents never cross-reference information between engagements. Configurable retention policies meet your professional standards.",
    },
    {
      title: "Grounded with sources",
      desc: "Answers come only from your approved engagement sources and cite them. No open-web guessing, and never a licensed professional opinion.",
    },
    {
      title: "No vendor lock-in",
      desc: "Standards-based connectors to your CRM, PSA and accounting tools, and your data stays yours. Turn an agent off and your systems keep running.",
    },
  ],
  auditTitle: "Live audit log",
  auditIntro: "A sample of what every action looks like on the record.",
  auditLines: [
    { ts: "21:51:14", text: "Inbound WhatsApp (es) received & answered — client #2207", tag: "ok", tagLabel: "Logged" },
    { ts: "09:04:31", text: "Lead qualified & logged to HubSpot — Northwind Logistics", tag: "ok", tagLabel: "Verified" },
    { ts: "09:05:12", text: "Client data accessed: engagement scope (isolated to client)", tag: "mod", tagLabel: "Confidential" },
    { ts: "09:18:46", text: "Proposal drafted — $120K brand refresh, awaiting sign-off", tag: "mod", tagLabel: "Pending" },
    { ts: "09:22:03", text: "Proposal approved by Laura Bennett, Partner", tag: "ok", tagLabel: "Approved" },
    { ts: "14:37:55", text: "Scope creep flagged (outside signed SOW) — principal alerted", tag: "esc", tagLabel: "Escalated" },
  ],

  // ---------------- OUTCOMES ----------------
  outcomesTitle: "What changes when agents own the busywork",
  outcomesIntro: "Directional outcomes our pilots target — validated on your own data, never assumed.",
  outcomes: [
    {
      value: "24/7",
      label: "Coverage, every channel",
      desc: "Leads, RFPs and client questions answered around the clock, in English and Spanish — no after-hours black hole.",
    },
    {
      value: "Higher",
      label: "Billable utilization",
      desc: "Proposals, status updates and invoice chasing off the bench, so senior people spend their hours on billable work.",
    },
    {
      value: "Caught early",
      label: "Scope creep & overruns",
      desc: "Out-of-scope work flagged as a priced change order before the hours are written off.",
    },
    {
      value: "Faster",
      label: "Cash in the door",
      desc: "Invoices out on time and AR chased before it ages — fewer disputes, shorter days-sales-outstanding.",
    },
  ],
  benchmarks: [
    {
      text: "Average billable utilization across professional services firms ran at roughly 69% in 2024 — below the ~75% threshold most resource-management frameworks treat as the floor for healthy profitability.",
      cite: "SPI Research 2025 Professional Services Maturity Benchmark (reported by Mosaic)",
    },
    {
      text: "About 52% of projects experience scope creep, up from roughly 43% five years earlier — a leading driver of over-servicing and write-offs in professional services.",
      cite: "PMI, Pulse of the Profession 2018",
    },
    {
      text: "Over half of US small businesses — about 56% — report being owed money on unpaid invoices, dragging on cash flow and lengthening collection cycles.",
      cite: "Intuit QuickBooks, 2025 US Small Business Late Payments Report",
    },
  ],
  outcomesNote:
    "Figures above are external benchmarks and pilot targets, not guarantees — we validate every number on your own data before you rely on it. Monitoring agents are advisory: they alert and stage, an engagement lead acts.",

  // ---------------- CTA ----------------
  ctaTitle: "Start with one workflow. Prove it. Then scale.",
  ctaIntro:
    "We stand up a single workflow on your existing PSA stack, show the audit trail and the outcomes, and expand only once your team trusts it.",
  ctaSteps: [
    {
      n: "01",
      title: "Scope one workflow",
      desc: "Pick the highest-pain workflow — proposal drafting, billing follow-up or project-health monitoring — and we map it to your systems.",
    },
    {
      n: "02",
      title: "Pilot in your environment",
      desc: "Agents run on HubSpot, Monday.com, Harvest and QuickBooks with an engagement lead in the loop and a full audit trail, in weeks not quarters.",
    },
    {
      n: "03",
      title: "Measure, then expand",
      desc: "Review the outcomes on your own data — utilization, scope, cash — then roll the agent team out service line by service line.",
    },
  ],

  // ---------------- FAQ (drives FAQPage JSON-LD) ----------------
  faq: [
    {
      q: "Does Rach.Dev replace our PSA or accounting tools?",
      a: "No. Rach.Dev is an operations layer that runs on top of the tools you already use — HubSpot, Monday.com, Harvest, QuickBooks and Slack — over their APIs. Your systems of record stay exactly where they are.",
    },
    {
      q: "How is client confidentiality protected?",
      a: "Each client's data is isolated and segmented, so agents never cross-reference information between engagements. Access is role-based and logged, and retention follows the policies you configure to meet your professional standards.",
    },
    {
      q: "Will the agents give clients licensed professional advice?",
      a: "No. Agents operate in support roles only. Any request for a licensed professional opinion — legal, tax, audit, licensed architecture — is routed to a credentialed professional on the engagement, never answered by an agent.",
    },
    {
      q: "How do the agents help with scope creep and billing?",
      a: "The Project-Health Sentinel watches budgets, timelines, scope-vs-SOW and AR aging across active engagements. When work is requested beyond the signed SOW, it flags a priced change order for approval before any out-of-scope hours are logged or billed.",
    },
    {
      q: "Do the agents work in languages other than English?",
      a: "Yes. Lead intake, client communication and answers support English and Spanish out of the box, across web, email, phone and messaging channels like WhatsApp.",
    },
  ],
};
