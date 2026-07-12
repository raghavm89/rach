import type { IndustryConfig } from "./types";

/**
 * Automotive (US dealership & service) industry config.
 *
 * Content is authored for a US franchise/independent dealer and service center
 * buyer — the 5-minute lead rule, TILA financing disclosures, the FTC Safeguards
 * Rule, open-recall follow-up, and English + Spanish customers — and renders
 * entirely in the Rach.Dev design system. Interactions (Control Tower + relay +
 * knowledge) are fully scripted; no live model is called.
 */
export const automotiveConfig: IndustryConfig = {
  slug: "automotive",
  vertical: "Automotive",
  industrySlug: "automotive",
  industryName: "Automotive",
  icon: "car",
  tagline:
    "An agent team for lead capture, qualification, service scheduling, finance disclosures and recall follow-up — on your DMS and CRM, with a manager in the loop on every quote.",
  seoTitle: "Automotive AI Agents for Dealerships & Service Centers",
  seoDescription:
    "Rach.Dev is an AI operations layer for car dealerships and service centers — agents for lead capture, sales and service inquiry qualification, appointment scheduling, financing disclosures and recall follow-up, on top of your existing DMS and CRM, with a sales or service manager in the loop on every binding quote.",
  seoKeywords: [
    "automotive AI agents",
    "car dealership AI",
    "internet lead response automation",
    "5 minute lead rule",
    "service scheduling automation",
    "DMS CRM automation",
    "dealership BDC automation",
    "recall follow-up automation",
  ],

  // ---------------- HERO ----------------
  eyebrow: "Automotive · Agentic Operations Layer",
  h1Lines: ["The AI operations layer", "for your dealership."],
  rotorLead: "Put a team of agents on your",
  rotorWords: ["internet leads.", "service drive.", "showroom calls.", "financing questions.", "recall list."],
  subhead:
    "Rach.Dev captures and qualifies every sales and service inquiry, books appointments against real DMS availability, presents accurate financing disclosures, and chases the recall and follow-up list across the systems you already use — with a manager in the loop on every binding quote, and a full audit trail on every action.",
  trustRow: [
    "TILA & FTC Safeguards-aligned",
    "Works with your existing DMS & CRM",
    "Manager-in-the-loop",
    "English & Spanish",
  ],
  heroPrimaryCta: { label: "Book a pilot", href: "/contact" },
  heroSecondaryCta: { label: "See the architecture", href: "#architecture" },

  // ---------------- OPERATING PICTURE ----------------
  operateEyebrow: "The operating picture",
  operateTitle: "What an agent team takes off your floor",
  operateIntro:
    "Most of a dealership's lost revenue isn't a missing deal — it's a slow first response, a busy service line and a follow-up that never happened. Here's where agents own the busywork, mapped to how your store actually runs.",
  domains: [
    {
      icon: "door",
      title: "The Front Door",
      blurb: "Every lead and call captured, qualified and routed — 24/7, in English or Spanish.",
      bullets: [
        "Multi-channel intake (web lead, phone, SMS, chat, walk-in)",
        "Sub-five-minute first response on internet leads",
        "Customer & vehicle match against your CRM and DMS",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "triage",
      title: "Lead Qualification",
      blurb: "Intent and timeline scored, hot buyers routed to a salesperson the moment they're warm.",
      bullets: [
        "Buy-vs-browse and timeline scoring on every lead",
        "Trade, budget and financing readiness captured up front",
        "Hot leads handed to the right rep with full context",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "boxes",
      title: "Inventory & Sales",
      blurb: "Trim, features, availability and pricing answered instantly from your live feed.",
      bullets: [
        "Real-time inventory lookup (VIN, trim, color, status)",
        "Side-by-side comparisons and feature questions",
        "Test-drive holds proposed against the showroom calendar",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "wrench",
      title: "Service Drive",
      blurb: "Booked against real DMS availability, with estimates and prep instructions sent.",
      bullets: [
        "Maintenance & repair scheduling on live bay capacity",
        "Time and cost estimates with menu pricing",
        "Confirmations, prep notes and shuttle / loaner options",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "calculator",
      title: "F&I & Disclosures",
      blurb: "Payment scenarios that keep buyers engaged — with TILA disclosures, never a credit offer.",
      bullets: [
        "Monthly payment estimates by credit tier, down and term",
        "APR, term and total-cost disclosures presented accurately",
        "Hand-off to a licensed F&I manager for any binding terms",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "bell",
      title: "Follow-up & Recalls",
      blurb: "The follow-up the store never gets to — re-engaging cold leads and open recalls.",
      bullets: [
        "Lead nurture and unsold-showroom re-engagement",
        "Open-recall outreach with VIN-level lookups",
        "Service-due and declined-work reminders (EN / ES)",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "handCoins",
      title: "Trade-In & Equity",
      blurb: "Preliminary valuations that give shoppers a reason to come in — clearly estimates only.",
      bullets: [
        "Preliminary trade ranges from vehicle details + market data",
        "Equity and upgrade alerts to current owners",
        "Appraisal appointment held for a used-car manager to finalize",
      ],
      tag: { label: "In your build", tone: "muted" },
    },
    {
      icon: "knowledge",
      title: "Knowledge Layer",
      blurb: "A role-aware assistant grounded only in your approved store sources.",
      bullets: [
        "Separate views for shopper, sales and service staff",
        "Every answer cites its source",
        "Hard guardrails — never a binding credit decision",
      ],
      tag: { label: "In demo", tone: "live" },
    },
  ],

  // ---------------- CONTROL TOWER ----------------
  towerTitle: "Watch the team run a deal",
  towerIntro:
    "Pick a customer and press play. Watch the agent team run it end to end — a manager approves every binding quote or financing term.",
  subjectNoun: "customer",
  stages: [
    { key: "door", label: "Lead In", icon: "door" },
    { key: "qualify", label: "Qualify", icon: "triage" },
    { key: "inventory", label: "Inventory", icon: "boxes" },
    { key: "schedule", label: "Schedule", icon: "calendar" },
    { key: "quote", label: "Quote", icon: "decision" },
    { key: "deliver", label: "Hand-off", icon: "coord" },
    { key: "follow", label: "Follow-up", icon: "follow" },
  ],
  scenarios: [
    {
      key: "lead",
      tabLabel: "Internet lead",
      tabIcon: "zap",
      subjectName: "Brandon Carter · F-150 Lariat",
      subjectDesc: "New web lead — financing question",
      channel: "Web lead · Daytime",
      channelIcon: "zap",
      steps: [
        {
          agent: "intake",
          stage: "door",
          title: "Lead answered in under 5 minutes",
          detail:
            "Inbound web lead on a 2025 F-150 Lariat captured, matched to a prior CRM record, and replied to personally inside the first-five-minute window.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "qualify",
          title: "Hot buyer — short timeline",
          detail:
            "Budget, trade and a 'this month' timeline captured; scored a hot lead and queued for the right salesperson with full context.",
          status: "ok",
          ms: 1200,
        },
        {
          agent: "scribe",
          stage: "inventory",
          title: "Exact match pulled from the feed",
          detail:
            "Two matching Lariats located in live inventory with trim, color, packages and pricing surfaced; a comparable in-transit unit noted.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "revenue",
          stage: "quote",
          title: "Payment estimate — TILA disclosures, not a credit offer",
          detail:
            "An estimated monthly payment range by credit tier presented with APR, term and total-cost disclosures, clearly labeled an estimate — never a binding offer.",
          status: "ok",
          ms: 1200,
        },
        {
          agent: "monitor",
          stage: "quote",
          title: "Guardrail tripped — binding rate request",
          detail:
            "Customer asks to lock a specific APR; the Sentinel flags a TILA / FTC Safeguards boundary — no agent may commit credit terms — and routes the deal to F&I before anything is promised.",
          status: "esc",
          ms: 1300,
        },
        {
          agent: "revenue",
          stage: "quote",
          title: "Binding numbers — F&I manager approves",
          detail:
            "Customer asks to lock a rate; the agent stages the deal and pauses — a licensed F&I manager reviews and signs off before any committed terms go out.",
          status: "gate",
          gateBy: "Dana Whitfield · F&I Mgr",
          ms: 1300,
        },
        {
          agent: "coord",
          stage: "deliver",
          title: "Test drive booked & rep briefed",
          detail:
            "A Saturday test drive held on the showroom calendar; the assigned salesperson briefed with the full lead history before the customer arrives.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "monitor",
          stage: "follow",
          title: "Lead-speed watch armed",
          detail:
            "If the customer goes quiet or a competing inquiry lands, the Sentinel re-engages on cadence and alerts the rep — no lead left to go cold.",
          status: "ok",
          ms: 1100,
        },
      ],
    },
    {
      key: "service",
      tabLabel: "Service booking",
      tabIcon: "wrench",
      subjectName: "Karen Mitchell · 2021 RAV4",
      subjectDesc: "Brake noise + 40k service",
      channel: "Phone · Service drive",
      channelIcon: "phone",
      steps: [
        {
          agent: "intake",
          stage: "door",
          title: "Service call answered, not missed",
          detail:
            "Inbound call captured during the morning rush, customer and VIN matched, and her concern logged without a busy signal or a voicemail.",
          status: "ok",
          ms: 1000,
        },
        {
          agent: "triage",
          stage: "qualify",
          title: "Concern triaged & menu matched",
          detail:
            "Brake noise plus a due 40k-mile service identified; mapped to the right op-codes and an advisor with capacity.",
          status: "ok",
          ms: 1000,
        },
        {
          agent: "scribe",
          stage: "inventory",
          title: "History & open items surfaced",
          detail:
            "Last visit, declined brake work from the prior RO and an open recall on the VIN pulled up for the advisor.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "coord",
          stage: "schedule",
          title: "Booked on real DMS availability",
          detail:
            "A Thursday 8:30 AM slot held against live bay capacity, with a loaner reserved and prep instructions queued.",
          status: "ok",
          ms: 1000,
        },
        {
          agent: "revenue",
          stage: "quote",
          title: "Estimate over threshold — advisor approves",
          detail:
            "The brake-plus-recall estimate exceeds the auto-quote threshold; a service advisor reviews and approves the figure before it's promised.",
          status: "gate",
          gateBy: "Marcus Bell · Service Advisor",
          ms: 1200,
        },
        {
          agent: "coord",
          stage: "deliver",
          title: "Confirmation + recall flagged",
          detail:
            "Appointment confirmed by text with prep notes; the open recall flagged so it's handled in the same visit at no charge.",
          status: "ok",
          ms: 1000,
        },
        {
          agent: "revenue",
          stage: "follow",
          title: "Declined work logged for follow-up",
          detail:
            "Any work deferred at check-in is logged for a timed follow-up, and the next service interval pre-scheduled.",
          status: "ok",
          ms: 1000,
        },
      ],
    },
    {
      key: "sms",
      tabLabel: "After-hours text",
      tabIcon: "message",
      subjectName: "María García · 2019 Civic",
      subjectDesc: "After-hours text, in Spanish",
      channel: "SMS · After hours",
      channelIcon: "message",
      steps: [
        {
          agent: "intake",
          stage: "door",
          title: "Spanish text understood & answered",
          detail:
            "Inbound SMS in Spanish recognized at 10:20 PM after the store closed; customer and her 2019 Civic identified and replied to in her own language.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "qualify",
          title: "Recall question triaged",
          detail:
            "She's asking about a safety-recall letter she received; intent recognized as service-recall, routed to the recall workflow.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "knowledge",
          stage: "inventory",
          title: "Grounded answer, no credit decision",
          detail:
            "Confirmed her VIN has an open airbag recall from approved manufacturer sources, in Spanish, with the source cited — and explicitly made no financing or credit claim.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "coord",
          stage: "schedule",
          title: "Morning recall slot held — advisor confirms",
          detail:
            "A no-charge recall slot is held for the next morning; the service advisor approves the reserved part and bay before it's promised.",
          status: "gate",
          gateBy: "Owen Pratt · Service Mgr",
          ms: 1200,
        },
        {
          agent: "intake",
          stage: "follow",
          title: "Confirmed in Spanish + reminder",
          detail:
            "Sent the confirmed recall appointment and what to bring in Spanish, with a reminder the morning of the visit.",
          status: "ok",
          ms: 1000,
        },
      ],
    },
  ],
  gateNote:
    "Every binding quote and financing term waits for a manager. Rach.Dev drafts, stages and routes — a human approves before anything is committed.",
  completeToast: "Journey complete — every binding quote was manager-approved",

  // ---------------- ROSTER (relay) ----------------
  rosterTitle: "Seven specialists, one conductor",
  rosterIntro:
    "Each agent owns one job and hands the next a complete, structured context. Atlas routes the work, enforces the human-in-the-loop gates on every binding quote, and writes every action to an audit log.",
  rosterClickNote: "Click Ava below — the full lead-to-follow-up workflow plays out automatically.",
  orchestratorName: "Atlas",
  orchestratorBlurb:
    "Atlas is the orchestrator. It routes each customer to the right specialist, carries shared deal and vehicle context between them, pauses for manager approval on every binding quote or financing term, and records a complete, timestamped audit trail.",
  relayTriggerAgentKey: "intake",
  relayCompleteToast: "Workflow complete — all agents processed Brandon Carter's lead",
  agents: [
    {
      key: "intake",
      name: "Ava",
      role: "BDC · Lead Capture",
      icon: "intake",
      blurb:
        "The front door. Captures every sales and service inquiry across web lead, phone, SMS, chat and walk-in, matches the customer and vehicle in your CRM and DMS, and answers inside the first-five-minute window — 24/7, in English or Spanish.",
      tags: ["Multi-channel intake", "Sub-5-min response", "EN / ES"],
      pipeSub: "Lead Capture",
      workMs: 2000,
      voice: {
        listeningTitle: "Listening…",
        listeningSub: "Capturing the customer inquiry by voice",
        doneTitle: "Intake complete",
        doneSub: "6 fields captured · handing off to the team…",
        handoffToast: "Ava done — watch the team pick it up",
        fields: [
          { label: "Customer", value: "Brandon Carter" },
          { label: "Interest", value: "2025 Ford F-150 Lariat" },
          { label: "Trade / budget", value: "2019 Tacoma trade; ~$650/mo target" },
          { label: "Customer record", value: "Matched in CRM (prior service guest)", ok: true },
          { label: "Lead source", value: "Web lead — captured in 2m 40s", ok: true },
          { label: "Channel", value: "Web form · English" },
        ],
      },
    },
    {
      key: "triage",
      name: "Marcus",
      role: "Lead Qualification",
      icon: "triage",
      blurb:
        "Lead qualification. Scores intent and timeline, captures trade, budget and financing readiness, and routes a hot buyer straight to the right salesperson — never letting a ready customer wait in a queue.",
      tags: ["Intent scoring", "Timeline & budget", "Hot-lead routing"],
      pipeSub: "Qualify",
      workMs: 2100,
      flow: [
        {
          fromLabel: "Context from Ava",
          chips: ["Brandon Carter", "F-150 Lariat", "Trade: '19 Tacoma"],
        },
        {
          steps: [
            { text: "Intent scored — hot buyer, 'this month' timeline", kind: "ok" },
            { text: "Trade, down payment and budget band captured", kind: "ok" },
            { text: "Routed to the right rep with the full lead history", kind: "ok" },
          ],
        },
      ],
    },
    {
      key: "scribe",
      name: "Nora",
      role: "Inventory Match",
      icon: "scribe",
      blurb:
        "Inventory match. Reads the live feed to find exact and comparable units, surfaces trim, packages, pricing and status, and pulls the customer's service and recall history — leaving the salesperson to sell, not search.",
      tags: ["Live inventory", "Comparisons", "Vehicle history"],
      pipeSub: "Inventory",
      workMs: 2000,
      flow: [
        {
          fromLabel: "Context from Marcus",
          chips: ["Hot buyer", "F-150 Lariat", "Color: any · 4x4"],
        },
        {
          steps: [
            { text: "Two matching Lariats found in live inventory", kind: "ok" },
            { text: "Trim, packages, pricing and status surfaced", kind: "ok" },
            { text: "One in-transit comparable flagged for the rep", kind: "ok" },
          ],
          note: "Inventory and pricing are read from your feed. Any committed price is staged for a manager, never auto-promised.",
        },
      ],
    },
    {
      key: "coord",
      name: "Owen",
      role: "Scheduling & Hand-off",
      icon: "coord",
      blurb:
        "Scheduling & hand-off. Books test drives and service against real DMS and showroom availability, reserves loaners and parts, confirms with prep instructions, and briefs the rep or advisor before the customer arrives.",
      tags: ["DMS scheduling", "Loaner & parts", "Confirmations"],
      pipeSub: "Schedule",
      workMs: 1900,
      flow: [
        {
          fromLabel: "Context from Nora",
          chips: ["Test drive: Sat AM", "Loaner reserved", "Rep briefed"],
        },
        {
          steps: [
            { text: "Slot held against live showroom / bay capacity", kind: "ok" },
            { text: "Loaner and any needed parts reserved", kind: "ok" },
            { text: "Confirmation + prep notes sent; rep briefed", kind: "ok" },
          ],
        },
      ],
    },
    {
      key: "revenue",
      name: "Riley",
      role: "F&I Disclosures",
      icon: "revenue",
      blurb:
        "F&I disclosures. Builds payment scenarios by credit tier, down and term, presents APR, term and total-cost disclosures accurately under TILA, and hands every binding number to a licensed F&I manager — never a credit decision on its own.",
      tags: ["Payment estimates", "TILA disclosures", "Manager sign-off"],
      pipeSub: "F&I",
      workMs: 2000,
      flow: [
        {
          fromLabel: "Context from Owen",
          chips: ["~$650/mo target", "Trade equity est.", "Tier 1–3 scenarios"],
        },
        {
          steps: [
            { text: "Payment estimates built by credit tier, down and term", kind: "ok" },
            { text: "APR, term and total-cost disclosures presented", kind: "ok" },
            { text: "Binding rate request → F&I manager, not auto-quoted", kind: "esc" },
          ],
          note: "Estimate only. No APR, approval or binding term is committed until a licensed F&I manager signs off.",
        },
      ],
    },
    {
      key: "knowledge",
      name: "Iris",
      role: "Knowledge Assistant",
      icon: "knowledge",
      blurb:
        "The role-aware knowledge assistant. Answers shoppers, sales and service staff from your approved store sources only — every answer cited, and never a binding credit or financing decision.",
      tags: ["Role-aware", "Cited answers", "Never a credit decision"],
      pipeSub: "Knowledge",
      workMs: 1900,
      flow: [
        {
          fromLabel: "Context from Riley",
          chips: ["Shopper view", "Approved sources only", "EN / ES"],
        },
        {
          steps: [
            { text: "Answered the customer's questions from approved sources", kind: "ok" },
            { text: "Every answer carried its source citation", kind: "ok" },
            { text: "Credit-approval request → handed to F&I, not answered", kind: "esc" },
          ],
          note: "Iris informs. It never approves credit, commits a rate or overrides an F&I manager.",
        },
      ],
    },
    {
      key: "monitor",
      name: "Hope",
      role: "Lead-Speed Sentinel",
      icon: "monitor",
      blurb:
        "The Lead-Speed Sentinel. Always on, watching every new lead, open recall and overdue follow-up — re-engaging before a buyer goes cold, surfacing open recalls by VIN, and staging the next touch for the team.",
      tags: ["Always-on monitor", "5-min lead rule", "Advisory only"],
      pipeSub: "Sentinel",
      workMs: 2400,
      live: { label: "Live · Leads" },
      flow: [
        {
          fromLabel: "Context from the store",
          chips: ["New leads", "Open recalls", "Follow-up due"],
        },
        {
          fromLabel: "How Hope calibrates for this store",
          steps: [
            { text: "Baselines first-response time across every lead source", kind: "ok" },
            { text: "Tightens cadence for hot leads and aged opportunities", kind: "ok" },
            { text: "Suppresses duplicate touches to avoid over-messaging", kind: "ok" },
          ],
        },
        {
          fromLabel: "What Hope watches in real time",
          chips: ["Lead age", "Response SLA", "Open recalls", "Service due", "Declined work", "Reviews"],
          steps: [
            { text: "Five-minute breach — new lead unanswered past SLA", kind: "esc" },
            { text: "Open recall — safety recall unrepaired on a known VIN", kind: "esc" },
            { text: "Going cold — hot lead with no reply in 24 hours", kind: "esc" },
            { text: "Service overdue — past-due maintenance on an active customer", kind: "esc" },
            { text: "Declined work — deferred repair never followed up", kind: "esc" },
            { text: "At-risk review — negative survey or low CSI flag", kind: "esc" },
          ],
          note: "Hope is advisory. It alerts and stages the next touch — a salesperson or advisor decides and acts. Every alert is logged with the signal that triggered it.",
        },
      ],
    },
  ],

  // ---------------- ARCHITECTURE ----------------
  archTitle: "One layer over the systems you already run",
  archIntro:
    "Rach.Dev sits on top of your DMS, CRM, inventory feed and scheduling — orchestrating agents, enforcing governance, and keeping a manager in the loop on every binding quote. No rip-and-replace.",
  archLayers: [
    {
      n: "Layer 4",
      title: "Human-in-the-loop",
      icon: "decision",
      body: "Every binding action — committed pricing, APRs, financing terms, large repair estimates — pauses for a manager to approve. Agents draft and stage; people decide.",
      pills: ["Approval gates", "Manager sign-off", "Role-based access"],
    },
    {
      n: "Layer 3",
      title: "Governance & audit",
      icon: "shield",
      body: "TILA-accurate disclosures, FTC Safeguards-aligned handling of customer financial data, and a complete, timestamped audit trail on every action and every data touch.",
      pills: ["TILA disclosures", "FTC Safeguards-aligned", "Full audit log", "Source citations"],
    },
    {
      n: "Layer 2",
      title: "Agent orchestration",
      icon: "orchestrator",
      body: "Atlas routes each customer to the right specialist, carries shared deal and vehicle context between agents, and coordinates hand-offs end to end.",
      pills: ["Routing & hand-off", "Shared context", "Escalation paths"],
    },
    {
      n: "Layer 1",
      title: "Integration",
      icon: "plug",
      body: "Bidirectional connectors to your DMS, CRM, inventory feed, scheduling and telephony over the standards your systems already speak.",
      pills: ["DMS / CRM APIs", "Inventory feeds", "Webhooks & APIs"],
    },
  ],
  archBaseLabel: "Works with the systems you already run",
  archBaseSystems: [
    "CDK Global",
    "Reynolds and Reynolds",
    "Dealertrack DMS",
    "VinSolutions CRM",
    "DealerSocket",
    "Xtime",
    "vAuto inventory",
    "Twilio",
    "RouteOne",
    "Kelley Blue Book",
  ],

  // ---------------- KNOWLEDGE ----------------
  knowledgeTitle: "A knowledge layer that knows its limits",
  knowledgeIntro:
    "Iris answers shoppers, sales and service staff from your approved store sources only. Every answer is cited — and any credit or financing decision is always handed to a licensed F&I manager, never decided by the agent.",
  knowledgeAgentName: "Iris",
  knowledgeViewLabel: "Shopper view",
  knowledgeGreeting:
    "Hi, I'm Iris. Ask me about inventory, service, pricing or your appointment — I'll always cite my source.",
  knowledgeDisclaimer:
    "Iris provides information and estimates only — never a binding price, an APR, a credit approval or financing advice. Anything binding is routed to a licensed F&I or sales manager.",
  knowledge: [
    {
      q: "Do you have a 2025 F-150 Lariat in stock?",
      a: "Yes — we currently show two 2025 F-150 Lariat 4x4s in inventory, one in Agate Black and one in Oxford White, plus a comparable unit in transit. Trim, packages and pricing are pulled live from our inventory feed. I can hold one for a test drive — a salesperson will confirm the final out-the-door figure with you.",
      src: ["Live inventory feed", "DMS vehicle record"],
    },
    {
      q: "¿Mi carro tiene una llamada a revisión (recall) abierta?",
      a: "Con su VIN puedo verificar las llamadas a revisión de seguridad abiertas según los datos del fabricante. Estas reparaciones de recall no tienen costo para usted. Puedo reservarle una cita en el departamento de servicio — un asesor confirmará la pieza y el horario. Aquí solo le doy información de recall, no decisiones de financiamiento.",
      src: ["Manufacturer recall data", "DMS service record"],
    },
    {
      q: "Can you tell me what APR I'll be approved for?",
      a: "I can't approve credit or quote you a binding APR — that's a decision for a licensed F&I manager based on a real application. I can show you estimated monthly payments by credit tier with the APR, term and total-cost disclosures clearly marked as estimates, and connect you with our F&I manager to get actual terms. This is not a financing offer or credit advice.",
      src: ["TILA disclosure policy", "F&I routing"],
    },
  ],

  // ---------------- GOVERNANCE ----------------
  governanceTitle: "Governance, not just guardrails",
  governanceIntro:
    "The controls that let a dealership actually deploy agents — enforced in the system, not promised on a slide.",
  guarantees: [
    {
      title: "Manager in the loop",
      desc: "Every binding quote, APR and financing term waits for a licensed manager to approve. No agent commits a price or a credit decision on its own.",
    },
    {
      title: "Complete audit trail",
      desc: "Every action, hand-off and data access is logged with a timestamp, the agent, the source and the approver — exportable on demand.",
    },
    {
      title: "TILA & FTC Safeguards-aligned",
      desc: "Financing disclosures (APR, terms, total cost) are presented accurately and never as a binding offer, and customer financial data is handled under FTC Safeguards Rule controls — encryption, access limits and minimal retention.",
    },
    {
      title: "Grounded with sources",
      desc: "Answers come only from your approved inventory, pricing and store sources and cite them. No open-web guessing, no ungrounded claims.",
    },
    {
      title: "No vendor lock-in",
      desc: "Standards-based connectors to your DMS and CRM, and your data stays yours. Turn an agent off and your systems keep running.",
    },
  ],
  auditTitle: "Live audit log",
  auditIntro: "A sample of what every action looks like on the record.",
  auditLines: [
    { ts: "22:21:04", text: "Inbound SMS (es) received & answered — guest #7715", tag: "ok", tagLabel: "Logged" },
    { ts: "09:02:18", text: "Web lead captured & answered in 2m 40s — SLA met", tag: "ok", tagLabel: "On time" },
    { ts: "09:03:55", text: "Customer financial data accessed (Safeguards-scoped)", tag: "mod", tagLabel: "PII" },
    { ts: "09:05:31", text: "Payment estimate drafted — TILA disclosures attached, awaiting sign-off", tag: "mod", tagLabel: "Pending" },
    { ts: "09:06:12", text: "Binding terms approved by Dana Whitfield, F&I Mgr", tag: "ok", tagLabel: "Approved" },
    { ts: "11:14:47", text: "Open airbag recall detected on VIN — service notified", tag: "esc", tagLabel: "Escalated" },
  ],

  // ---------------- OUTCOMES ----------------
  outcomesTitle: "What changes when agents own the busywork",
  outcomesIntro: "Directional outcomes our pilots target — validated on your own data, never assumed.",
  outcomes: [
    {
      value: "24/7",
      label: "Coverage, every channel",
      desc: "Web leads, phone, SMS and chat answered around the clock, in English and Spanish — no after-hours voicemail.",
    },
    {
      value: "< 5 min",
      label: "First response on leads",
      desc: "Every internet lead answered personally inside the window where contact and conversion are highest.",
    },
    {
      value: "Full",
      label: "Service bay utilization",
      desc: "Calls answered and slots booked on live DMS capacity — fewer missed calls, fewer empty bays.",
    },
    {
      value: "Hours back",
      label: "For sales & service",
      desc: "Less repetitive Q&A and chasing, more time closing deals and turning the service drive.",
    },
  ],
  benchmarks: [
    {
      text: "Research on online sales leads found that firms responding within about five minutes were roughly 21 times more likely to qualify a lead than those that waited 30 minutes — yet most leads are answered far slower.",
      cite: "Oldroyd, McElheran & Elkington, Harvard Business Review, 2011",
    },
    {
      text: "NHTSA data on safety-recall completion suggests that, even years out, a large share of recalled vehicles remain unrepaired — roughly tens of millions of open recalls on US roads.",
      cite: "NHTSA, Vehicle Safety Recall Completion Rates Report to Congress",
    },
    {
      text: "Cox Automotive's Car Buyer Journey study reports record buyer satisfaction tied to a faster, more efficient process — with heavy-digital buyers cutting time at the dealership by up to roughly 40 minutes.",
      cite: "Cox Automotive, Car Buyer Journey Study, 2024",
    },
  ],
  outcomesNote:
    "Figures above are external benchmarks and pilot targets, not guarantees — we validate every number on your own data before you rely on it. Monitoring agents are advisory: they alert and stage, a person acts.",

  // ---------------- CTA ----------------
  ctaTitle: "Start with one workflow. Prove it. Then scale.",
  ctaIntro:
    "We stand up a single workflow on your existing DMS and CRM, show the audit trail and the outcomes, and expand only once your team trusts it.",
  ctaSteps: [
    {
      n: "01",
      title: "Scope one workflow",
      desc: "Pick the highest-pain workflow — internet-lead response, service scheduling or recall follow-up — and we map it to your systems.",
    },
    {
      n: "02",
      title: "Pilot in your environment",
      desc: "Agents run on your DMS and CRM with a manager in the loop and a full audit trail, in weeks not quarters.",
    },
    {
      n: "03",
      title: "Measure, then expand",
      desc: "Review the outcomes on your own data, then roll the agent team out store by store and department by department.",
    },
  ],

  // ---------------- FAQ (drives FAQPage JSON-LD) ----------------
  faq: [
    {
      q: "Does Rach.Dev replace our DMS or CRM?",
      a: "No. Rach.Dev is an operations layer that runs on top of your existing DMS and CRM (CDK, Reynolds and Reynolds, Dealertrack, VinSolutions and others). Your systems of record stay exactly where they are.",
    },
    {
      q: "Do the agents make financing or credit decisions?",
      a: "No. Agents present estimated payments with accurate APR, term and total-cost disclosures under TILA, clearly labeled as estimates. Any binding rate, approval or financing term pauses for a licensed F&I manager to approve. Monitoring agents are advisory only.",
    },
    {
      q: "How do the agents handle customer financial data?",
      a: "Customer financial information is handled under FTC Safeguards Rule-aligned controls — encryption in transit and at rest, role-based access, minimum-necessary use and limited retention — with a full audit trail on every access.",
    },
    {
      q: "How fast do the agents respond to internet leads?",
      a: "Agents are built to answer every internet lead personally inside the first-five-minute window, across web lead, phone, SMS and chat, 24/7 — and the Lead-Speed Sentinel re-engages any lead that starts to go cold.",
    },
    {
      q: "Do the agents work in languages other than English?",
      a: "Yes. Lead capture, service scheduling, reminders and shopper answers support English and Spanish out of the box, across phone, SMS, chat and web.",
    },
  ],
};
