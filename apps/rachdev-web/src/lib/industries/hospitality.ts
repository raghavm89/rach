import type { IndustryConfig } from "./types";

/**
 * Hospitality (US hotels, resorts & restaurants) industry config.
 *
 * Content is authored for a US property / management-company buyer — PCI DSS for
 * payments, ADA accessibility, English + Spanish guests — and renders entirely in
 * the Rach.Dev design system. Interactions (Control Tower + relay + knowledge) are
 * fully scripted; no live model is called. Agents sit on top of the PMS
 * (Opera / Mews / Cloudbeds), the booking engine, OpenTable and Twilio.
 */
export const hospitalityConfig: IndustryConfig = {
  slug: "hospitality",
  vertical: "Hospitality",
  industrySlug: "hospitality",
  industryName: "Hospitality",
  icon: "hotel",
  tagline:
    "An agent team for reservations, concierge, guest messaging, group bookings and service recovery — on your existing PMS, with a manager in the loop.",
  seoTitle: "Hospitality AI Agents for Hotels, Resorts & Restaurants",
  seoDescription:
    "Rach.Dev is an AI operations layer for hotels, resorts and restaurants — agents for reservations, concierge, guest messaging, group and event bookings, revenue and proactive service recovery, on top of your existing PMS and booking engine, with a manager in the loop on every comp, rate and refund.",
  seoKeywords: [
    "hospitality AI agents",
    "hotel reservation automation",
    "AI concierge",
    "guest messaging automation",
    "service recovery AI",
    "PCI DSS AI agents",
    "PMS automation",
    "hotel revenue management AI",
  ],

  // ---------------- HERO ----------------
  eyebrow: "Hospitality · Agentic Operations Layer",
  h1Lines: ["The AI operations layer", "for your property."],
  rotorLead: "Put a team of agents on your",
  rotorWords: ["reservations.", "concierge.", "guest messaging.", "group bookings.", "review watch."],
  subhead:
    "Rach.Dev runs reservations, concierge, guest messaging, group and event bookings, rate and revenue checks, and proactive service recovery across the systems you already use — with a manager in the loop on every comp, rate override and refund, and a full audit trail on every action.",
  trustRow: [
    "PCI DSS-aligned by design",
    "Works with your existing PMS",
    "Manager-in-the-loop",
    "English & Spanish",
  ],
  heroPrimaryCta: { label: "Book a pilot", href: "/contact" },
  heroSecondaryCta: { label: "See the architecture", href: "#architecture" },

  // ---------------- OPERATING PICTURE ----------------
  operateEyebrow: "The operating picture",
  operateTitle: "What an agent team takes off your front desk",
  operateIntro:
    "Most of a property's load isn't hospitality judgement — it's answering the same questions, chasing bookings and catching problems before they hit a review site. Here's where agents own the busywork, mapped to how your property actually runs.",
  domains: [
    {
      icon: "door",
      title: "The Front Door",
      blurb: "Every inquiry captured, qualified and answered — 24/7, in English or Spanish.",
      bullets: [
        "Multi-channel intake (web chat, WhatsApp, SMS, phone)",
        "Live availability & rate checks against the PMS",
        "Guest profile match & preference recall",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "calendar",
      title: "Reservations & Booking",
      blurb: "Quote, hold and book rooms across channels without a missed inquiry.",
      bullets: [
        "Room search, rate comparison & modifications",
        "Holds and bookings synced to the PMS",
        "Payment via your PCI-compliant booking engine",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "heartHandshake",
      title: "Concierge & Experience",
      blurb: "The personalized touches that turn a 4-star stay into a 5-star review.",
      bullets: [
        "Local recommendations & activity bookings",
        "Dining reservations via OpenTable",
        "Transport, spa and upgrade requests",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "shieldAlert",
      title: "Payments & Accessibility",
      blurb: "Hard guardrails on the two things you can't get wrong: cards and access.",
      bullets: [
        "PCI DSS — never stores or sees raw card numbers",
        "Proactively captures ADA accessibility needs",
        "Room assignment matched to stated requirements",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "message",
      title: "In-Stay Guest Messaging",
      blurb: "Answer the in-room questions and requests that flood the front desk.",
      bullets: [
        "WiFi, checkout, amenities & late-checkout requests",
        "Housekeeping & maintenance tickets routed live",
        "Reminders and confirmations (EN / ES)",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "revenue",
      title: "Revenue & Rate",
      blurb: "The fastest ROI for an owner: fill the room at the right rate.",
      bullets: [
        "Rate quoting within manager-set guardrails",
        "Upsells, upgrades & length-of-stay offers",
        "Rate-override and comp requests staged for sign-off",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "briefcase",
      title: "Group & Events",
      blurb: "Turn a one-line wedding or conference inquiry into a qualified lead.",
      bullets: [
        "Qualifies group, wedding & meeting inquiries",
        "Gathers dates, headcount, F&B and AV needs",
        "Hands a complete brief to your sales team",
      ],
      tag: { label: "In your build", tone: "muted" },
    },
    {
      icon: "knowledge",
      title: "Knowledge Layer",
      blurb: "A role-aware assistant grounded only in your approved property info.",
      bullets: [
        "Separate views for guest, front desk, manager",
        "Every answer cites its source",
        "Hard guardrails — never legal or medical advice",
      ],
      tag: { label: "In demo", tone: "live" },
    },
  ],

  // ---------------- CONTROL TOWER ----------------
  towerTitle: "Watch the team run a stay",
  towerIntro:
    "Pick a guest and press play. Watch the agent team run it end to end — a manager approves every comp, rate override and refund.",
  subjectNoun: "guest",
  stages: [
    { key: "inquiry", label: "Inquiry", icon: "door" },
    { key: "booking", label: "Booking", icon: "calendar" },
    { key: "prearrival", label: "Pre-Arrival", icon: "clipboardCheck" },
    { key: "checkin", label: "Check-In", icon: "key" },
    { key: "instay", label: "In-Stay", icon: "bed" },
    { key: "recovery", label: "Recovery", icon: "lifeBuoy" },
    { key: "poststay", label: "Post-Stay", icon: "star" },
  ],
  scenarios: [
    {
      key: "booking",
      tabLabel: "Web-chat booking",
      tabIcon: "message",
      subjectName: "Jordan Walsh · 2 nights · King Suite",
      subjectDesc: "Booking inquiry with an accessibility need",
      channel: "Web chat · Booking engine",
      channelIcon: "message",
      steps: [
        {
          agent: "intake",
          stage: "inquiry",
          title: "Inquiry captured & guest matched",
          detail:
            "Inbound web chat understood in seconds; returning guest matched to profile, dates and party size confirmed.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "booking",
          title: "Accessibility need flagged & honored",
          detail:
            "Guest requests a roll-in shower; ADA-accessible King Suite filtered as the only valid option and held.",
          status: "ok",
          ms: 1200,
        },
        {
          agent: "scribe",
          stage: "booking",
          title: "Quote built from live rates",
          detail:
            "2-night quote assembled against the PMS — accessible suite rate, taxes and resort fee itemized for the guest.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "revenue",
          stage: "booking",
          title: "Upgrade offer — manager confirms comp",
          detail:
            "A loyalty late-checkout comp is drafted as a goodwill gesture; the duty manager approves before it's promised.",
          status: "gate",
          gateBy: "Lauren Foster · Duty Manager",
          ms: 1300,
        },
        {
          agent: "coord",
          stage: "prearrival",
          title: "Booked, paid & synced",
          detail:
            "Payment taken via the PCI-compliant booking engine (no card data touches Rach.Dev); reservation written to the PMS.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "knowledge",
          stage: "prearrival",
          title: "Pre-arrival questions answered, with sources",
          detail:
            "Parking, check-in time and the accessible-route map answered from approved property info, each with a citation.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "intake",
          stage: "poststay",
          title: "Confirmation + pre-arrival sequence set",
          detail:
            "Confirmation sent, accessible-room note attached to the folio, and a pre-arrival message scheduled the day before.",
          status: "ok",
          ms: 1000,
        },
      ],
    },
    {
      key: "afterhours",
      tabLabel: "After-hours WhatsApp",
      tabIcon: "message",
      subjectName: "María Reyes · in-house · Room 412",
      subjectDesc: "Late-night request, in Spanish",
      channel: "WhatsApp · After hours",
      channelIcon: "message",
      steps: [
        {
          agent: "intake",
          stage: "instay",
          title: "Spanish message understood & answered",
          detail:
            "Inbound WhatsApp in Spanish recognized at 11:50 PM; in-house guest matched to Room 412 and replied to in her own language.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "instay",
          title: "Request triaged — extra towels + late checkout",
          detail:
            "Two asks separated: towels to housekeeping now, late checkout checked against tomorrow's arrivals.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "knowledge",
          stage: "instay",
          title: "Grounded answer, in Spanish",
          detail:
            "Answered her pool-hours and breakfast question from approved property info, with sources — in Spanish.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "coord",
          stage: "instay",
          title: "Housekeeping ticket routed live",
          detail:
            "Towel request opened as a ticket to the on-shift houseman with the room and time stamped.",
          status: "ok",
          ms: 1000,
        },
        {
          agent: "revenue",
          stage: "instay",
          title: "Late checkout — night manager confirms",
          detail:
            "1 PM checkout is available and held; the night manager approves before it's promised to the guest.",
          status: "gate",
          gateBy: "Devon Pierce · Night Manager",
          ms: 1200,
        },
        {
          agent: "intake",
          stage: "poststay",
          title: "Confirmed in Spanish",
          detail:
            "Sent the towel ETA and confirmed 1 PM checkout in Spanish, and noted both on the folio.",
          status: "ok",
          ms: 1000,
        },
      ],
    },
    {
      key: "recovery",
      tabLabel: "Service recovery",
      tabIcon: "lifeBuoy",
      subjectName: "Greg Hoffman · in-house · Room 707",
      subjectDesc: "Negative sentiment caught mid-stay",
      channel: "In-stay survey · Monitor",
      channelIcon: "monitor",
      steps: [
        {
          agent: "monitor",
          stage: "instay",
          title: "Negative sentiment detected mid-stay",
          detail:
            "Service-Recovery Sentinel reads a 2/5 in-stay pulse: noisy room, slow room service. VIP loyalty tier flagged.",
          status: "esc",
          ms: 1300,
        },
        {
          agent: "triage",
          stage: "recovery",
          title: "At-risk guest scored & routed",
          detail:
            "High churn + public-review risk; routed to the duty manager as a service-recovery case before checkout.",
          status: "esc",
          ms: 1200,
        },
        {
          agent: "knowledge",
          stage: "recovery",
          title: "Recovery options surfaced",
          detail:
            "Approved goodwill options (room move, dining credit, points) pulled with the property's recovery policy cited.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "revenue",
          stage: "recovery",
          title: "Goodwill credit — manager approves",
          detail:
            "A $75 dining credit and a quieter room are drafted; the duty manager reviews and approves the comp before anything is offered.",
          status: "gate",
          gateBy: "Lauren Foster · Duty Manager",
          ms: 1300,
        },
        {
          agent: "coord",
          stage: "recovery",
          title: "Room move + credit executed",
          detail:
            "Quieter room assigned in the PMS after sign-off, dining credit applied to the folio, and housekeeping notified.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "intake",
          stage: "poststay",
          title: "Made right before checkout",
          detail:
            "Guest messaged the move and credit with an apology; recovered in-house before any public review was posted.",
          status: "ok",
          ms: 1100,
        },
      ],
    },
  ],
  gateNote: "Every comp, rate override and refund waits for a manager. Rach.Dev drafts, stages and routes — a human approves.",
  completeToast: "Stay complete — every comp and override was manager-approved",

  // ---------------- ROSTER (relay) ----------------
  rosterTitle: "Seven specialists, one conductor",
  rosterIntro:
    "Each agent owns one job and hands the next a complete, structured context. Atlas routes the work, enforces the manager-in-the-loop gates, and writes every action to an audit log.",
  rosterClickNote: "Click Maya below — the full inquiry-to-confirmation workflow plays out automatically.",
  orchestratorName: "Atlas",
  orchestratorBlurb:
    "Atlas is the orchestrator. It routes each guest to the right specialist, carries shared guest context between them, pauses for manager approval on every comp, rate override and refund, and records a complete, timestamped audit trail.",
  relayTriggerAgentKey: "intake",
  relayCompleteToast: "Workflow complete — all agents processed Jordan Walsh's booking",
  agents: [
    {
      key: "intake",
      name: "Maya",
      role: "Reservations · Front Door",
      icon: "intake",
      blurb:
        "The front door. Captures every inquiry across web chat, WhatsApp, SMS and phone, matches the guest to their profile, and opens a clean booking — 24/7, in English or Spanish.",
      tags: ["Multi-channel intake", "Guest profile match", "EN / ES"],
      pipeSub: "Reservations",
      workMs: 2000,
      voice: {
        listeningTitle: "Listening…",
        listeningSub: "Capturing the booking inquiry by voice",
        doneTitle: "Inquiry complete",
        doneSub: "6 fields captured · handing off to the team…",
        handoffToast: "Maya done — watch the team pick it up",
        fields: [
          { label: "Guest", value: "Jordan Walsh, returning guest" },
          { label: "Request", value: "2 nights, King Suite" },
          { label: "Dates", value: "Aug 14–16, 2 adults" },
          { label: "Accessibility", value: "Roll-in shower required", ok: true },
          { label: "Profile", value: "Matched to loyalty profile", ok: true },
          { label: "Channel", value: "Web chat · English" },
        ],
      },
    },
    {
      key: "triage",
      name: "Caleb",
      role: "Eligibility & Accessibility",
      icon: "triage",
      blurb:
        "Eligibility & accessibility. Screens availability, honors ADA accessibility needs, and watches for the risks that need a human — never quoting a room that doesn't fit the guest's stated requirements.",
      tags: ["Availability screen", "ADA accessibility", "Risk routing"],
      pipeSub: "Eligibility",
      workMs: 2100,
      flow: [
        {
          fromLabel: "Context from Maya",
          chips: ["Jordan Walsh", "2 nights, King Suite", "Roll-in shower required"],
        },
        {
          steps: [
            { text: "Availability confirmed for the requested dates", kind: "ok" },
            { text: "ADA accessibility need honored — only roll-in-shower rooms offered", kind: "ok" },
            { text: "Escalation path armed if no accessible room is available", kind: "ok" },
          ],
        },
      ],
    },
    {
      key: "scribe",
      name: "Olivia",
      role: "Quote & Booking Builder",
      icon: "scribe",
      blurb:
        "Quote & booking builder. Assembles the quote from live PMS rates, itemizes taxes and fees, and drafts the booking — leaving the manager to approve any override, not retype the folio.",
      tags: ["Live rate quoting", "Itemized folio", "Booking draft"],
      pipeSub: "Quote",
      workMs: 2000,
      flow: [
        {
          fromLabel: "Context from Caleb",
          chips: ["Accessible King Suite", "Aug 14–16", "Rate: $289/night"],
        },
        {
          steps: [
            { text: "Quote built from live PMS rates for the requested dates", kind: "ok" },
            { text: "Taxes, resort fee and total itemized for the guest", kind: "ok" },
            { text: "Booking drafted — any comp or override flagged for sign-off", kind: "ok" },
          ],
          note: "Draft only. A comp, override or refund is applied solely after a manager approves.",
        },
      ],
    },
    {
      key: "coord",
      name: "Owen",
      role: "Guest Coordination",
      icon: "coord",
      blurb:
        "Guest coordination. Syncs bookings to the PMS, routes housekeeping and maintenance tickets, books dining via OpenTable, and keeps guests on track with confirmations and reminders.",
      tags: ["PMS sync", "Tickets & dining", "Reminders"],
      pipeSub: "Coord",
      workMs: 1900,
      flow: [
        {
          fromLabel: "Context from Olivia",
          chips: ["Reservation → PMS", "Housekeeping ticket", "Dining via OpenTable"],
        },
        {
          steps: [
            { text: "Booking written to the PMS and confirmation queued", kind: "ok" },
            { text: "Housekeeping / maintenance tickets routed to the on-shift team", kind: "ok" },
            { text: "Dining reservation booked via OpenTable; reminders scheduled", kind: "ok" },
          ],
        },
      ],
    },
    {
      key: "revenue",
      name: "Riley",
      role: "Revenue & Rate",
      icon: "revenue",
      blurb:
        "Revenue & rate. Quotes within manager-set guardrails, surfaces upsells and length-of-stay offers, and stages every comp, rate override and goodwill credit for sign-off before it's promised.",
      tags: ["Rate guardrails", "Upsells & upgrades", "Comp & override gate"],
      pipeSub: "Revenue",
      workMs: 2000,
      flow: [
        {
          fromLabel: "Context from Owen",
          chips: ["Loyalty tier: Gold", "Upgrade eligible", "Late-checkout comp"],
        },
        {
          steps: [
            { text: "Upsell + late-checkout comp drafted within rate guardrails", kind: "ok" },
            { text: "Comp value checked against the property's goodwill policy", kind: "ok" },
            { text: "Comp staged for manager sign-off — not promised until approved", kind: "esc" },
          ],
          note: "Riley drafts and stages. A manager approves every comp, override and refund.",
        },
      ],
    },
    {
      key: "knowledge",
      name: "Iris",
      role: "Concierge & Knowledge",
      icon: "knowledge",
      blurb:
        "The role-aware concierge and knowledge assistant. Answers guests, front desk and managers from your approved property info only — every answer cited, and never legal or medical advice.",
      tags: ["Role-aware", "Cited answers", "Knows its limits"],
      pipeSub: "Concierge",
      workMs: 1900,
      flow: [
        {
          fromLabel: "Context from Riley",
          chips: ["Guest view", "Approved property info", "EN / ES"],
        },
        {
          steps: [
            { text: "Answered guest questions from approved property info", kind: "ok" },
            { text: "Every answer carried its source citation", kind: "ok" },
            { text: "Legal / medical question → handed to a person, not answered", kind: "esc" },
          ],
          note: "Iris informs. It never gives legal or medical advice, and never overrides a manager.",
        },
      ],
    },
    {
      key: "monitor",
      name: "Hope",
      role: "Service-Recovery Sentinel",
      icon: "monitor",
      blurb:
        "The Service-Recovery Sentinel. Always on, reading the live signal stream across in-stay surveys, messages and ratings — catching negative sentiment before it hits a public review, flagging VIP and at-risk guests, and staging the recovery for the team.",
      tags: ["Always-on monitor", "Sentiment early-warning", "Advisory only"],
      pipeSub: "Recovery",
      workMs: 2400,
      live: { label: "Live · Recovery" },
      flow: [
        {
          fromLabel: "Context from the guest stream",
          chips: ["In-stay pulse: 2/5", "VIP loyalty tier", "Public-review risk: elevated"],
        },
        {
          fromLabel: "How Hope calibrates for this property",
          steps: [
            { text: "Baselines sentiment by room type, channel and loyalty tier", kind: "ok" },
            { text: "Tightens thresholds for VIP and repeat guests", kind: "ok" },
            { text: "Suppresses noise so the team only sees real recovery cases", kind: "ok" },
          ],
        },
        {
          fromLabel: "What Hope watches in real time",
          chips: ["In-stay surveys", "Guest messages", "Review drafts", "Ratings", "Loyalty tier", "Repeat complaints"],
          steps: [
            { text: "Negative pulse — a low in-stay survey from a current guest", kind: "esc" },
            { text: "Frustration in chat — sentiment trending sharply down", kind: "esc" },
            { text: "VIP at risk — a high-value guest flags a problem", kind: "esc" },
            { text: "Repeat issue — the same complaint twice in one stay", kind: "esc" },
            { text: "Public-review risk — language signalling an imminent post", kind: "esc" },
            { text: "Silent churn — a usually-engaged guest goes quiet", kind: "esc" },
          ],
          note: "Hope is advisory. It alerts and stages — a manager decides and acts. Every alert is logged with the signal that triggered it.",
        },
      ],
    },
  ],

  // ---------------- ARCHITECTURE ----------------
  archTitle: "One layer over the systems you already run",
  archIntro:
    "Rach.Dev sits on top of your PMS and existing tools — orchestrating agents, enforcing governance, and keeping a manager in the loop. No rip-and-replace.",
  archLayers: [
    {
      n: "Layer 4",
      title: "Human-in-the-loop",
      icon: "decision",
      body: "Every comp, rate override and refund pauses for a manager to approve. Agents draft and stage; people decide.",
      pills: ["Approval gates", "Manager sign-off", "Role-based access"],
    },
    {
      n: "Layer 3",
      title: "Governance & audit",
      icon: "shield",
      body: "PCI DSS-aligned payment handling, ADA accessibility checks, and a complete, timestamped audit trail on every action and data touch.",
      pills: ["PCI DSS-aligned", "ADA accessibility", "Full audit log", "Source citations"],
    },
    {
      n: "Layer 2",
      title: "Agent orchestration",
      icon: "orchestrator",
      body: "Atlas routes each guest to the right specialist, carries shared context between agents, and coordinates hand-offs end to end.",
      pills: ["Routing & hand-off", "Shared context", "Escalation paths"],
    },
    {
      n: "Layer 1",
      title: "Integration",
      icon: "plug",
      body: "Bidirectional connectors to your PMS, booking engine, telephony and dining over the channels your systems already speak.",
      pills: ["PMS APIs", "Booking engine", "Webhooks & APIs"],
    },
  ],
  archBaseLabel: "Works with the systems you already run",
  archBaseSystems: [
    "Oracle OPERA",
    "Mews",
    "Cloudbeds",
    "OpenTable",
    "SynXis (Sabre)",
    "SiteMinder",
    "Twilio",
    "WhatsApp Business",
    "Stripe",
    "Salesforce",
  ],

  // ---------------- KNOWLEDGE ----------------
  knowledgeTitle: "A concierge that knows its limits",
  knowledgeIntro:
    "Iris answers guests, front desk and managers from your approved property info only. Every answer is cited — and a legal or medical question is always handed to a person, never answered by the agent.",
  knowledgeAgentName: "Iris",
  knowledgeViewLabel: "Guest view",
  knowledgeGreeting:
    "Hi, I'm Iris, your concierge. Ask me about your booking, the property or things to do nearby — I'll always cite my source.",
  knowledgeDisclaimer:
    "Iris provides information only — never legal, medical or financial advice. Anything outside approved property info is routed to a person.",
  knowledge: [
    {
      q: "What time is check-in, and can I get in earlier?",
      a: "Standard check-in is 3:00 PM and checkout is 11:00 AM. Early check-in is subject to availability on the day — I can request it and a front-desk manager will confirm once your room is ready. Want me to add an early check-in request to your reservation?",
      src: ["Property policy", "PMS · arrivals"],
    },
    {
      q: "¿El hotel tiene habitaciones accesibles y traslado al aeropuerto?",
      a: "Sí. Contamos con habitaciones accesibles (ADA) con ducha de acceso rodado, que puedo reservar según su necesidad. El traslado al aeropuerto sale cada hora de 6:00 AM a 10:00 PM por $20 por persona; con gusto le reservo un horario. ¿Para qué hora lo necesita?",
      src: ["Property info · accessibility", "Transport schedule"],
    },
    {
      q: "I slipped in the lobby — am I entitled to compensation, and what are my legal options?",
      a: "I'm so sorry that happened, and I want to make sure you're okay first. I can't give legal advice or speak to liability or compensation — that's a question for a person. I've logged the incident and flagged your message to our duty manager and risk team, who will reach out right away. If you're hurt, please tell us or call 911.",
      src: ["Incident log", "Manager routing"],
    },
  ],

  // ---------------- GOVERNANCE ----------------
  governanceTitle: "Governance, not just guardrails",
  governanceIntro:
    "The controls that let a property actually deploy agents — enforced in the system, not promised on a slide.",
  guarantees: [
    {
      title: "Manager in the loop",
      desc: "Every comp, rate override and refund waits for a manager to approve. No agent gives away money or changes a rate on its own.",
    },
    {
      title: "Complete audit trail",
      desc: "Every action, hand-off and data access is logged with a timestamp, the agent, the source and the approver — exportable on demand.",
    },
    {
      title: "PCI DSS-aligned by design",
      desc: "Payments run through your PCI-compliant booking engine; Rach.Dev never stores or sees raw card numbers. ADA accessibility needs are captured and honored.",
    },
    {
      title: "Grounded with sources",
      desc: "Answers come only from your approved property info and cite it. No open-web guessing, no ungrounded claims, no invented amenities.",
    },
    {
      title: "No vendor lock-in",
      desc: "Standards-based connectors to your PMS and booking engine, and your data stays yours. Turn an agent off and your property keeps running.",
    },
  ],
  auditTitle: "Live audit log",
  auditIntro: "A sample of what every action looks like on the record.",
  auditLines: [
    { ts: "23:51:04", text: "Inbound WhatsApp (es) received & answered — Room 412", tag: "ok", tagLabel: "Logged" },
    { ts: "14:22:10", text: "Live availability checked — accessible King Suite held", tag: "ok", tagLabel: "Verified" },
    { ts: "14:22:48", text: "Payment via PCI booking engine — no card data stored", tag: "mod", tagLabel: "PCI" },
    { ts: "14:23:33", text: "Late-checkout comp drafted, awaiting sign-off", tag: "mod", tagLabel: "Pending" },
    { ts: "14:24:09", text: "Comp approved by Lauren Foster, Duty Manager", tag: "ok", tagLabel: "Approved" },
    { ts: "19:07:55", text: "Negative in-stay sentiment (2/5) — duty manager flagged", tag: "esc", tagLabel: "Escalated" },
  ],

  // ---------------- OUTCOMES ----------------
  outcomesTitle: "What changes when agents own the busywork",
  outcomesIntro: "Directional outcomes our pilots target — validated on your own data, never assumed.",
  outcomes: [
    {
      value: "24/7",
      label: "Coverage, every channel",
      desc: "Web chat, WhatsApp, SMS and phone answered around the clock, in English and Spanish — no inquiry lost to peak hours.",
    },
    {
      value: "Seconds",
      label: "To a quote & hold",
      desc: "Availability, rates and accessible-room options surfaced and held before the guest can click away.",
    },
    {
      value: "In-house",
      label: "Problems caught early",
      desc: "Negative sentiment surfaced mid-stay and recovered before it becomes a public review.",
    },
    {
      value: "Hours back",
      label: "For the front desk",
      desc: "Fewer repeat questions and manual bookings, more time for the in-person hospitality that earns the 5-star review.",
    },
  ],
  benchmarks: [
    {
      text: "Roughly two-thirds of surveyed US hotels still report staffing shortages, and about 71% say they have job openings they can't fill despite active recruiting — making automation of routine guest interactions a practical lever.",
      cite: "AHLA Front Desk Feedback survey (282 hoteliers), 2024–2025",
    },
    {
      text: "About 72% of travelers say they always or frequently read reviews before deciding where to stay or eat, and over half say they'd never book a hotel with no reviews — so catching problems before they're posted matters.",
      cite: "Tripadvisor / Ipsos MORI online-reviews research",
    },
    {
      text: "Acquiring a new customer can cost up to roughly 5–25 times more than retaining an existing one, which is why recovering an unhappy guest in-house tends to beat winning a replacement.",
      cite: "Harvard Business Review, 'The Value of Keeping the Right Customers' (Reichheld)",
    },
  ],
  outcomesNote:
    "Figures above are external benchmarks and pilot targets, not guarantees — we validate every number on your own data before you rely on it. Monitoring agents are advisory: they alert and stage, a manager acts.",

  // ---------------- CTA ----------------
  ctaTitle: "Start with one channel. Prove it. Then scale.",
  ctaIntro:
    "We stand up a single workflow on your existing PMS, show the audit trail and the outcomes, and expand only once your team trusts it.",
  ctaSteps: [
    {
      n: "01",
      title: "Scope one workflow",
      desc: "Pick the highest-pain workflow — reservations, in-stay messaging or service recovery — and we map it to your systems.",
    },
    {
      n: "02",
      title: "Pilot in your environment",
      desc: "Agents run on your PMS and booking engine with a manager in the loop and a full audit trail, in weeks not quarters.",
    },
    {
      n: "03",
      title: "Measure, then expand",
      desc: "Review the outcomes on your own data, then roll the agent team out channel by channel and property by property.",
    },
  ],

  // ---------------- FAQ (drives FAQPage JSON-LD) ----------------
  faq: [
    {
      q: "Does Rach.Dev replace our PMS?",
      a: "No. Rach.Dev is an operations layer that runs on top of your existing PMS (Oracle OPERA, Mews, Cloudbeds and others) and booking engine. Your system of record stays exactly where it is.",
    },
    {
      q: "How does Rach.Dev handle payments and PCI compliance?",
      a: "Payments run through your existing PCI-compliant booking engine. Rach.Dev never stores or sees raw card numbers — it hands the guest off to the secure payment flow and records only the confirmation. Compliance is validated per deployment.",
    },
    {
      q: "Do the AI agents give away comps or change rates on their own?",
      a: "No. Every comp, rate override, goodwill credit and refund pauses for a manager to approve. The agents draft, stage and route; a human decides. Monitoring agents are advisory only.",
    },
    {
      q: "Do the agents work in languages other than English?",
      a: "Yes. Reservations, concierge, in-stay messaging and confirmations support English and Spanish out of the box, across web chat, WhatsApp, SMS and phone.",
    },
    {
      q: "How do the agents handle accessibility requests?",
      a: "Agents proactively ask about ADA accessibility needs, filter to only rooms that meet stated requirements, and attach the requirement to the reservation and folio so the right room is assigned.",
    },
  ],
};
