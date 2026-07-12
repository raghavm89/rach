import type { IndustryConfig } from "./types";

/**
 * Real Estate (US residential brokerage) industry config.
 *
 * Content is authored for a US brokerage / team lead buyer — Fair Housing Act,
 * RESPA, state licensing disclosure, MLS data, English + Spanish — and renders
 * entirely in the Rach.Dev design system. Interactions (Control Tower + relay +
 * knowledge) are fully scripted; no live model is called.
 */
export const realEstateConfig: IndustryConfig = {
  slug: "real-estate",
  vertical: "Real Estate",
  industrySlug: "real-estate",
  industryName: "Real Estate",
  icon: "home",
  tagline:
    "An agent team for lead capture, qualification, showings, document prep, market analysis and deal-deadline monitoring — on your MLS and CRM, with a licensed agent in the loop.",
  seoTitle: "Real Estate AI Agents for Brokerages & Teams",
  seoDescription:
    "Rach.Dev is an AI operations layer for real estate brokerages and teams — agents for lead capture, qualification, showing scheduling, document prep, market analysis and deal-deadline monitoring, on top of your MLS, Follow Up Boss, kvCORE, DocuSign and calendar, with a licensed agent in the loop and Fair Housing guardrails on every recommendation.",
  seoKeywords: [
    "real estate AI agents",
    "real estate lead response automation",
    "lead qualification automation",
    "showing scheduler AI",
    "MLS automation",
    "Follow Up Boss automation",
    "Fair Housing compliant AI",
    "real estate transaction coordination",
  ],

  // ---------------- HERO ----------------
  eyebrow: "Real Estate · Agentic Operations Layer",
  h1Lines: ["The AI operations layer", "for your brokerage."],
  rotorLead: "Put a team of agents on your",
  rotorWords: ["leads.", "qualification.", "showings.", "contracts.", "deal deadlines."],
  subhead:
    "Rach.Dev runs lead capture, qualification, showing scheduling, document prep, market analysis and deal-deadline monitoring across the systems you already use — with a licensed agent in the loop on every commitment, Fair Housing guardrails on every recommendation, and a full audit trail on every action.",
  trustRow: [
    "Fair Housing & RESPA guardrails",
    "Works with your MLS & CRM",
    "Agent-in-the-loop",
    "English & Spanish",
  ],
  heroPrimaryCta: { label: "Book a pilot", href: "/contact" },
  heroSecondaryCta: { label: "See the architecture", href: "#architecture" },

  // ---------------- OPERATING PICTURE ----------------
  operateEyebrow: "The operating picture",
  operateTitle: "What an agent team takes off your desk",
  operateIntro:
    "Most of a brokerage's load isn't negotiation or judgement — it's responding fast, qualifying, scheduling, chasing paperwork and watching deadlines. Here's where agents own the busywork, mapped to how your team actually runs a deal.",
  domains: [
    {
      icon: "door",
      title: "The Front Door",
      blurb: "Every inquiry answered in seconds — 24/7, across portal, web form, SMS and call, in English or Spanish.",
      bullets: [
        "Multi-channel capture (Zillow / Realtor.com, web, SMS, call)",
        "Instant first reply, day or night",
        "Auto-logged to Follow Up Boss / kvCORE with source",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "userSearch",
      title: "Lead Qualification",
      blurb: "Budget, timeline, financing and intent — captured conversationally, never as an interrogation.",
      bullets: [
        "Budget, pre-approval and timeline scored",
        "Buyer vs. seller vs. renter routing",
        "Hot leads paged to the right agent instantly",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "home",
      title: "Property Inquiry",
      blurb: "Square footage, lot size, schools and comps — answered from live MLS data, never invented.",
      bullets: [
        "Listing facts pulled straight from MLS",
        "Comparable-sales summaries on request",
        "Fair-Housing-safe phrasing on every answer",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "calendar",
      title: "Showing Coordination",
      blurb: "The back-and-forth of finding a time, confirming and following up — handled end to end.",
      bullets: [
        "Two-way calendar sync for agent + client",
        "Confirmations, reminders and reschedules",
        "Post-showing feedback collected automatically",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "fileSignature",
      title: "Transaction & Docs",
      blurb: "Listing agreements, disclosures and offer paperwork drafted and staged — the agent signs.",
      bullets: [
        "Listing agreement & disclosure prep",
        "Offer / counter packets staged for DocuSign",
        "Required state disclosures attached",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "trendingUp",
      title: "Market Analysis",
      blurb: "Client-ready CMAs, neighborhood insights and pricing ranges — grounded in your MLS comps.",
      bullets: [
        "Comparative market analysis from active + sold comps",
        "Neighborhood and days-on-market context",
        "Pricing range, never a guaranteed value",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "handshake",
      title: "Sphere & Past Clients",
      blurb: "The referral and repeat business that slips because nobody had time to follow up.",
      bullets: [
        "Home-anniversary and check-in nudges",
        "Past-client referral campaigns",
        "Drip nurture for long-timeline leads",
      ],
      tag: { label: "In your build", tone: "muted" },
    },
    {
      icon: "knowledge",
      title: "Knowledge Layer",
      blurb: "A role-aware assistant grounded only in your listings, policies and approved sources.",
      bullets: [
        "Separate views for buyer, seller and staff",
        "Every answer cites its source",
        "Hard guardrails — never legal or lending advice",
      ],
      tag: { label: "In demo", tone: "live" },
    },
  ],

  // ---------------- CONTROL TOWER ----------------
  towerTitle: "Watch the team run a deal",
  towerIntro:
    "Pick a deal and press play. Watch the agent team run it end to end — a licensed agent approves every commitment.",
  subjectNoun: "lead",
  stages: [
    { key: "capture", label: "Lead Capture", icon: "door" },
    { key: "qualify", label: "Qualify", icon: "userSearch" },
    { key: "inquiry", label: "Property Inquiry", icon: "home" },
    { key: "showing", label: "Showing", icon: "calendar" },
    { key: "offer", label: "Offer & Docs", icon: "fileSignature" },
    { key: "underContract", label: "Under Contract", icon: "clipboardCheck" },
    { key: "followup", label: "Follow-up", icon: "follow" },
  ],
  scenarios: [
    {
      key: "afterhours",
      tabLabel: "After-hours SMS lead",
      tabIcon: "message",
      subjectName: "Jordan Blake · Buyer",
      subjectDesc: "Texted about a listing at 10:47 PM",
      channel: "SMS · After hours",
      channelIcon: "message",
      steps: [
        {
          agent: "intake",
          stage: "capture",
          title: "Inbound text answered in seconds",
          detail:
            "SMS about 412 Maple Ave arrives at 10:47 PM; replied instantly and logged to Follow Up Boss with the Zillow source — no overnight voicemail.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "qualify",
          title: "Lead qualified conversationally",
          detail:
            "Budget ~$525K, pre-approved, 60-day timeline, relocating for work → scored hot buyer and routed to the listing team.",
          status: "ok",
          ms: 1200,
        },
        {
          agent: "knowledge",
          stage: "inquiry",
          title: "Listing facts answered from MLS",
          detail:
            "Square footage, lot size, HOA and assigned schools answered from live MLS data, with sources — and no steering language.",
          status: "ok",
          ms: 1200,
        },
        {
          agent: "coord",
          stage: "showing",
          title: "Saturday showing held — agent confirms",
          detail:
            "A 10:30 AM Saturday slot is held against the agent's calendar; the licensed agent approves before it's promised to the buyer.",
          status: "gate",
          gateBy: "Megan Carter · Listing Agent",
          ms: 1300,
        },
        {
          agent: "intake",
          stage: "followup",
          title: "Confirmed by text + reminder set",
          detail:
            "Sent the confirmed time, address and parking notes by SMS, with a reminder the morning of the showing.",
          status: "ok",
          ms: 1000,
        },
      ],
    },
    {
      key: "listing",
      tabLabel: "Seller listing appt",
      tabIcon: "home",
      subjectName: "Patricia & Tom Nguyen · Sellers",
      subjectDesc: "Want to list their home this spring",
      channel: "Web form · Seller",
      channelIcon: "door",
      steps: [
        {
          agent: "intake",
          stage: "capture",
          title: "Seller inquiry captured & verified",
          detail:
            "Web-form seller lead identified, property address matched, and a listing-consult request opened in kvCORE in seconds.",
          status: "ok",
          ms: 1000,
        },
        {
          agent: "triage",
          stage: "qualify",
          title: "Seller intent confirmed",
          detail:
            "Owner-occupant, motivated to list within 60 days, no existing listing agreement — routed to a listing agent, no conflict.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "revenue",
          stage: "inquiry",
          title: "CMA drafted from MLS comps",
          detail:
            "Comparative market analysis assembled from active and sold comps, with a pricing range and days-on-market context — a range, never a guaranteed value.",
          status: "ok",
          ms: 1300,
        },
        {
          agent: "coord",
          stage: "showing",
          title: "Listing consult booked",
          detail: "An in-home consult booked against the agent's calendar with confirmation and prep checklist sent.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "scribe",
          stage: "offer",
          title: "Listing agreement — agent signs",
          detail:
            "Listing agreement and seller disclosures drafted and staged in DocuSign from the consult notes; the listing agent reviews and signs before anything is sent.",
          status: "gate",
          gateBy: "David Okafor · Broker",
          ms: 1300,
        },
        {
          agent: "monitor",
          stage: "underContract",
          title: "Listing timeline watch armed",
          detail:
            "Deal Sentinel begins watching photos, MLS go-live, price-feedback and showing cadence for this listing; advisory alerts wired to the team.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "revenue",
          stage: "followup",
          title: "Marketing queued & sphere notified",
          detail:
            "Listing marketing scheduled and a coming-soon nudge queued to the team's sphere — no kickback or steered referral.",
          status: "ok",
          ms: 1000,
        },
      ],
    },
    {
      key: "deadline",
      tabLabel: "Financing deadline risk",
      tabIcon: "alarm",
      subjectName: "Robert & Lisa Hernández · Buyers",
      subjectDesc: "Under contract — financing contingency due in 48h",
      channel: "Monitor · Under contract",
      channelIcon: "monitor",
      steps: [
        {
          agent: "monitor",
          stage: "underContract",
          title: "Financing contingency at risk",
          detail:
            "Deal Sentinel flags the loan-commitment deadline is in 48 hours with no lender confirmation on file — buyer's earnest money is exposed.",
          status: "esc",
          ms: 1300,
        },
        {
          agent: "coord",
          stage: "underContract",
          title: "Lender + buyer chased automatically",
          detail:
            "Drafted status-request messages to the lender and buyer, and surfaced the inspection and appraisal deadlines stacking behind it.",
          status: "ok",
          ms: 1200,
        },
        {
          agent: "knowledge",
          stage: "underContract",
          title: "Extension question — not legal advice",
          detail:
            "Buyer asks whether they can demand an extension; the assistant explains it's a contractual/legal question, declines to advise, and routes it to the agent and transaction attorney.",
          status: "ok",
          ms: 1200,
        },
        {
          agent: "scribe",
          stage: "offer",
          title: "Extension addendum staged — agent signs",
          detail:
            "A financing-contingency extension addendum is drafted and staged in DocuSign; the licensed agent reviews and signs before it goes to either party.",
          status: "gate",
          gateBy: "Megan Carter · Listing Agent",
          ms: 1300,
        },
        {
          agent: "intake",
          stage: "followup",
          title: "Both sides updated in writing",
          detail:
            "Once signed, sent the executed addendum and the new deadlines to buyer and co-op agent, with the full thread logged.",
          status: "ok",
          ms: 1000,
        },
      ],
    },
  ],
  gateNote: "Every commitment waits for a licensed agent. Rach.Dev drafts, stages and routes — a human approves.",
  completeToast: "Deal complete — every commitment was agent-approved",

  // ---------------- ROSTER (relay) ----------------
  rosterTitle: "Seven specialists, one conductor",
  rosterIntro:
    "Each agent owns one job and hands the next a complete, structured context. Atlas routes the work, enforces the human-in-the-loop gates, and writes every action to an audit log.",
  rosterClickNote: "Click Ava below — the full capture-to-contract workflow plays out automatically.",
  orchestratorName: "Atlas",
  orchestratorBlurb:
    "Atlas is the orchestrator. It routes each lead to the right specialist, carries shared deal context between them, pauses for a licensed agent to approve every commitment, and records a complete, timestamped audit trail.",
  relayTriggerAgentKey: "intake",
  relayCompleteToast: "Workflow complete — all agents processed Jordan Blake's lead",
  agents: [
    {
      key: "intake",
      name: "Ava",
      role: "Lead Capture · Front Door",
      icon: "intake",
      blurb:
        "The front door. Captures every inquiry across portal, web form, SMS and call, replies in seconds, and logs a clean lead to your CRM — 24/7, in English or Spanish.",
      tags: ["Multi-channel capture", "Instant first reply", "EN / ES"],
      pipeSub: "Capture",
      workMs: 2000,
      voice: {
        listeningTitle: "Listening…",
        listeningSub: "Capturing a property inquiry by voice",
        doneTitle: "Lead captured",
        doneSub: "6 fields captured · handing off to the team…",
        handoffToast: "Ava done — watch the team pick it up",
        fields: [
          { label: "Lead", value: "Jordan Blake · Buyer" },
          { label: "Interest", value: "412 Maple Ave · 3 bd / 2 ba" },
          { label: "Timeline", value: "Relocating, wants to buy in ~60 days" },
          { label: "Source", value: "Zillow inquiry — logged to Follow Up Boss", ok: true },
          { label: "Financing", value: "Pre-approved letter on file", ok: true },
          { label: "Channel", value: "SMS · English · 10:47 PM" },
        ],
      },
    },
    {
      key: "triage",
      name: "Marcus",
      role: "Lead Qualification",
      icon: "userSearch",
      blurb:
        "Lead qualification. Scores budget, financing, timeline and intent conversationally, routes buyer vs. seller vs. renter, and pages hot leads straight to the right agent.",
      tags: ["Budget & financing", "Intent scoring", "Smart routing"],
      pipeSub: "Qualify",
      workMs: 2100,
      flow: [
        {
          fromLabel: "Context from Ava",
          chips: ["Jordan Blake · Buyer", "412 Maple Ave", "Pre-approved"],
        },
        {
          steps: [
            { text: "Budget ~$525K confirmed against pre-approval letter", kind: "ok" },
            { text: "60-day timeline + relocation → scored hot buyer", kind: "ok" },
            { text: "Routed to the listing team; cold leads sent to nurture", kind: "ok" },
          ],
        },
      ],
    },
    {
      key: "scribe",
      name: "Nora",
      role: "Transaction & Docs",
      icon: "fileSignature",
      blurb:
        "Transaction prep. Drafts listing agreements, disclosures and offer packets, attaches required state disclosures, and stages everything in DocuSign — the agent signs, never the bot.",
      tags: ["Doc prep", "State disclosures", "DocuSign-staged"],
      pipeSub: "Docs",
      workMs: 2000,
      flow: [
        {
          fromLabel: "Context from Marcus",
          chips: ["Listing consult booked", "Seller disclosures needed", "DocuSign"],
        },
        {
          steps: [
            { text: "Listing agreement drafted from the consult notes", kind: "ok" },
            { text: "Required state seller disclosures attached", kind: "ok" },
            { text: "Packet staged in DocuSign — flagged for agent signature", kind: "ok" },
          ],
          note: "Draft only. Nothing is sent until a licensed agent reviews and signs.",
        },
      ],
    },
    {
      key: "coord",
      name: "Owen",
      role: "Showing Coordination",
      icon: "calendar",
      blurb:
        "Showing coordination. Finds a mutually open time across calendars, books and confirms it, sends reminders and reschedules, and gathers feedback after every showing.",
      tags: ["Calendar sync", "Confirm & remind", "Feedback capture"],
      pipeSub: "Coord",
      workMs: 1900,
      flow: [
        {
          fromLabel: "Context from Nora",
          chips: ["Buyer wants a tour", "Agent calendar synced", "Saturday AM"],
        },
        {
          steps: [
            { text: "Open slot found across buyer + agent calendars", kind: "ok" },
            { text: "Showing held — flagged for agent approval before promising", kind: "ok" },
            { text: "Confirmation, reminder and post-tour feedback scheduled", kind: "ok" },
          ],
        },
      ],
    },
    {
      key: "revenue",
      name: "Riley",
      role: "Market Analysis & CMA",
      icon: "trendingUp",
      blurb:
        "Market analysis. Builds client-ready CMAs from active and sold MLS comps, adds neighborhood and days-on-market context, and gives a pricing range — never a guaranteed value.",
      tags: ["CMA from comps", "Neighborhood context", "Pricing range"],
      pipeSub: "Analysis",
      workMs: 2000,
      flow: [
        {
          fromLabel: "Context from Owen",
          chips: ["3 active comps", "5 sold comps", "Avg 22 DOM"],
        },
        {
          steps: [
            { text: "CMA assembled from active + sold MLS comps", kind: "ok" },
            { text: "Neighborhood and days-on-market context layered in", kind: "ok" },
            { text: "Pricing range produced — a range, never a promise of value", kind: "ok" },
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
        "The role-aware knowledge assistant. Answers buyers, sellers and staff from your listings and approved sources only — every answer cited, never legal or lending advice.",
      tags: ["Role-aware", "Cited answers", "Never legal advice"],
      pipeSub: "Knowledge",
      workMs: 1900,
      flow: [
        {
          fromLabel: "Context from Riley",
          chips: ["Buyer view", "MLS + approved sources", "EN / ES"],
        },
        {
          steps: [
            { text: "Answered listing questions from live MLS data with sources", kind: "ok" },
            { text: "Held Fair-Housing-safe phrasing on every recommendation", kind: "ok" },
            { text: "Legal / lending question → handed to a licensed pro, not answered", kind: "esc" },
          ],
          note: "Iris informs. It never gives legal, tax or lending advice, and never steers.",
        },
      ],
    },
    {
      key: "monitor",
      name: "Hope",
      role: "Deal Sentinel",
      icon: "monitor",
      blurb:
        "The Deal Sentinel. Always on, watching every active deal's deadlines and signals — flagging a financing or inspection date about to lapse, a lead going cold, or a price/market shift before it costs the deal, and staging the response for the team.",
      tags: ["Always-on monitor", "Deadline & deal watch", "Advisory only"],
      pipeSub: "Sentinel",
      workMs: 2400,
      live: { label: "Live · Pipeline" },
      flow: [
        {
          fromLabel: "Context from the team",
          chips: ["12 active deals", "3 under contract", "Financing: watch"],
        },
        {
          fromLabel: "How Hope calibrates for this pipeline",
          steps: [
            { text: "Baselines each deal's key dates from the contract and MLS", kind: "ok" },
            { text: "Tightens lead times on financing, inspection and appraisal", kind: "ok" },
            { text: "Suppresses noise so only real deadline risk surfaces", kind: "ok" },
          ],
        },
        {
          fromLabel: "What Hope watches in real time",
          chips: ["Financing", "Inspection", "Appraisal", "Contingencies", "Lead activity", "Price / market"],
          steps: [
            { text: "Financing — loan-commitment deadline within 48h, no confirmation", kind: "esc" },
            { text: "Inspection — objection window about to close with no response", kind: "esc" },
            { text: "Appraisal — value came in under contract price", kind: "esc" },
            { text: "Contingency — earnest money at risk as a deadline lapses", kind: "esc" },
            { text: "Lead going cold — hot buyer with no touch in 5+ days", kind: "esc" },
            { text: "Market shift — comparable listing cut price near an active deal", kind: "esc" },
          ],
          note: "Hope is advisory. It alerts and stages — a licensed agent decides and acts. Every alert is logged with the signal that triggered it.",
        },
      ],
    },
  ],

  // ---------------- ARCHITECTURE ----------------
  archTitle: "One layer over the systems you already run",
  archIntro:
    "Rach.Dev sits on top of your MLS, CRM and existing tools — orchestrating agents, enforcing governance, and keeping a licensed agent in the loop. No rip-and-replace.",
  archLayers: [
    {
      n: "Layer 4",
      title: "Human-in-the-loop",
      icon: "decision",
      body: "Every commitment — showings, listing agreements, offers, addenda — pauses for a licensed agent to approve. Agents draft and stage; people decide.",
      pills: ["Approval gates", "Agent sign-off", "Role-based access"],
    },
    {
      n: "Layer 3",
      title: "Governance & audit",
      icon: "shield",
      body: "Fair Housing and RESPA guardrails, state licensing disclosure, consent tracking, and a complete, timestamped audit trail on every action and data touch.",
      pills: ["Fair Housing guardrails", "RESPA-aware", "Full audit log", "Source citations"],
    },
    {
      n: "Layer 2",
      title: "Agent orchestration",
      icon: "orchestrator",
      body: "Atlas routes each lead to the right specialist, carries shared deal context between agents, and coordinates hand-offs end to end.",
      pills: ["Routing & hand-off", "Shared context", "Escalation paths"],
    },
    {
      n: "Layer 1",
      title: "Integration",
      icon: "plug",
      body: "Bidirectional connectors to your MLS, CRM, e-sign and calendar over the standards and APIs your systems already speak.",
      pills: ["RESO / MLS data", "CRM sync", "Webhooks & APIs"],
    },
  ],
  archBaseLabel: "Works with the systems you already run",
  archBaseSystems: [
    "MLS (RESO)",
    "Follow Up Boss",
    "kvCORE",
    "DocuSign",
    "Google Calendar",
    "Zillow leads",
    "Realtor.com leads",
    "Twilio",
  ],

  // ---------------- KNOWLEDGE ----------------
  knowledgeTitle: "A knowledge layer that knows its limits",
  knowledgeIntro:
    "Iris answers buyers, sellers and staff from your listings and approved sources only. Every answer is cited — and a legal, tax or lending question is always handed to a licensed professional, never advised.",
  knowledgeAgentName: "Iris",
  knowledgeViewLabel: "Buyer view",
  knowledgeGreeting:
    "Hi, I'm Iris. Ask me about a listing, a showing or next steps in your search — I'll always cite my source.",
  knowledgeDisclaimer:
    "Iris provides information only — never legal, tax or lending advice, and never steering. Anything regulated is routed to a licensed professional.",
  knowledge: [
    {
      q: "How big is 412 Maple Ave and what schools is it zoned for?",
      a: "412 Maple Ave is listed at 1,840 sq ft on a 0.21-acre lot, 3 bed / 2 bath, built in 2008. It's zoned for the local elementary, middle and high schools per the current MLS listing — I'd confirm exact attendance boundaries with the district before you rely on it. Want me to pull recent comparable sales nearby?",
      src: ["MLS listing", "School-district data"],
    },
    {
      q: "¿Cuándo puedo ver la casa este fin de semana?",
      a: "Tenemos disponibilidad el sábado a las 10:30 AM o el domingo a la 1:00 PM para 412 Maple Ave. Puedo reservar el horario que prefiera, y su agente lo confirma antes de que sea definitivo. ¿Cuál le conviene más?",
      src: ["Agent calendar", "Showing availability"],
    },
    {
      q: "Can you tell me whether I'll lose my earnest money if I back out now?",
      a: "That's a contractual and legal question, so I won't advise on it myself. I've flagged your contract dates and routed your question to your agent and the transaction attorney, who can review your specific terms with you. I can pull up your key deadlines in the meantime if that helps.",
      src: ["Contract record", "Agent + attorney routing"],
    },
  ],

  // ---------------- GOVERNANCE ----------------
  governanceTitle: "Governance, not just guardrails",
  governanceIntro:
    "The controls that let a brokerage actually deploy agents — enforced in the system, not promised on a slide.",
  guarantees: [
    {
      title: "Agent in the loop",
      desc: "Every commitment — a held showing, a listing agreement, an offer or an addendum — waits for a licensed agent to approve. No agent makes a binding move on its own.",
    },
    {
      title: "Complete audit trail",
      desc: "Every action, hand-off and data access is logged with a timestamp, the agent, the source and the approver — exportable on demand.",
    },
    {
      title: "Fair Housing & RESPA by design",
      desc: "Recommendations are held to Fair-Housing-safe phrasing with no steering, RESPA guardrails block referral kickbacks, and state licensing disclosure is configured per deployment.",
    },
    {
      title: "Grounded with sources",
      desc: "Answers come only from your MLS and approved knowledge sources and cite them. No open-web guessing, no invented listing facts or values.",
    },
    {
      title: "No vendor lock-in",
      desc: "Standards-based connectors (RESO / MLS, CRM APIs) and your data stays yours. Turn an agent off and your systems keep running.",
    },
  ],
  auditTitle: "Live audit log",
  auditIntro: "A sample of what every action looks like on the record.",
  auditLines: [
    { ts: "22:47:09", text: "Inbound SMS (Zillow lead) received & answered — lead #7731", tag: "ok", tagLabel: "Logged" },
    { ts: "22:47:51", text: "Lead qualified — pre-approved buyer, 60-day timeline", tag: "ok", tagLabel: "Qualified" },
    { ts: "22:48:14", text: "Recommendation phrasing checked — Fair Housing pass", tag: "mod", tagLabel: "Reviewed" },
    { ts: "09:02:33", text: "Showing held 10:30 AM Sat — awaiting agent approval", tag: "mod", tagLabel: "Pending" },
    { ts: "09:05:47", text: "Showing approved by Megan Carter, Listing Agent", tag: "ok", tagLabel: "Approved" },
    { ts: "08:14:02", text: "Financing contingency at risk (48h) — agent alerted", tag: "esc", tagLabel: "Escalated" },
  ],

  // ---------------- OUTCOMES ----------------
  outcomesTitle: "What changes when agents own the busywork",
  outcomesIntro: "Directional outcomes our pilots target — validated on your own data, never assumed.",
  outcomes: [
    {
      value: "24/7",
      label: "Coverage, every channel",
      desc: "Portal, web, SMS and call answered around the clock, in English and Spanish — no after-hours lead lost to voicemail.",
    },
    {
      value: "Seconds",
      label: "To first response",
      desc: "Every new inquiry gets an instant, qualified first reply — before a competing agent ever sees it.",
    },
    {
      value: "Zero",
      label: "Missed deadlines",
      desc: "Financing, inspection and appraisal dates watched continuously so contingencies never lapse by surprise.",
    },
    {
      value: "Hours back",
      label: "For your agents",
      desc: "Less chasing, scheduling and paperwork — more time on showings, negotiation and clients.",
    },
  ],
  benchmarks: [
    {
      text: "Roughly 88% of home buyers purchase through a real estate agent or broker, which stays the most trusted and most-used source through the search.",
      cite: "NAR, 2025 Profile of Home Buyers and Sellers",
    },
    {
      text: "Responding to a web lead within five minutes makes you about 21x more likely to qualify it — and roughly 100x more likely to even make contact — than waiting 30 minutes.",
      cite: "Oldroyd (MIT) & InsideSales, Lead Response Management Study",
    },
    {
      text: "In a test of 74 top brokerages, only about 9% replied within the critical 5-minute window and roughly 41% never responded to the inquiry at all.",
      cite: "Roof.ai brokerage lead-response test",
    },
  ],
  outcomesNote:
    "Figures above are external benchmarks and pilot targets, not guarantees — we validate every number on your own data before you rely on it. Monitoring agents are advisory: they alert and stage, a licensed agent acts.",

  // ---------------- CTA ----------------
  ctaTitle: "Start with one workflow. Prove it. Then scale.",
  ctaIntro:
    "We stand up a single workflow on your existing MLS and CRM, show the audit trail and the outcomes, and expand only once your team trusts it.",
  ctaSteps: [
    {
      n: "01",
      title: "Scope one workflow",
      desc: "Pick the highest-pain workflow — instant lead response, showing coordination or deal-deadline monitoring — and we map it to your systems.",
    },
    {
      n: "02",
      title: "Pilot in your environment",
      desc: "Agents run on your MLS, Follow Up Boss / kvCORE and calendar with an agent in the loop and a full audit trail, in weeks not quarters.",
    },
    {
      n: "03",
      title: "Measure, then expand",
      desc: "Review the outcomes on your own data, then roll the agent team out across teams and offices.",
    },
  ],

  // ---------------- FAQ (drives FAQPage JSON-LD) ----------------
  faq: [
    {
      q: "Does Rach.Dev replace our MLS or CRM?",
      a: "No. Rach.Dev is an operations layer that runs on top of your existing MLS and CRM (Follow Up Boss, kvCORE and others) over RESO and standard APIs. Your systems of record stay exactly where they are.",
    },
    {
      q: "How does Rach.Dev stay Fair Housing compliant?",
      a: "Recommendations are held to Fair-Housing-safe phrasing with no steering by protected class, and answers are grounded only in MLS and approved sources. RESPA guardrails block referral kickbacks, and state licensing disclosure is configured per deployment.",
    },
    {
      q: "Do the AI agents make commitments on their own?",
      a: "No. Every commitment — a held showing, a listing agreement, an offer or an addendum — pauses for a licensed agent to approve. The agents draft, stage and route; a human decides. Monitoring agents are advisory only.",
    },
    {
      q: "Do the agents work in languages other than English?",
      a: "Yes. Lead capture, qualification, reminders and client answers support English and Spanish out of the box, across portal leads, SMS and calls.",
    },
    {
      q: "How fast does Rach.Dev respond to new leads?",
      a: "Inbound inquiries from your portals, web forms and SMS get an instant first reply, day or night — typically within seconds — and are logged to your CRM with the source before a competing agent sees them.",
    },
  ],
};
