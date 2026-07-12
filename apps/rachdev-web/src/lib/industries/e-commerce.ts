import type { IndustryConfig } from "./types";

/**
 * E-Commerce (US online retail) industry config.
 *
 * Content is authored for a US DTC / online-retail buyer — Shopify / WooCommerce /
 * BigCommerce storefronts, a payment processor, a 3PL / ShipStation, Klaviyo,
 * PCI DSS for card data and consumer-protection / AI-disclosure rules — and
 * renders entirely in the Rach.Dev design system. Interactions (Control Tower +
 * relay + knowledge) are fully scripted; no live model is called.
 */
export const ecommerceConfig: IndustryConfig = {
  slug: "e-commerce",
  vertical: "E-Commerce",
  industrySlug: "e-commerce",
  industryName: "E-Commerce",
  icon: "shoppingCart",
  tagline:
    "An agent team for support, order assistance, returns, fraud screening, cart recovery and a live Fraud/Cart Sentinel — on your storefront and 3PL, with a human in the loop on refunds and risk.",
  seoTitle: "E-Commerce AI Agents for Online Stores & DTC Brands",
  seoDescription:
    "Rach.Dev is an AI operations layer for online stores — agents for support, order assistance, returns and refunds, fraud screening, cart recovery and an always-on Fraud/Cart Sentinel, on top of Shopify, WooCommerce, BigCommerce, your payment processor and 3PL, with a human in the loop on refunds, chargebacks and high-risk orders.",
  seoKeywords: [
    "ecommerce AI agents",
    "AI customer support automation",
    "order status automation",
    "returns and refunds automation",
    "ecommerce fraud detection AI",
    "cart abandonment recovery AI",
    "Shopify AI agent",
    "PCI DSS AI agents",
  ],

  // ---------------- HERO ----------------
  eyebrow: "E-Commerce · Agentic Operations Layer",
  h1Lines: ["The AI operations layer", "for your online store."],
  rotorLead: "Put a team of agents on your",
  rotorWords: ["support inbox.", "order questions.", "returns.", "fraud screen.", "cart recovery."],
  subhead:
    "Rach.Dev runs support, order assistance, returns and refunds, fraud screening, cart recovery and a live Fraud/Cart Sentinel across the systems you already use — with a human in the loop on every refund, chargeback and high-risk order, and a full audit trail on every action.",
  trustRow: [
    "PCI DSS-aware by design",
    "Works with Shopify, WooCommerce & BigCommerce",
    "AI disclosure on every chat",
    "English & Spanish",
  ],
  heroPrimaryCta: { label: "Book a pilot", href: "/contact" },
  heroSecondaryCta: { label: "See the architecture", href: "#architecture" },

  // ---------------- OPERATING PICTURE ----------------
  operateEyebrow: "The operating picture",
  operateTitle: "What an agent team takes off your store",
  operateIntro:
    "Most of an online store's load isn't strategy — it's answering the same order questions, processing returns, screening risky orders and chasing carts that almost converted. Here's where agents own the busywork, mapped to how your store actually runs.",
  domains: [
    {
      icon: "headset",
      title: "Support Front Door",
      blurb: "Every pre- and post-purchase question answered — 24/7, in English or Spanish, on chat and SMS.",
      bullets: [
        "Multi-channel intake (web chat, SMS, WhatsApp, email)",
        "Order lookup & customer history linked instantly",
        "Clear AI disclosure on first contact, every time",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "package",
      title: "Order & Shipping",
      blurb: "Where is my order? answered from live tracking — and delays flagged before the customer asks.",
      bullets: [
        "Real-time status from your 3PL / ShipStation",
        "Address edits & holds staged for the warehouse",
        "Carrier-delay and stockout alerts surfaced early",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "route",
      title: "Returns & Refunds",
      blurb: "Self-serve returns the customer finishes in one chat — refunds wait for a human to approve.",
      bullets: [
        "Eligibility checked against your return policy",
        "Prepaid label generated; RMA opened automatically",
        "Refund drafted and staged for human sign-off",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "shieldAlert",
      title: "Fraud & Risk Screen",
      blurb: "Every order scored for risk — suspicious ones held and escalated, never auto-refunded.",
      bullets: [
        "Velocity, mismatch & chargeback-risk signals scored",
        "High-risk orders held for manual review",
        "Card data never stored — processor handles PCI scope",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "tag",
      title: "Conversion & Cart Recovery",
      blurb: "The lost revenue almost everyone leaves on the table — re-engaged on autopilot.",
      bullets: [
        "Abandoned-cart nudges via Klaviyo, SMS and email",
        "Sizing, comparison & in-stock answers pre-purchase",
        "Back-in-stock and price-drop alerts to the right shopper",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "star",
      title: "Reviews & Loyalty",
      blurb: "Post-purchase follow-up, review requests and the loyalty nudges your team never sends.",
      bullets: [
        "Timed review requests after delivery",
        "Sentiment triage on incoming reviews",
        "Loyalty and win-back offers to lapsed customers",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "boxes",
      title: "Catalog & Merchandising",
      blurb: "Listing hygiene, enrichment and the merchandising chores no one wants to do.",
      bullets: [
        "Product-description drafts & spec enrichment",
        "Duplicate / out-of-sync listing detection",
        "Inventory-sync checks across channels",
      ],
      tag: { label: "In your build", tone: "muted" },
    },
    {
      icon: "knowledge",
      title: "Knowledge Layer",
      blurb: "A role-aware assistant grounded only in your policies, catalog and order data.",
      bullets: [
        "Answers shoppers, support and ops from approved sources",
        "Every answer cites its source",
        "Hard guardrails — never legal or payment-dispute advice",
      ],
      tag: { label: "In demo", tone: "live" },
    },
  ],

  // ---------------- CONTROL TOWER ----------------
  towerTitle: "Watch the team run an order",
  towerIntro:
    "Pick a case and press play. Watch the agent team run it end to end — a human approves every refund and every high-risk order.",
  subjectNoun: "order",
  stages: [
    { key: "contact", label: "Contact", icon: "headset" },
    { key: "identify", label: "Identify", icon: "userSearch" },
    { key: "resolve", label: "Resolve", icon: "listChecks" },
    { key: "risk", label: "Risk Screen", icon: "shieldAlert" },
    { key: "decision", label: "Decision", icon: "decision" },
    { key: "fulfill", label: "Fulfill", icon: "truck" },
    { key: "follow", label: "Follow-up", icon: "follow" },
  ],
  scenarios: [
    {
      key: "return",
      tabLabel: "Return & refund",
      tabIcon: "route",
      subjectName: "Order #SF-20418 · Jessica Hartman",
      subjectDesc: "Wrong size hoodie — return + refund",
      channel: "Web chat · Business hours",
      channelIcon: "message",
      steps: [
        {
          agent: "intake",
          stage: "contact",
          title: "Chat answered, AI disclosed",
          detail:
            "Web-chat opened with a clear AI disclosure; customer wants to return a hoodie that arrived a size too small.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "identify",
          title: "Order matched & policy checked",
          detail:
            "Order #SF-20418 found, delivered 6 days ago — inside the 30-day window, item eligible for return.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "scribe",
          stage: "resolve",
          title: "RMA + prepaid label drafted",
          detail:
            "Return reason logged, exchange-vs-refund options drafted, prepaid label and RMA staged for the customer.",
          status: "ok",
          ms: 1200,
        },
        {
          agent: "revenue",
          stage: "risk",
          title: "Refund risk scan clean",
          detail:
            "No serial-return pattern, value within policy threshold, original payment method intact — low risk.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "decision",
          title: "Refund approved by a human",
          detail:
            "Refund of $58.00 to the original card is approved by support — Rach.Dev never issues a refund on its own.",
          status: "gate",
          gateBy: "Dana Whitfield · Support Lead",
          ms: 1300,
        },
        {
          agent: "coord",
          stage: "fulfill",
          title: "Refund issued, RMA opened",
          detail:
            "Refund pushed to the processor after sign-off, RMA opened in the 3PL, return tracking shared with the customer.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "knowledge",
          stage: "follow",
          title: "Confirmed + win-back offer",
          detail:
            "Sent the refund confirmation and a 'find your size' guide, with a small win-back offer for the exchange.",
          status: "ok",
          ms: 1000,
        },
      ],
    },
    {
      key: "wismo",
      tabLabel: "After-hours WISMO",
      tabIcon: "message",
      subjectName: "Order #SF-21755 · María Delgado",
      subjectDesc: "After-hours SMS, in Spanish — where is my order?",
      channel: "SMS · After hours",
      channelIcon: "message",
      steps: [
        {
          agent: "intake",
          stage: "contact",
          title: "Spanish text understood & answered",
          detail:
            "Inbound SMS in Spanish recognized at 11:18 PM; AI disclosed, customer asks where her order is.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "identify",
          title: "Order matched to phone number",
          detail:
            "Order #SF-21755 matched to her number; shipped 3 days ago, carrier marked 'in transit'.",
          status: "ok",
          ms: 1000,
        },
        {
          agent: "monitor",
          stage: "resolve",
          title: "Carrier delay caught proactively",
          detail:
            "Sentinel had already flagged a 2-day carrier exception on this shipment before she asked — context attached.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "knowledge",
          stage: "decision",
          title: "Grounded answer, no dispute advice",
          detail:
            "Explained the delay and new ETA from approved policy in Spanish, with sources — and did not give chargeback advice.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "coord",
          stage: "fulfill",
          title: "Goodwill credit — human confirms",
          detail:
            "A $10 store credit for the delay is staged; the on-call support lead approves before it's promised.",
          status: "gate",
          gateBy: "Marcus Bell · On-call Support",
          ms: 1200,
        },
        {
          agent: "intake",
          stage: "follow",
          title: "Confirmed in Spanish + tracking",
          detail:
            "Sent the updated ETA, the goodwill credit and a live tracking link in Spanish, with a delivery-day reminder.",
          status: "ok",
          ms: 1000,
        },
      ],
    },
    {
      key: "fraud",
      tabLabel: "High-risk order",
      tabIcon: "shieldAlert",
      subjectName: "Order #SF-22090 · 'Alex Romano'",
      subjectDesc: "$1,240 order — fraud signals tripped",
      channel: "Checkout · Storefront",
      channelIcon: "shoppingCart",
      steps: [
        {
          agent: "intake",
          stage: "contact",
          title: "High-value order placed",
          detail:
            "$1,240 order placed at checkout — three high-margin items, expedited shipping, new account.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "identify",
          title: "Identity signals don't line up",
          detail:
            "Billing ZIP and IP geolocation differ by states; email created minutes before the order.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "revenue",
          stage: "risk",
          title: "Fraud signals tripped",
          detail:
            "Card-AVS mismatch, shipping ≠ billing, and a velocity spike on the device → high chargeback risk.",
          status: "esc",
          ms: 1300,
        },
        {
          agent: "monitor",
          stage: "decision",
          title: "Order held for manual review",
          detail:
            "Sentinel holds fulfillment, freezes the warehouse pick, and pages the risk lead — nothing ships on a held order.",
          status: "esc",
          ms: 1300,
        },
        {
          agent: "triage",
          stage: "decision",
          title: "Cancel-or-clear decided by a human",
          detail:
            "After review, the risk lead voids the order and refunds the auth — Rach.Dev never clears a high-risk order alone.",
          status: "gate",
          gateBy: "Owen Carter · Risk Lead",
          ms: 1300,
        },
        {
          agent: "coord",
          stage: "fulfill",
          title: "Void processed, hold released",
          detail:
            "Authorization voided with the processor, warehouse hold released, and the device flagged for future screening.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "knowledge",
          stage: "follow",
          title: "Logged & policy noted",
          detail:
            "Outcome and signals written to the audit log; a neutral cancellation notice sent with no accusatory language.",
          status: "ok",
          ms: 1000,
        },
      ],
    },
  ],
  gateNote:
    "Every refund, credit and high-risk order waits for a human. Rach.Dev drafts, stages and routes — a person approves.",
  completeToast: "Journey complete — every refund and high-risk order was human-approved",

  // ---------------- ROSTER (relay) ----------------
  rosterTitle: "Seven specialists, one conductor",
  rosterIntro:
    "Each agent owns one job and hands the next a complete, structured context. Atlas routes the work, enforces the human-in-the-loop gates on refunds and risk, and writes every action to an audit log.",
  rosterClickNote: "Click Ava below — the full support-to-fulfillment workflow plays out automatically.",
  orchestratorName: "Atlas",
  orchestratorBlurb:
    "Atlas is the orchestrator. It routes each contact and order to the right specialist, carries shared customer and order context between them, pauses for human approval on every refund and high-risk order, and records a complete, timestamped audit trail.",
  relayTriggerAgentKey: "intake",
  relayCompleteToast: "Workflow complete — all agents processed order #SF-20418",
  agents: [
    {
      key: "intake",
      name: "Ava",
      role: "Support Front Door",
      icon: "headset",
      blurb:
        "The front door. Greets every shopper across web chat, SMS, WhatsApp and email with a clear AI disclosure, links the order and history, and opens a clean ticket — 24/7, in English or Spanish.",
      tags: ["Multi-channel intake", "AI disclosure", "EN / ES"],
      pipeSub: "Support",
      workMs: 2000,
      voice: {
        listeningTitle: "Listening…",
        listeningSub: "Capturing the customer's request by voice",
        doneTitle: "Intake complete",
        doneSub: "6 fields captured · handing off to the team…",
        handoffToast: "Ava done — watch the team pick it up",
        fields: [
          { label: "Customer", value: "Jessica Hartman" },
          { label: "Request", value: "Return a hoodie — wrong size" },
          { label: "Order", value: "#SF-20418 · delivered 6 days ago", ok: true },
          { label: "Channel", value: "Web chat · English" },
          { label: "AI disclosure", value: "Shown & acknowledged", ok: true },
          { label: "Sentiment", value: "Neutral — wants quick resolution" },
        ],
      },
    },
    {
      key: "triage",
      name: "Marcus",
      role: "Order & Risk Triage",
      icon: "userSearch",
      blurb:
        "Order & risk triage. Matches the contact to the right order, checks return eligibility against policy, scores the order for risk, and escalates anything suspicious straight to the risk lead.",
      tags: ["Order matching", "Policy & eligibility", "Risk escalation"],
      pipeSub: "Triage",
      workMs: 2100,
      flow: [
        {
          fromLabel: "Context from Ava",
          chips: ["Jessica Hartman", "Return request", "#SF-20418"],
        },
        {
          steps: [
            { text: "Order matched — delivered 6 days ago, in the 30-day window", kind: "ok" },
            { text: "Item eligible per return policy; no serial-return pattern", kind: "ok" },
            { text: "Risk path armed — escalates if fraud or chargeback signals appear", kind: "ok" },
          ],
        },
      ],
    },
    {
      key: "scribe",
      name: "Nora",
      role: "Returns & Case Drafter",
      icon: "scribe",
      blurb:
        "Returns & case drafter. Logs the reason, drafts the RMA, exchange and refund options, generates the prepaid label, and writes a clean case note — leaving a human to approve, not type.",
      tags: ["RMA drafting", "Prepaid labels", "Case notes"],
      pipeSub: "Returns",
      workMs: 2000,
      flow: [
        {
          fromLabel: "Context from Marcus",
          chips: ["Eligible return", "Reason: wrong size", "Refund $58.00"],
        },
        {
          steps: [
            { text: "Return reason logged; exchange-vs-refund options drafted", kind: "ok" },
            { text: "Prepaid label generated and RMA staged for the customer", kind: "ok" },
            { text: "Refund drafted from the order — flagged for human sign-off", kind: "ok" },
          ],
          note: "Draft only. The refund is issued solely after a human approves.",
        },
      ],
    },
    {
      key: "coord",
      name: "Owen",
      role: "Fulfillment Coordination",
      icon: "coord",
      blurb:
        "Fulfillment coordination. Pushes approved refunds to the processor, opens RMAs in the 3PL, stages address edits and holds, and keeps customers updated with tracking and reminders.",
      tags: ["3PL orchestration", "Refund routing", "Tracking & reminders"],
      pipeSub: "Fulfill",
      workMs: 1900,
      flow: [
        {
          fromLabel: "Context from Nora",
          chips: ["Refund approved", "RMA → 3PL", "Tracking link"],
        },
        {
          steps: [
            { text: "Refund pushed to the processor after human sign-off", kind: "ok" },
            { text: "RMA opened in the 3PL; return label and tracking shared", kind: "ok" },
            { text: "Exchange-shipment and delivery reminders scheduled", kind: "ok" },
          ],
        },
      ],
    },
    {
      key: "revenue",
      name: "Riley",
      role: "Payments & Fraud Screen",
      icon: "creditCard",
      blurb:
        "Payments & fraud screen. Scores every order for chargeback and fraud risk, checks refund value against policy, and never touches a raw card number — the processor keeps card data in PCI scope.",
      tags: ["Fraud scoring", "Chargeback risk", "PCI-aware"],
      pipeSub: "Payments",
      workMs: 2000,
      flow: [
        {
          fromLabel: "Context from Owen",
          chips: ["Original card intact", "Value within policy", "No prior chargebacks"],
        },
        {
          steps: [
            { text: "Refund risk scan clean — original payment method, low value", kind: "ok" },
            { text: "AVS / velocity / device signals scored on the order", kind: "ok" },
            { text: "High-risk orders held and escalated — never auto-cleared", kind: "esc" },
          ],
          note: "Card numbers are never stored. PCI scope stays with your payment processor.",
        },
      ],
    },
    {
      key: "knowledge",
      name: "Iris",
      role: "Knowledge Assistant",
      icon: "knowledge",
      blurb:
        "The role-aware knowledge assistant. Answers shoppers, support and ops from your policies, catalog and order data only — every answer cited, and never legal or payment-dispute advice.",
      tags: ["Role-aware", "Cited answers", "Never legal advice"],
      pipeSub: "Knowledge",
      workMs: 1900,
      flow: [
        {
          fromLabel: "Context from Riley",
          chips: ["Shopper view", "Approved sources only", "EN / ES"],
        },
        {
          steps: [
            { text: "Answered shipping, sizing and policy questions from approved sources", kind: "ok" },
            { text: "Every answer carried its source citation", kind: "ok" },
            { text: "Chargeback / legal-dispute request → handed to a human, not advised", kind: "esc" },
          ],
          note: "Iris informs. It never gives legal advice, disputes a charge, or issues a refund.",
        },
      ],
    },
    {
      key: "monitor",
      name: "Hope",
      role: "Fraud / Cart Sentinel",
      icon: "monitor",
      blurb:
        "The Fraud / Cart Sentinel. Always on, reading the live order, payment and inventory stream for every store — catching fraudulent orders, abandoned carts, stockouts and shipping delays before they cost a customer or a chargeback, and staging the response for the team.",
      tags: ["Always-on monitor", "Fraud & cart watch", "Advisory only"],
      pipeSub: "Sentinel",
      workMs: 2400,
      live: { label: "Live · Store" },
      flow: [
        {
          fromLabel: "Context from the store",
          chips: ["Peak traffic", "Chargeback risk: elevated", "Inventory: tight"],
        },
        {
          fromLabel: "How Hope calibrates for this store",
          steps: [
            { text: "Baselines normal order, refund and cart-recovery patterns", kind: "ok" },
            { text: "Tightens fraud thresholds during sale events and high-value SKUs", kind: "ok" },
            { text: "Suppresses noisy alerts to cut alert fatigue for the team", kind: "ok" },
          ],
        },
        {
          fromLabel: "What Hope watches in real time",
          chips: ["Order velocity", "AVS / mismatch", "Chargeback risk", "Cart abandonment", "Stock levels", "Carrier exceptions"],
          steps: [
            { text: "Fraud — velocity spike with billing / shipping mismatch", kind: "esc" },
            { text: "Chargeback risk — repeat dispute pattern on a payment method", kind: "esc" },
            { text: "Cart abandonment — high-intent cart stalled at checkout", kind: "esc" },
            { text: "Stockout — bestseller crossing the low-inventory threshold", kind: "esc" },
            { text: "Shipping delay — carrier exception on an in-transit order", kind: "esc" },
            { text: "Price / listing error — a SKU mispriced against margin floor", kind: "esc" },
          ],
          note: "Hope is advisory. It alerts and stages — a person decides and acts. Every alert is logged with the signal that triggered it.",
        },
      ],
    },
  ],

  // ---------------- ARCHITECTURE ----------------
  archTitle: "One layer over the systems you already run",
  archIntro:
    "Rach.Dev sits on top of your storefront, payment processor and 3PL — orchestrating agents, enforcing governance, and keeping a human in the loop on refunds and risk. No rip-and-replace.",
  archLayers: [
    {
      n: "Layer 4",
      title: "Human-in-the-loop",
      icon: "decision",
      body: "Every refund, store credit, chargeback response and high-risk order pauses for a person to approve. Agents draft and stage; people decide.",
      pills: ["Approval gates", "Refund & risk sign-off", "Role-based access"],
    },
    {
      n: "Layer 3",
      title: "Governance & audit",
      icon: "shield",
      body: "PCI-aware design with card data kept in the processor's scope, configurable GDPR / CCPA retention, AI disclosure on every chat, and a complete, timestamped audit trail.",
      pills: ["PCI-aware", "Full audit log", "GDPR / CCPA controls", "Source citations"],
    },
    {
      n: "Layer 2",
      title: "Agent orchestration",
      icon: "orchestrator",
      body: "Atlas routes each contact and order to the right specialist, carries shared customer context between agents, and coordinates hand-offs end to end.",
      pills: ["Routing & hand-off", "Shared context", "Escalation paths"],
    },
    {
      n: "Layer 1",
      title: "Integration",
      icon: "plug",
      body: "Bidirectional connectors to your storefront, payment processor, 3PL and marketing stack over the APIs and webhooks your systems already speak.",
      pills: ["Storefront APIs", "Processor & 3PL", "Webhooks & events"],
    },
  ],
  archBaseLabel: "Works with the systems you already run",
  archBaseSystems: [
    "Shopify",
    "WooCommerce",
    "BigCommerce",
    "Stripe",
    "PayPal",
    "ShipStation",
    "3PL / WMS",
    "Klaviyo",
    "Gorgias",
    "Twilio",
  ],

  // ---------------- KNOWLEDGE ----------------
  knowledgeTitle: "A knowledge layer that knows its limits",
  knowledgeIntro:
    "Iris answers shoppers, support and ops from your policies, catalog and order data only. Every answer is cited — and anything legal or a payment dispute is always handed to a human, never advised.",
  knowledgeAgentName: "Iris",
  knowledgeViewLabel: "Shopper view",
  knowledgeGreeting:
    "Hi, I'm an AI assistant for the store. Ask me about orders, shipping, returns or sizing — I'll always cite my source.",
  knowledgeDisclaimer:
    "Iris provides information only — never legal advice or guidance on disputing a charge. Refunds and payment disputes are routed to a human on the team.",
  knowledge: [
    {
      q: "Where is my order #SF-21755?",
      a: "Your order shipped 3 days ago and is in transit, with a current ETA of Thursday, June 11. The carrier logged a brief delay in transit, which is why it's running a day behind the original estimate. You can follow it live with the tracking link I just sent, and I'll text you on the delivery day.",
      src: ["Order management", "3PL / ShipStation tracking"],
    },
    {
      q: "¿Puedo devolver este artículo y cuándo recibo mi reembolso?",
      a: "Sí. Su artículo está dentro de la ventana de devolución de 30 días, así que puedo generarle una etiqueta prepagada ahora mismo. Una vez que el almacén reciba la devolución, el reembolso se procesa a su método de pago original en 3 a 5 días hábiles, después de la aprobación de un agente. ¿Prefiere un reembolso o un cambio de talla?",
      src: ["Return policy", "Order management"],
    },
    {
      q: "The charge looks wrong — should I dispute it with my bank?",
      a: "I can't advise you on disputing a charge — that's a payment matter for a person, not an AI. I've pulled up your order and billing details and routed your question to our support team, who will review the charge with you directly and can issue a correction or refund if one is owed. Please hold off on a chargeback until they reach out so we can resolve it faster for you.",
      src: ["Billing records", "Support escalation"],
    },
  ],

  // ---------------- GOVERNANCE ----------------
  governanceTitle: "Governance, not just guardrails",
  governanceIntro:
    "The controls that let an online store actually deploy agents — enforced in the system, not promised on a slide.",
  guarantees: [
    {
      title: "Human in the loop on money",
      desc: "Every refund, store credit, chargeback response and high-risk order waits for a person to approve. No agent moves money or clears a risky order on its own.",
    },
    {
      title: "Complete audit trail",
      desc: "Every action, hand-off and data access is logged with a timestamp, the agent, the source and the approver — exportable on demand.",
    },
    {
      title: "PCI-aware, privacy by design",
      desc: "Card numbers are never stored — PCI scope stays with your payment processor — and customer data follows configurable GDPR / CCPA retention and deletion policies.",
    },
    {
      title: "Grounded with sources",
      desc: "Answers come only from your approved policies, catalog and order data and cite them. No open-web guessing, no ungrounded claims.",
    },
    {
      title: "No vendor lock-in",
      desc: "Standards-based connectors to your storefront, processor and 3PL, and your data stays yours. Turn an agent off and your store keeps running.",
    },
  ],
  auditTitle: "Live audit log",
  auditIntro: "A sample of what every action looks like on the record.",
  auditLines: [
    { ts: "23:18:04", text: "Inbound SMS (es) received & answered with AI disclosure — order #SF-21755", tag: "ok", tagLabel: "Logged" },
    { ts: "10:02:41", text: "Return eligibility checked — within 30-day window", tag: "ok", tagLabel: "Verified" },
    { ts: "10:03:12", text: "Customer PII accessed: order + billing lookup (minimum necessary)", tag: "mod", tagLabel: "PII" },
    { ts: "10:04:55", text: "Refund drafted — $58.00 to original card, awaiting sign-off", tag: "mod", tagLabel: "Pending" },
    { ts: "10:05:30", text: "Refund approved by Dana Whitfield, Support Lead", tag: "ok", tagLabel: "Approved" },
    { ts: "14:22:09", text: "Fraud signals tripped (AVS + velocity) — order #SF-22090 held, risk lead paged", tag: "esc", tagLabel: "Escalated" },
  ],

  // ---------------- OUTCOMES ----------------
  outcomesTitle: "What changes when agents own the busywork",
  outcomesIntro: "Directional outcomes our pilots target — validated on your own data, never assumed.",
  outcomes: [
    {
      value: "24/7",
      label: "Coverage, every channel",
      desc: "Chat, SMS, WhatsApp and email answered around the clock, in English and Spanish — no overnight backlog.",
    },
    {
      value: "Minutes",
      label: "From WISMO to answer",
      desc: "Order status, returns and sizing resolved in one chat instead of a multi-day email thread.",
    },
    {
      value: "Fewer",
      label: "Carts left behind",
      desc: "High-intent carts re-engaged and pre-purchase questions answered before the shopper bounces.",
    },
    {
      value: "Caught",
      label: "Risk before it ships",
      desc: "Fraud and chargeback signals scored and held before a high-risk order ever leaves the warehouse.",
    },
  ],
  benchmarks: [
    {
      text: "Roughly 70% of online shopping carts are abandoned on average, leaving a large share of high-intent revenue on the table for recovery.",
      cite: "Baymard Institute, Cart Abandonment Rate (averaged across 50 studies)",
    },
    {
      text: "eCommerce merchant losses to online payment fraud exceeded about $48 billion globally in 2023, up from roughly $41 billion the year before.",
      cite: "Juniper Research, 2022 (eCommerce online payment fraud forecast)",
    },
    {
      text: "About 17.6% of merchandise purchased online was returned in 2023 — a markedly higher return rate than in-store.",
      cite: "NRF & Appriss Retail, 2023 Consumer Returns in the Retail Industry",
    },
  ],
  outcomesNote:
    "Figures above are external benchmarks and pilot targets, not guarantees — we validate every number on your own data before you rely on it. Monitoring agents are advisory: they alert and stage, a person acts.",

  // ---------------- CTA ----------------
  ctaTitle: "Start with one workflow. Prove it. Then scale.",
  ctaIntro:
    "We stand up a single workflow on your existing storefront and 3PL, show the audit trail and the outcomes, and expand only once your team trusts it.",
  ctaSteps: [
    {
      n: "01",
      title: "Scope one workflow",
      desc: "Pick the highest-pain workflow — support, returns, fraud screening or cart recovery — and we map it to your stack.",
    },
    {
      n: "02",
      title: "Pilot in your environment",
      desc: "Agents run on your storefront, processor and 3PL with a human in the loop and a full audit trail, in weeks not quarters.",
    },
    {
      n: "03",
      title: "Measure, then expand",
      desc: "Review the outcomes on your own data, then roll the agent team out workflow by workflow and channel by channel.",
    },
  ],

  // ---------------- FAQ (drives FAQPage JSON-LD) ----------------
  faq: [
    {
      q: "Does Rach.Dev replace our storefront platform?",
      a: "No. Rach.Dev is an operations layer that runs on top of your existing storefront (Shopify, WooCommerce, BigCommerce or custom) over their APIs and webhooks. Your store, payment processor and 3PL stay exactly where they are.",
    },
    {
      q: "Is Rach.Dev PCI compliant and does it store card numbers?",
      a: "Rach.Dev is built PCI-aware: agents never store or handle raw card numbers — PCI scope stays with your payment processor. Customer data follows configurable GDPR and CCPA retention and deletion policies, and every action is logged.",
    },
    {
      q: "Do the AI agents issue refunds or clear risky orders on their own?",
      a: "No. Every refund, store credit, chargeback response and high-risk order pauses for a person on your team to approve. The agents draft, stage and route; a human decides. The Fraud / Cart Sentinel is advisory only.",
    },
    {
      q: "Do customers know they're talking to an AI?",
      a: "Yes. Every chat and message opens with a clear AI disclosure, in line with consumer-protection expectations, and a customer can ask for a human at any point.",
    },
    {
      q: "Do the agents work in languages other than English?",
      a: "Yes. Support, order assistance, returns and cart-recovery messages support English and Spanish out of the box, across web chat, SMS, WhatsApp and email.",
    },
  ],
};
