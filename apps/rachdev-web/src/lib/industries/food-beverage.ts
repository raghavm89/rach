import type { IndustryConfig } from "./types";

/**
 * Food & Beverage (US restaurants, cafes, bars, catering & delivery) industry config.
 *
 * Content is authored for a US restaurant / hospitality-group buyer — FALCPA
 * allergen disclosure, state alcohol & age rules, local health-department
 * standards, English + Spanish — and renders entirely in the Rach.Dev design
 * system. Interactions (Control Tower + relay + knowledge) are fully scripted;
 * no live model is called.
 */
export const foodBeverageConfig: IndustryConfig = {
  slug: "food-beverage",
  vertical: "Food & Beverage",
  industrySlug: "food-beverage",
  industryName: "Food & Beverage",
  icon: "utensils",
  tagline:
    "An agent team for orders, reservations, allergen-safe menu guidance, loyalty, catering quotes and rush-hour monitoring — on your POS and booking stack, with a manager in the loop.",
  seoTitle: "Food & Beverage AI Agents for Restaurants & Hospitality Groups",
  seoDescription:
    "Rach.Dev is an AI operations layer for restaurants, bars, cafes, catering and delivery — agents for order and reservation capture, FALCPA allergen-safe menu guidance, loyalty, catering quotes and rush-hour monitoring, on top of your POS (Toast, Square, Clover), OpenTable/Resy and loyalty stack, with a manager in the loop on every high-stakes action.",
  seoKeywords: [
    "restaurant AI agents",
    "AI order taking restaurant",
    "reservation automation",
    "restaurant phone answering AI",
    "FALCPA allergen disclosure AI",
    "catering quote automation",
    "Toast Square Clover POS automation",
    "restaurant loyalty automation",
  ],

  // ---------------- HERO ----------------
  eyebrow: "Food & Beverage · Agentic Operations Layer",
  h1Lines: ["The AI operations layer", "for your restaurant group."],
  rotorLead: "Put a team of agents on your",
  rotorWords: ["orders.", "reservations.", "allergen guidance.", "loyalty.", "rush-hour watch."],
  subhead:
    "Rach.Dev runs order capture, reservations, allergen-safe menu guidance, loyalty and catering quotes across the channels guests already use — with a manager in the loop on every high-stakes call, FALCPA allergen disclosure on every dish, and a full audit trail on every action.",
  trustRow: [
    "FALCPA allergen-safe by design",
    "Works with your existing POS & booking stack",
    "Manager-in-the-loop",
    "English & Spanish",
  ],
  heroPrimaryCta: { label: "Book a pilot", href: "/contact" },
  heroSecondaryCta: { label: "See the architecture", href: "#architecture" },

  // ---------------- OPERATING PICTURE ----------------
  operateEyebrow: "The operating picture",
  operateTitle: "What an agent team takes off your floor",
  operateIntro:
    "Most of a restaurant's load isn't cooking — it's a ringing phone, a no-show table, a guest with a peanut allergy and a catering inquiry that needs five emails. Here's where agents own the busywork, mapped to how your venue actually runs.",
  domains: [
    {
      icon: "door",
      title: "The Front Door",
      blurb: "Every order and booking captured, qualified and routed — 24/7, in English or Spanish.",
      bullets: [
        "Order capture across chat, SMS, WhatsApp and web",
        "Takeout, delivery and dine-in routed to the right channel",
        "Never a busy signal or a missed call during the rush",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "shieldAlert",
      title: "Allergen & Compliance",
      blurb: "FALCPA allergen disclosure on every dish, with age and local rules enforced.",
      bullets: [
        "Big-9 allergen flags surfaced before an order is placed",
        "Severe-allergy requests escalated to a human, never guessed",
        "Alcohol age / state-license checks before anything is poured",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "calendar",
      title: "Reservations & Waitlist",
      blurb: "Bookings, confirmations, waitlist and the no-show follow-up that wins seats back.",
      bullets: [
        "OpenTable / Resy bookings with party-size and table fit",
        "Confirmations, reminders and easy re-book by text",
        "No-show follow-up and waitlist backfill in real time",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "utensils",
      title: "Menu & Guest Guidance",
      blurb: "Dietary-aware menu help — the kitchen confirms, the agent never improvises.",
      bullets: [
        "Suggestions by diet, allergy, flavor and party size",
        "Up-sells and pairings that respect the check, not the guest",
        "Every allergen answer cited to the live menu spec",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "creditCard",
      title: "POS & Order Sync",
      blurb: "Orders land in the kitchen clean — no re-keying, no transcription errors.",
      bullets: [
        "Orders written straight to Toast / Square / Clover",
        "Modifiers, allergens and prep notes carried through",
        "Delivery hand-off to your courier or marketplace",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "star",
      title: "Loyalty & Repeat Visits",
      blurb: "The enrollments and rewards your staff are too slammed to push at the table.",
      bullets: [
        "Auto-enroll at order, points tracked across visits",
        "Reward and birthday nudges that bring guests back",
        "Win-back offers for lapsed regulars (EN / ES)",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "briefcase",
      title: "Catering & Events",
      blurb: "Inquiry-to-quote in one thread instead of a week of back-and-forth.",
      bullets: [
        "Collects headcount, date, budget and dietary needs",
        "Drafts the menu and quote from your catering pricing",
        "Owner signs the quote before anything is promised",
      ],
      tag: { label: "In your build", tone: "muted" },
    },
    {
      icon: "knowledge",
      title: "Knowledge Layer",
      blurb: "A guest-facing assistant grounded only in your live menu and policies.",
      bullets: [
        "Separate views for guest, host and back-of-house",
        "Every answer cites the menu spec or policy it used",
        "Hard guardrails — never clears a severe allergy alone",
      ],
      tag: { label: "In demo", tone: "live" },
    },
  ],

  // ---------------- CONTROL TOWER ----------------
  towerTitle: "Watch the team run a service",
  towerIntro:
    "Pick a guest and press play. Watch the agent team run the order or booking end to end — a manager approves every high-stakes call.",
  subjectNoun: "guest",
  stages: [
    { key: "door", label: "Front Door", icon: "door" },
    { key: "allergen", label: "Allergen Check", icon: "shieldAlert" },
    { key: "menu", label: "Menu", icon: "utensils" },
    { key: "book", label: "Order / Book", icon: "calendar" },
    { key: "decision", label: "Approval", icon: "decision" },
    { key: "fulfill", label: "Fulfillment", icon: "coord" },
    { key: "follow", label: "Follow-up", icon: "follow" },
  ],
  scenarios: [
    {
      key: "allergy",
      tabLabel: "Allergy order",
      tabIcon: "shieldAlert",
      subjectName: "Jordan Avery · party of 2",
      subjectDesc: "Takeout order with a severe peanut allergy",
      channel: "Web chat · Dinner rush",
      channelIcon: "message",
      steps: [
        {
          agent: "intake",
          stage: "door",
          title: "Order started & guest identified",
          detail:
            "Inbound web-chat order at 7:12 PM during the rush; returning guest matched to loyalty profile, takeout cart opened.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "allergen",
          title: "Severe peanut allergy — escalated",
          detail:
            "Guest flags a severe peanut allergy. Agent will not clear cross-contact alone — routed to the kitchen lead for confirmation.",
          status: "esc",
          ms: 1300,
        },
        {
          agent: "scribe",
          stage: "menu",
          title: "Allergen-safe options drafted",
          detail:
            "Pulled peanut-free dishes from the live menu spec, flagged shared-fryer items, and noted the Big-9 disclosure on each.",
          status: "ok",
          ms: 1200,
        },
        {
          agent: "triage",
          stage: "decision",
          title: "Kitchen lead confirms allergen prep",
          detail:
            "Kitchen lead approves the dedicated-prep and no-cross-contact plan before the order is accepted — Rach.Dev never clears a severe allergy on its own.",
          status: "gate",
          gateBy: "Marco Bianchi · Kitchen Lead",
          ms: 1300,
        },
        {
          agent: "coord",
          stage: "book",
          title: "Order fired to the POS",
          detail:
            "Order written to Toast with allergen flags and prep notes intact; quoted pickup time confirmed back to the guest.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "monitor",
          stage: "fulfill",
          title: "Order watch armed",
          detail:
            "Ops Sentinel tracks the ticket against quoted time; a delay or modifier conflict would alert the floor manager.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "revenue",
          stage: "follow",
          title: "Paid, loyalty credited & followed up",
          detail:
            "Payment captured, loyalty points added, and a post-pickup note thanks the guest and reconfirms the allergen handling.",
          status: "ok",
          ms: 1100,
        },
      ],
    },
    {
      key: "reservation",
      tabLabel: "Reservation",
      tabIcon: "calendar",
      subjectName: "The Patel Party · party of 6",
      subjectDesc: "Anniversary dinner, Friday 8:00 PM",
      channel: "Phone · Front of house",
      channelIcon: "phone",
      steps: [
        {
          agent: "intake",
          stage: "door",
          title: "Booking request captured",
          detail:
            "Caller identified, party of 6 for an anniversary requested Friday 8:00 PM; preferences and contact captured.",
          status: "ok",
          ms: 1000,
        },
        {
          agent: "triage",
          stage: "allergen",
          title: "Notes flagged, no red flags",
          detail:
            "One guest is vegetarian, no severe allergies noted; standard booking, no kitchen escalation needed.",
          status: "ok",
          ms: 1000,
        },
        {
          agent: "scribe",
          stage: "menu",
          title: "Table fit & prep noted",
          detail:
            "Matched to a six-top by the window, anniversary tag added so the team can prep a dessert greeting.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "coord",
          stage: "book",
          title: "Held in OpenTable",
          detail:
            "Slot held on the Friday floor plan with the anniversary note; conflict check clear against the book.",
          status: "ok",
          ms: 1000,
        },
        {
          agent: "coord",
          stage: "decision",
          title: "Large-party hold — manager confirms",
          detail:
            "A party of 6 on a peak Friday is held for the floor manager to approve before it is promised to the guest.",
          status: "gate",
          gateBy: "Dana Whitfield · Floor Manager",
          ms: 1200,
        },
        {
          agent: "intake",
          stage: "fulfill",
          title: "Confirmed + reminders set",
          detail:
            "Confirmation texted with an easy re-book link; reminders scheduled for the day before and day of to cut no-show risk.",
          status: "ok",
          ms: 1000,
        },
        {
          agent: "revenue",
          stage: "follow",
          title: "Loyalty linked & waitlist ready",
          detail:
            "Loyalty profile linked for the visit; if the table cancels, the waitlist backfill is staged automatically.",
          status: "ok",
          ms: 1000,
        },
      ],
    },
    {
      key: "afterhours",
      tabLabel: "After-hours text",
      tabIcon: "message",
      subjectName: "Sofía Reyes · party of 4",
      subjectDesc: "After-hours catering inquiry, in Spanish",
      channel: "SMS · After hours",
      channelIcon: "message",
      steps: [
        {
          agent: "intake",
          stage: "door",
          title: "Spanish text understood & answered",
          detail:
            "Inbound SMS in Spanish at 10:50 PM about a 40-person office lunch; guest answered in her own language.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "allergen",
          title: "Dietary needs captured safely",
          detail:
            "Two gluten-free and one nut-allergy guest noted; the nut allergy is tagged for kitchen confirmation, not auto-cleared.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "knowledge",
          stage: "menu",
          title: "Grounded answer, cited to the menu",
          detail:
            "Answered her question about gluten-free platters from the live catering menu, with sources — and did not improvise allergen claims.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "scribe",
          stage: "book",
          title: "Catering quote drafted",
          detail:
            "Drafted a 40-head menu and quote from the catering pricing book, with the dietary notes carried through.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "revenue",
          stage: "decision",
          title: "Quote priced — owner signs",
          detail:
            "Discounted catering quote staged for the owner to approve before any price is promised to the guest.",
          status: "gate",
          gateBy: "Priya Shah · Owner",
          ms: 1200,
        },
        {
          agent: "intake",
          stage: "follow",
          title: "Confirmed in Spanish + next step",
          detail:
            "Sent the approved quote and a deposit link in Spanish, with a morning follow-up scheduled to lock the date.",
          status: "ok",
          ms: 1000,
        },
      ],
    },
  ],
  gateNote:
    "Every high-stakes call waits for a human. Rach.Dev drafts, stages and routes — a manager, owner or kitchen lead approves.",
  completeToast: "Service complete — every high-stakes action was human-approved",

  // ---------------- ROSTER (relay) ----------------
  rosterTitle: "Seven specialists, one conductor",
  rosterIntro:
    "Each agent owns one job and hands the next a complete, structured context. Atlas routes the work, enforces the human-in-the-loop gates, and writes every action to an audit log.",
  rosterClickNote: "Click Ava below — the full order-to-loyalty workflow plays out automatically.",
  orchestratorName: "Atlas",
  orchestratorBlurb:
    "Atlas is the orchestrator. It routes each order or booking to the right specialist, carries shared guest context between them, pauses for a human to approve every high-stakes action, and records a complete, timestamped audit trail.",
  relayTriggerAgentKey: "intake",
  relayCompleteToast: "Workflow complete — all agents processed Jordan Avery's order",
  agents: [
    {
      key: "intake",
      name: "Ava",
      role: "Front Desk · Order & Reservation Capture",
      icon: "intake",
      blurb:
        "The front door. Captures every order and booking across chat, SMS, WhatsApp and web, matches the guest, and opens a clean cart or reservation — 24/7, in English or Spanish, never a busy signal during the rush.",
      tags: ["Multi-channel capture", "Order & reservation", "EN / ES"],
      pipeSub: "Intake",
      workMs: 2000,
      voice: {
        listeningTitle: "Listening…",
        listeningSub: "Capturing the order by chat",
        doneTitle: "Order captured",
        doneSub: "6 fields captured · handing off to the team…",
        handoffToast: "Ava done — watch the team pick it up",
        fields: [
          { label: "Guest", value: "Jordan Avery · party of 2" },
          { label: "Order type", value: "Takeout · dinner rush" },
          { label: "Items", value: "2 entrées + 1 side, pickup in 30 min" },
          { label: "Allergy", value: "Severe peanut allergy — flagged for kitchen" },
          { label: "Guest match", value: "Matched to loyalty profile", ok: true },
          { label: "Channel", value: "Web chat · English", ok: true },
        ],
      },
    },
    {
      key: "triage",
      name: "Marcus",
      role: "Allergen & Compliance",
      icon: "shieldAlert",
      blurb:
        "Allergen & compliance. Runs FALCPA Big-9 disclosure on every dish, checks alcohol age and state rules, and escalates any severe allergy straight to the kitchen lead — never clearing cross-contact on its own.",
      tags: ["FALCPA allergen", "Age / alcohol rules", "Escalation"],
      pipeSub: "Allergen",
      workMs: 2100,
      flow: [
        {
          fromLabel: "Context from Ava",
          chips: ["Jordan Avery · party of 2", "Takeout · dinner rush", "Severe peanut allergy"],
        },
        {
          steps: [
            { text: "Big-9 allergen disclosure attached to every candidate dish", kind: "ok" },
            { text: "Alcohol / age check not required for this order", kind: "ok" },
            { text: "Severe peanut allergy → routed to the kitchen lead, not cleared", kind: "esc" },
          ],
          note: "A severe allergy is never auto-cleared. The kitchen lead confirms the prep plan before the order is accepted.",
        },
      ],
    },
    {
      key: "scribe",
      name: "Nora",
      role: "Menu & Quote Drafting",
      icon: "scribe",
      blurb:
        "Menu and quote drafting. Suggests dishes by diet, allergy and party size from the live menu spec, drafts catering quotes from your pricing book, and carries every modifier and prep note through — the human decides, not retypes.",
      tags: ["Menu guidance", "Catering quotes", "Modifiers & prep notes"],
      pipeSub: "Menu",
      workMs: 2000,
      flow: [
        {
          fromLabel: "Context from Marcus",
          chips: ["Peanut-free required", "Watch shared fryer", "Big-9 disclosed"],
        },
        {
          steps: [
            { text: "Peanut-free options pulled from the live menu spec", kind: "ok" },
            { text: "Shared-fryer items flagged so the guest can choose safely", kind: "ok" },
            { text: "Prep notes drafted and attached for the kitchen", kind: "ok" },
          ],
          note: "Draft only. Allergen-safe prep is confirmed by the kitchen lead before the order is fired.",
        },
      ],
    },
    {
      key: "coord",
      name: "Owen",
      role: "Fulfillment & Reservations",
      icon: "coord",
      blurb:
        "Fulfillment and reservations. Fires clean orders into the POS, holds tables in OpenTable / Resy, hands off delivery, and keeps the waitlist and reminders moving — no re-keying, no double-booking.",
      tags: ["POS sync", "Reservations & waitlist", "Delivery hand-off"],
      pipeSub: "Fulfill",
      workMs: 1900,
      flow: [
        {
          fromLabel: "Context from Nora",
          chips: ["Order → Toast", "Allergen flags intact", "Pickup in 30 min"],
        },
        {
          steps: [
            { text: "Order written to the POS with allergen flags and prep notes", kind: "ok" },
            { text: "Quoted pickup time confirmed back to the guest", kind: "ok" },
            { text: "Reservation conflicts checked; waitlist backfill staged", kind: "ok" },
          ],
        },
      ],
    },
    {
      key: "revenue",
      name: "Riley",
      role: "Payments & Loyalty",
      icon: "revenue",
      blurb:
        "Payments and loyalty. Captures payment, applies the right offer, credits loyalty points across visits, and stages catering quotes for owner sign-off — catching every check and every repeat-visit hook.",
      tags: ["Payments", "Loyalty & offers", "Catering quotes"],
      pipeSub: "Billing",
      workMs: 2000,
      flow: [
        {
          fromLabel: "Context from Owen",
          chips: ["Takeout total $54.20", "Loyalty +54 pts", "Returning guest"],
        },
        {
          steps: [
            { text: "Payment captured; correct offer applied for this guest", kind: "ok" },
            { text: "Loyalty points credited and reward threshold checked", kind: "ok" },
            { text: "Catering discount over policy → staged for owner sign-off", kind: "esc" },
          ],
          note: "Discounts and quotes above policy are never sent alone — they wait for an owner or manager to approve.",
        },
      ],
    },
    {
      key: "knowledge",
      name: "Iris",
      role: "Guest Knowledge Assistant",
      icon: "knowledge",
      blurb:
        "The guest-facing knowledge assistant. Answers guests, hosts and back-of-house from your live menu and policies only — every answer cited, and a severe-allergy clearance always handed to the kitchen, never improvised.",
      tags: ["Role-aware", "Cited answers", "Never clears an allergy"],
      pipeSub: "Knowledge",
      workMs: 1900,
      flow: [
        {
          fromLabel: "Context from Riley",
          chips: ["Guest view", "Live menu spec only", "EN / ES"],
        },
        {
          steps: [
            { text: "Answered hours, menu and policy questions from approved sources", kind: "ok" },
            { text: "Every answer carried its menu-spec or policy citation", kind: "ok" },
            { text: "Severe-allergy clearance → handed to the kitchen, not answered", kind: "esc" },
          ],
          note: "Iris informs. It never clears a severe allergy, overrides the kitchen, or invents a menu claim.",
        },
      ],
    },
    {
      key: "monitor",
      name: "Hope",
      role: "Ops Sentinel",
      icon: "monitor",
      blurb:
        "The Ops Sentinel. Always on, reading the live signal across the floor — reservation no-shows, late or stuck tickets, order errors, rush-hour load and dropping ratings — flagging trouble before it hits a guest, and staging the response for the manager.",
      tags: ["Always-on monitor", "Rush-hour early-warning", "Advisory only"],
      pipeSub: "Ops",
      workMs: 2400,
      live: { label: "Live · Floor" },
      flow: [
        {
          fromLabel: "Context from the floor",
          chips: ["Friday dinner rush", "No-show risk: elevated", "Kitchen: backing up"],
        },
        {
          fromLabel: "How Hope calibrates for this venue",
          steps: [
            { text: "Baselines ticket times, covers and channel mix for this location", kind: "ok" },
            { text: "Tightens thresholds for the Friday and Saturday rush windows", kind: "ok" },
            { text: "Suppresses nuisance alerts to cut noise during peak service", kind: "ok" },
          ],
        },
        {
          fromLabel: "What Hope watches in real time",
          chips: ["Ticket times", "No-shows", "Order errors", "Hold times", "Covers / load", "Ratings"],
          steps: [
            { text: "No-show — confirmed party past grace, table still empty", kind: "esc" },
            { text: "Late ticket — kitchen time past quote, guest waiting", kind: "esc" },
            { text: "Order error — modifier or allergen conflict on a fired ticket", kind: "esc" },
            { text: "Rush overload — covers and hold times spiking past threshold", kind: "esc" },
            { text: "Delivery slip — courier ETA blown on an active order", kind: "esc" },
            { text: "Rating drop — new low review mentioning a fixable issue", kind: "esc" },
          ],
          note: "Hope is advisory. It alerts and stages — a manager decides and acts. Every alert is logged with the signal that triggered it.",
        },
      ],
    },
  ],

  // ---------------- ARCHITECTURE ----------------
  archTitle: "One layer over the systems you already run",
  archIntro:
    "Rach.Dev sits on top of your POS and booking stack — orchestrating agents, enforcing governance, and keeping a manager in the loop. No rip-and-replace.",
  archLayers: [
    {
      n: "Layer 4",
      title: "Human-in-the-loop",
      icon: "decision",
      body: "Every high-stakes action — severe-allergy clearance, large-party holds, discounts and catering quotes — pauses for a manager, owner or kitchen lead to approve. Agents draft and stage; people decide.",
      pills: ["Approval gates", "Kitchen / manager sign-off", "Role-based access"],
    },
    {
      n: "Layer 3",
      title: "Governance & audit",
      icon: "shield",
      body: "FALCPA allergen disclosure, alcohol-age and local health rules enforced in the workflow, with a complete, timestamped audit trail on every order, booking and data touch.",
      pills: ["FALCPA allergen", "Full audit log", "Age / alcohol rules", "Source citations"],
    },
    {
      n: "Layer 2",
      title: "Agent orchestration",
      icon: "orchestrator",
      body: "Atlas routes each order or booking to the right specialist, carries shared guest context between agents, and coordinates hand-offs end to end.",
      pills: ["Routing & hand-off", "Shared context", "Escalation paths"],
    },
    {
      n: "Layer 1",
      title: "Integration",
      icon: "plug",
      body: "Bidirectional connectors to your POS, reservation, loyalty and delivery systems over the APIs your stack already speaks.",
      pills: ["POS APIs", "Booking & loyalty", "Webhooks & APIs"],
    },
  ],
  archBaseLabel: "Works with the systems you already run",
  archBaseSystems: [
    "Toast",
    "Square",
    "Clover",
    "OpenTable",
    "Resy",
    "DoorDash",
    "Uber Eats",
    "Twilio",
    "WhatsApp",
    "Punchh",
  ],

  // ---------------- KNOWLEDGE ----------------
  knowledgeTitle: "A knowledge layer that knows its limits",
  knowledgeIntro:
    "Iris answers guests, hosts and back-of-house from your live menu and policies only. Every answer is cited — and a severe-allergy clearance is always handed to the kitchen, never improvised.",
  knowledgeAgentName: "Iris",
  knowledgeViewLabel: "Guest view",
  knowledgeGreeting:
    "Hi, I'm Iris. Ask me about the menu, hours, reservations or dietary options — I'll always cite my source.",
  knowledgeDisclaimer:
    "Iris provides information only — never a guarantee of allergen-free preparation. Anything involving a severe allergy is confirmed by the kitchen before your order is accepted.",
  knowledge: [
    {
      q: "Do you have vegetarian and gluten-free options?",
      a: "Yes — we have several vegetarian mains and a labeled gluten-free section, including the roasted-vegetable bowl and the grilled salmon plate. Items are marked on the live menu, and I can hold a table or start a takeout order whenever you're ready.",
      src: ["Live menu spec", "Reservation system"],
    },
    {
      q: "¿Tienen opciones sin gluten para un grupo grande?",
      a: "Sí. Nuestro menú de catering incluye varias bandejas sin gluten para grupos, y puedo armar un presupuesto con su número de invitados. Para alergias graves, la cocina confirma la preparación sin contacto cruzado antes de aceptar el pedido.",
      src: ["Catering menu", "Allergen policy"],
    },
    {
      q: "Can you guarantee this dish is 100% safe for my severe peanut allergy?",
      a: "I can't guarantee that myself — that's a kitchen call, not an automated one. I've flagged your severe peanut allergy and routed it to our kitchen lead, who will confirm a dedicated, no-cross-contact prep before we accept your order. If you ever have a reaction, call 911 right away.",
      src: ["Allergen policy", "Kitchen routing"],
    },
  ],

  // ---------------- GOVERNANCE ----------------
  governanceTitle: "Governance, not just guardrails",
  governanceIntro:
    "The controls that let a restaurant group actually deploy agents — enforced in the system, not promised on a slide.",
  guarantees: [
    {
      title: "Human in the loop",
      desc: "Every high-stakes action — severe-allergy clearance, large-party holds, over-policy discounts and catering quotes — waits for a manager, owner or kitchen lead to approve. No agent clears an allergy on its own.",
    },
    {
      title: "Complete audit trail",
      desc: "Every order, booking, hand-off and data access is logged with a timestamp, the agent, the source and the approver — exportable on demand.",
    },
    {
      title: "FALCPA allergen & alcohol rules",
      desc: "Big-9 allergen disclosure on every dish, severe allergies escalated to the kitchen, and alcohol age / state-license checks before anything is poured — configurable per location.",
    },
    {
      title: "Grounded with sources",
      desc: "Answers come only from your live menu spec and approved policies, and cite them. No open-web guessing, no improvised allergen claims.",
    },
    {
      title: "No vendor lock-in",
      desc: "Standards-based connectors to your POS, booking and loyalty systems, and your data stays yours. Turn an agent off and your systems keep running.",
    },
  ],
  auditTitle: "Live audit log",
  auditIntro: "A sample of what every action looks like on the record.",
  auditLines: [
    { ts: "19:12:04", text: "Inbound web-chat order received & answered — guest #2207", tag: "ok", tagLabel: "Logged" },
    { ts: "19:12:48", text: "FALCPA Big-9 disclosure attached to 4 candidate dishes", tag: "ok", tagLabel: "Disclosed" },
    { ts: "19:13:30", text: "Severe peanut allergy flagged — routed to kitchen lead", tag: "esc", tagLabel: "Escalated" },
    { ts: "19:14:55", text: "Allergen-safe prep approved by Marco Bianchi, Kitchen Lead", tag: "ok", tagLabel: "Approved" },
    { ts: "19:15:12", text: "Order written to Toast POS with allergen flags intact", tag: "mod", tagLabel: "POS" },
    { ts: "22:51:09", text: "After-hours SMS (es) catering inquiry received & answered", tag: "ok", tagLabel: "Logged" },
  ],

  // ---------------- OUTCOMES ----------------
  outcomesTitle: "What changes when agents own the busywork",
  outcomesIntro: "Directional outcomes our pilots target — validated on your own data, never assumed.",
  outcomes: [
    {
      value: "24/7",
      label: "Coverage, every channel",
      desc: "Chat, SMS, WhatsApp and web answered around the clock, in English and Spanish — no busy signal, no missed order during the rush.",
    },
    {
      value: "Fewer",
      label: "No-shows & empty seats",
      desc: "Confirmations, reminders and instant waitlist backfill turn cancellations into covers instead of lost revenue.",
    },
    {
      value: "Cleaner",
      label: "Tickets to the kitchen",
      desc: "Orders written straight to the POS with allergens and modifiers intact — fewer errors, faster service.",
    },
    {
      value: "More",
      label: "Loyalty & repeat visits",
      desc: "Auto-enroll, points and win-back nudges your staff are too slammed to push at the table.",
    },
  ],
  benchmarks: [
    {
      text: "Industry data puts restaurant reservation no-show and cancellation rates at roughly one in five bookings — premium seats lost that confirmations, reminders and waitlist backfill are meant to win back.",
      cite: "OpenTable / TouchBistro, restaurant no-show data, 2024",
    },
    {
      text: "Scaling across US restaurants, unanswered phone calls are estimated to cost the industry on the order of $20 billion a year, with venues missing about a third of incoming calls during the dinner rush.",
      cite: "QSR Magazine, \"While the Phone Rings, Restaurants are Losing $20 Billion,\" 2024",
    },
    {
      text: "Food-allergy reactions send roughly 3.4 million Americans to emergency care each year, and dining out is among the most common places they happen — many even after the allergy was disclosed to staff.",
      cite: "FARE (Food Allergy Research & Education), Food Allergy Facts & Statistics, 2024",
    },
  ],
  outcomesNote:
    "Figures above are external benchmarks and pilot targets, not guarantees — we validate every number on your own data before you rely on it. Monitoring agents are advisory: they alert and stage, a manager acts.",

  // ---------------- CTA ----------------
  ctaTitle: "Start with one location. Prove it. Then scale.",
  ctaIntro:
    "We stand up a single workflow on your existing POS and booking stack, show the audit trail and the outcomes, and expand only once your team trusts it.",
  ctaSteps: [
    {
      n: "01",
      title: "Scope one workflow",
      desc: "Pick the highest-pain workflow — order capture, reservations or catering quotes — and we map it to your systems.",
    },
    {
      n: "02",
      title: "Pilot in your venue",
      desc: "Agents run on your POS and booking stack with a manager in the loop and a full audit trail, in weeks not quarters.",
    },
    {
      n: "03",
      title: "Measure, then expand",
      desc: "Review the outcomes on your own data, then roll the agent team out location by location across the group.",
    },
  ],

  // ---------------- FAQ (drives FAQPage JSON-LD) ----------------
  faq: [
    {
      q: "Does Rach.Dev replace our POS or reservation system?",
      a: "No. Rach.Dev is an operations layer that runs on top of your existing POS (Toast, Square, Clover) and booking stack (OpenTable, Resy) over their APIs. Your systems of record stay exactly where they are.",
    },
    {
      q: "How does Rach.Dev handle food allergies?",
      a: "Agents attach FALCPA Big-9 allergen disclosure to every dish and recommend confirming with staff. A severe allergy is never cleared automatically — it is escalated to the kitchen lead, who confirms a no-cross-contact prep before the order is accepted.",
    },
    {
      q: "Can the agents take orders and bookings after hours?",
      a: "Yes. Order capture, reservations and catering inquiries are answered 24/7 across chat, SMS, WhatsApp and web — including after-hours and in Spanish — so you never lose a guest to a busy signal or voicemail.",
    },
    {
      q: "How does it handle alcohol orders?",
      a: "Agents are configured per location to verify legal drinking age and comply with your state and local liquor-license rules before any alcohol is added to an order, escalating to a human where required.",
    },
    {
      q: "Do the agents make discount or large-booking decisions on their own?",
      a: "No. Over-policy discounts, catering quotes and large-party holds on peak nights are staged for a manager or owner to approve before anything is promised to the guest. Monitoring agents are advisory only.",
    },
  ],
};
