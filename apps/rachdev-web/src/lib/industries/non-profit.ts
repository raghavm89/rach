import type { IndustryConfig } from "./types";

/**
 * Non-Profit (US 501(c)(3)) industry config.
 *
 * Content is authored for a US non-profit / foundation buyer — 501(c)(3)
 * limits, state charitable-solicitation registration, donor consent and
 * opt-out, English + Spanish — and renders entirely in the Rach.Dev design
 * system. Interactions (Control Tower + relay + knowledge) are fully scripted;
 * no live model is called.
 */
export const nonProfitConfig: IndustryConfig = {
  slug: "non-profit",
  vertical: "Non-Profit",
  industrySlug: "non-profit",
  industryName: "Non-Profit",
  icon: "heartHandshake",
  tagline:
    "An agent team for donor engagement, gift compliance, grant drafting, volunteer logistics and lapse monitoring — on your existing CRM, with a staff member in the loop.",
  seoTitle: "Non-Profit AI Agents for Donor & Volunteer Engagement",
  seoDescription:
    "Rach.Dev is an AI operations layer for non-profits — agents for donor engagement, gift acknowledgement & receipting, 501(c)(3) compliance, grant drafting, volunteer coordination and donor-lapse monitoring, on top of your existing CRM (Salesforce NPSP, Bloomerang), with a staff member in the loop on every ask, claim and send.",
  seoKeywords: [
    "nonprofit AI agents",
    "donor engagement automation",
    "volunteer coordination software",
    "grant writing AI",
    "donor retention",
    "501(c)(3) compliance",
    "charitable solicitation registration",
    "Salesforce NPSP automation",
  ],

  // ---------------- HERO ----------------
  eyebrow: "Non-Profit · Agentic Operations Layer",
  h1Lines: ["The AI operations layer", "for your mission."],
  rotorLead: "Put a team of agents on your",
  rotorWords: ["donor outreach.", "receipting.", "grant deadlines.", "volunteer shifts.", "lapse watch."],
  subhead:
    "Rach.Dev runs donor engagement, gift acknowledgement, 501(c)(3) compliance, grant drafting, volunteer coordination and donor-lapse monitoring across the systems you already use — with a staff member in the loop on every solicitation and tax receipt, and a full audit trail on every action.",
  trustRow: [
    "501(c)(3) guardrails by design",
    "Works with your existing CRM",
    "Staff-in-the-loop on every ask",
    "English & Spanish",
  ],
  heroPrimaryCta: { label: "Book a pilot", href: "/contact" },
  heroSecondaryCta: { label: "See the architecture", href: "#architecture" },

  // ---------------- OPERATING PICTURE ----------------
  operateEyebrow: "The operating picture",
  operateTitle: "What an agent team takes off your small team",
  operateIntro:
    "Most of a non-profit's load isn't strategy or relationships — it's coordination, paperwork and chasing. Here's where agents own the busywork so your people can do the mission, mapped to how your org actually runs.",
  domains: [
    {
      icon: "door",
      title: "The Front Door",
      blurb: "Every donor and volunteer captured, thanked and routed — 24/7, in English or Spanish.",
      bullets: [
        "Multi-channel intake (web form, phone, SMS, email, event)",
        "Donor record match & CRM linkage (NPSP / Bloomerang)",
        "Instant, personalized first thank-you within minutes",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "shieldAlert",
      title: "Gift Compliance",
      blurb: "501(c)(3) limits and state-by-state solicitation rules enforced before anything goes out.",
      bullets: [
        "No campaign-intervention or excessive-lobbying language",
        "State charitable-solicitation disclosures inserted by donor state",
        "Quid-pro-quo / tax-deductible-amount language on receipts",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "receipt",
      title: "Acknowledgement & Receipting",
      blurb: "IRS-compliant tax receipts and gratitude that actually lands — staff signs the send.",
      bullets: [
        "Contemporaneous written acknowledgement drafted per gift",
        "Restricted vs. unrestricted and in-kind handled correctly",
        "Impact tied to the specific gift, not a generic blast",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "scroll",
      title: "Grant Development",
      blurb: "Proposals drafted from your real impact data — never a fabricated outcome.",
      bullets: [
        "Deadline tracking across every open opportunity",
        "Narrative + budget drafts pulled from program data",
        "Funder-fit matching and reporting reminders",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "users",
      title: "Volunteer Operations",
      blurb: "Sign-up, scheduling, reminders and the follow-up no-shows never get.",
      bullets: [
        "Shift sign-up, waitlists and confirmations",
        "Pre-event reminders that cut no-show rates",
        "Hours logged and thank-yous sent after every shift",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "chart",
      title: "Impact Reporting",
      blurb: "Donor-ready reports compiled in minutes, not the 20 staff hours it used to take.",
      bullets: [
        "Program metrics pulled from your systems of record",
        "Annual-report and board-deck drafts staged for review",
        "Every figure traceable back to its source",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "calculator",
      title: "Finance & Reconciliation",
      blurb: "Gifts reconciled to the books and grants tracked against their restrictions.",
      bullets: [
        "Platform gifts reconciled to QuickBooks",
        "Restricted-fund tracking and grant-spend alerts",
        "Pledge reminders and recurring-gift recovery",
      ],
      tag: { label: "In your build", tone: "muted" },
    },
    {
      icon: "knowledge",
      title: "Knowledge Layer",
      blurb: "A role-aware assistant grounded only in your approved sources.",
      bullets: [
        "Separate views for donor, volunteer, staff",
        "Every answer cites its source",
        "Hard guardrails — never tax, legal or political advice",
      ],
      tag: { label: "In demo", tone: "live" },
    },
  ],

  // ---------------- CONTROL TOWER ----------------
  towerTitle: "Watch the team run a relationship",
  towerIntro:
    "Pick a case and press play. Watch the agent team run it end to end — a staff member approves every solicitation, receipt and send.",
  subjectNoun: "supporter",
  stages: [
    { key: "door", label: "Front Door", icon: "door" },
    { key: "compliance", label: "Compliance", icon: "shieldAlert" },
    { key: "steward", label: "Stewardship", icon: "heartHandshake" },
    { key: "grant", label: "Grants", icon: "scroll" },
    { key: "decision", label: "Approval", icon: "decision" },
    { key: "coord", label: "Coordination", icon: "coord" },
    { key: "follow", label: "Follow-up", icon: "follow" },
  ],
  scenarios: [
    {
      key: "major-gift",
      tabLabel: "Year-end major gift",
      tabIcon: "gift",
      subjectName: "Robert Daniels · Major donor",
      subjectDesc: "$25,000 online gift, partly restricted",
      channel: "Web · Classy",
      channelIcon: "door",
      steps: [
        {
          agent: "intake",
          stage: "door",
          title: "Gift captured & donor matched",
          detail:
            "Inbound $25,000 gift through Classy matched to an existing major-donor record in Salesforce NPSP; gift designation read (partly restricted to the scholarship fund).",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "compliance",
          title: "Flag: large gift + restriction + new pledge ask",
          detail:
            "Gift size, a restricted designation, and a queued ask above the auto-approve threshold trip the compliance guardrail — routed to a gift officer instead of auto-sending.",
          status: "esc",
          ms: 1300,
        },
        {
          agent: "scribe",
          stage: "steward",
          title: "Receipt + thank-you drafted",
          detail:
            "Contemporaneous written acknowledgement drafted with the tax-deductible amount, restricted-fund language, and a personal impact note tied to the scholarship program.",
          status: "ok",
          ms: 1200,
        },
        {
          agent: "scribe",
          stage: "decision",
          title: "Tax receipt approved by the gift officer",
          detail:
            "The development director reviews the IRS-compliant receipt and the restricted-fund handling, then approves the send — Rach.Dev never issues a tax receipt on its own.",
          status: "gate",
          gateBy: "Karen Mitchell · Dev. Director",
          ms: 1300,
        },
        {
          agent: "coord",
          stage: "coord",
          title: "Stewardship plan staged",
          detail:
            "A 90-day stewardship sequence and an in-person thank-you task assigned to the gift officer; restricted-fund tracking opened in QuickBooks.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "monitor",
          stage: "follow",
          title: "Lapse watch armed for this donor",
          detail:
            "Donor-Lapse Sentinel sets a renewal window from this gift's date and watches for a missing year-end re-gift — advisory alerts wired to the gift officer.",
          status: "ok",
          ms: 1100,
        },
      ],
    },
    {
      key: "volunteer-sms",
      tabLabel: "After-hours volunteer text",
      tabIcon: "message",
      subjectName: "María García · Volunteer",
      subjectDesc: "After-hours text in Spanish about a Saturday shift",
      channel: "SMS · After hours",
      channelIcon: "message",
      steps: [
        {
          agent: "intake",
          stage: "door",
          title: "Spanish text understood & answered",
          detail:
            "Inbound SMS in Spanish at 10:20 PM recognized; volunteer identified and replied to in her own language about Saturday's food-bank shift.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "compliance",
          title: "Consent & preferences checked",
          detail:
            "Opt-in confirmed, SMS communication preference honored, and no solicitation language attached — this is an operational, not a fundraising, message.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "knowledge",
          stage: "steward",
          title: "Grounded answer, no off-limits advice",
          detail:
            "Answered her question about parking and what to bring from approved volunteer materials, with sources — and did not give tax or legal guidance about her hours.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "coord",
          stage: "decision",
          title: "Shift swap held — coordinator confirms",
          detail:
            "A swap into the morning shift is staged; the volunteer coordinator approves the roster change before it is promised.",
          status: "gate",
          gateBy: "Dana Whitfield · Vol. Coordinator",
          ms: 1200,
        },
        {
          agent: "intake",
          stage: "follow",
          title: "Confirmed in Spanish + reminder set",
          detail:
            "Sent the confirmed Saturday shift details in Spanish with a reminder the night before, and logged the interaction to her record.",
          status: "ok",
          ms: 1000,
        },
      ],
    },
    {
      key: "grant-deadline",
      tabLabel: "Grant deadline",
      tabIcon: "scroll",
      subjectName: "Hartwell Family Foundation",
      subjectDesc: "Youth-program grant — proposal due in 6 days",
      channel: "Email · Grant portal",
      channelIcon: "mail",
      steps: [
        {
          agent: "intake",
          stage: "door",
          title: "Opportunity logged & funder matched",
          detail:
            "Grant deadline detected from the funder email and logged against the youth-program portfolio; prior-award history surfaced from the CRM.",
          status: "ok",
          ms: 1000,
        },
        {
          agent: "triage",
          stage: "compliance",
          title: "Eligibility & restrictions confirmed",
          detail:
            "501(c)(3) status, funder geographic and program restrictions, and lobbying limits checked — eligible, no prohibited activities in scope.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "scribe",
          stage: "grant",
          title: "Narrative + budget drafted from real data",
          detail:
            "Proposal narrative and budget drafted from actual program outcomes and the budget template — no outcome is invented; gaps are flagged for staff.",
          status: "ok",
          ms: 1300,
        },
        {
          agent: "scribe",
          stage: "decision",
          title: "Proposal approved before submission",
          detail:
            "The program director reviews every claimed outcome against the source data and approves the proposal — Rach.Dev never submits a grant on its own.",
          status: "gate",
          gateBy: "Owen Brennan · Program Director",
          ms: 1300,
        },
        {
          agent: "coord",
          stage: "coord",
          title: "Submission + reporting tasks staged",
          detail:
            "Submission checklist staged, portal fields pre-filled, and the post-award reporting deadlines pre-scheduled so the next one isn't missed.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "revenue",
          stage: "follow",
          title: "Pipeline & restricted-fund tracking updated",
          detail:
            "Grant added to the revenue pipeline with its restriction, and a restricted-fund record opened in QuickBooks for spend tracking if awarded.",
          status: "ok",
          ms: 1000,
        },
      ],
    },
  ],
  gateNote:
    "Every solicitation, tax receipt and grant submission waits for a staff member. Rach.Dev drafts, stages and routes — a human approves.",
  completeToast: "Journey complete — every ask, receipt and send was staff-approved",

  // ---------------- ROSTER (relay) ----------------
  rosterTitle: "Seven specialists, one conductor",
  rosterIntro:
    "Each agent owns one job and hands the next a complete, structured context. Atlas routes the work, enforces the human-in-the-loop gates, and writes every action to an audit log.",
  rosterClickNote: "Click Ava below — the full donor-to-stewardship workflow plays out automatically.",
  orchestratorName: "Atlas",
  orchestratorBlurb:
    "Atlas is the orchestrator. It routes each case to the right specialist, carries shared donor and volunteer context between them, pauses for staff approval on every solicitation, tax receipt and submission, and records a complete, timestamped audit trail.",
  relayTriggerAgentKey: "intake",
  relayCompleteToast: "Workflow complete — all agents processed Robert Daniels's gift",
  agents: [
    {
      key: "intake",
      name: "Ava",
      role: "Donor & Volunteer Engagement",
      icon: "intake",
      blurb:
        "The front door. Captures every donor and volunteer across web form, phone, SMS, email and event, matches them to your CRM, and sends a warm, personal first thank-you — 24/7, in English or Spanish.",
      tags: ["Multi-channel intake", "CRM match (NPSP / Bloomerang)", "EN / ES"],
      pipeSub: "Engagement",
      workMs: 2000,
      voice: {
        listeningTitle: "Listening…",
        listeningSub: "Capturing a donor gift by voice",
        doneTitle: "Intake complete",
        doneSub: "6 fields captured · handing off to the team…",
        handoffToast: "Ava done — watch the team pick it up",
        fields: [
          { label: "Donor", value: "Robert Daniels · Major donor" },
          { label: "Gift", value: "$25,000 online via Classy" },
          { label: "Designation", value: "Partly restricted — scholarship fund" },
          { label: "Identity", value: "Matched to NPSP record (verified)", ok: true },
          { label: "Consent", value: "Opt-in confirmed — email + mail", ok: true },
          { label: "Channel", value: "Web · English" },
        ],
      },
    },
    {
      key: "triage",
      name: "Marcus",
      role: "501(c)(3) & Solicitation Compliance",
      icon: "shieldAlert",
      blurb:
        "Compliance & risk. Screens every outbound message and gift against 501(c)(3) limits and state charitable-solicitation rules, and escalates large, restricted or sensitive gifts to a gift officer — never sending a non-compliant ask.",
      tags: ["501(c)(3) limits", "State solicitation rules", "Escalation"],
      pipeSub: "Compliance",
      workMs: 2100,
      flow: [
        {
          fromLabel: "Context from Ava",
          chips: ["Robert Daniels · $25k", "Restricted — scholarship", "Donor state: TX"],
        },
        {
          steps: [
            { text: "No campaign-intervention or excessive-lobbying language", kind: "ok" },
            { text: "Texas solicitation disclosure inserted for donor state", kind: "ok" },
            { text: "Large + restricted gift over threshold → gift officer", kind: "esc" },
          ],
          note: "Compliance is a hard gate. Anything regulated stops here for a human, not the donor.",
        },
      ],
    },
    {
      key: "scribe",
      name: "Nora",
      role: "Acknowledgement & Grant Drafting",
      icon: "scribe",
      blurb:
        "The writer. Drafts IRS-compliant tax receipts, personal thank-yous, and grant proposals — every outcome pulled from your real impact data, never invented, and always left for a human to sign.",
      tags: ["IRS-compliant receipts", "Grant drafts", "Grounded in real data"],
      pipeSub: "Drafting",
      workMs: 2200,
      flow: [
        {
          fromLabel: "Context from Marcus",
          chips: ["Tax-deductible amount", "Restricted-fund language", "Scholarship impact"],
        },
        {
          steps: [
            { text: "Contemporaneous written acknowledgement drafted per IRS rules", kind: "ok" },
            { text: "Personal impact note tied to this specific gift", kind: "ok" },
            { text: "Receipt staged for gift-officer signature — never auto-sent", kind: "ok" },
          ],
          note: "Draft only. Tax receipts and grants are sent solely after a staff member signs.",
        },
      ],
    },
    {
      key: "coord",
      name: "Owen",
      role: "Volunteer & Stewardship Coordination",
      icon: "coord",
      blurb:
        "Coordination. Runs volunteer sign-up, shifts and reminders, stages donor stewardship sequences, and keeps supporters on track with timely, preference-aware nudges.",
      tags: ["Volunteer scheduling", "Stewardship sequences", "Reminders"],
      pipeSub: "Coord",
      workMs: 1900,
      flow: [
        {
          fromLabel: "Context from Nora",
          chips: ["90-day stewardship", "In-person thank-you", "Restricted-fund tracking"],
        },
        {
          steps: [
            { text: "Stewardship sequence staged; thank-you task assigned to officer", kind: "ok" },
            { text: "Volunteer shifts confirmed and pre-event reminders scheduled", kind: "ok" },
            { text: "Communication preferences and opt-outs honored on every send", kind: "ok" },
          ],
        },
      ],
    },
    {
      key: "revenue",
      name: "Riley",
      role: "Gifts, Grants & Reconciliation",
      icon: "revenue",
      blurb:
        "Finance & pipeline. Reconciles platform gifts to QuickBooks, tracks grants and restricted funds against their spend, and recovers lapsed recurring gifts and unfulfilled pledges.",
      tags: ["Gift reconciliation", "Restricted-fund tracking", "Pledge recovery"],
      pipeSub: "Finance",
      workMs: 2000,
      flow: [
        {
          fromLabel: "Context from Owen",
          chips: ["Classy → QuickBooks", "Restricted: scholarship", "Pledge: balance due"],
        },
        {
          steps: [
            { text: "Gift reconciled from Classy to the books in QuickBooks", kind: "ok" },
            { text: "Restricted-fund record opened and tagged to the gift", kind: "ok" },
            { text: "Recurring-gift recovery and pledge reminders scheduled", kind: "ok" },
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
        "The role-aware knowledge assistant. Answers donors, volunteers and staff from your approved sources only — every answer cited, and never tax, legal or political advice.",
      tags: ["Role-aware", "Cited answers", "Never tax/legal advice"],
      pipeSub: "Knowledge",
      workMs: 1900,
      flow: [
        {
          fromLabel: "Context from Riley",
          chips: ["Donor view", "Approved sources only", "EN / ES"],
        },
        {
          steps: [
            { text: "Answered donor and volunteer questions from approved materials", kind: "ok" },
            { text: "Every answer carried its source citation", kind: "ok" },
            { text: "Tax-deductibility advice → handed to a professional, not answered", kind: "esc" },
          ],
          note: "Iris informs. It never gives tax, legal or political advice, and never overrides staff.",
        },
      ],
    },
    {
      key: "monitor",
      name: "Hope",
      role: "Donor-Lapse Sentinel",
      icon: "monitor",
      blurb:
        "The Donor-Lapse Sentinel. Always on, reading every donor, grant and volunteer signal — flagging supporters about to lapse, grant deadlines closing in, and volunteer shifts at risk of no-shows, and staging the response for staff.",
      tags: ["Always-on monitor", "Lapse & deadline early-warning", "Advisory only"],
      pipeSub: "Sentinel",
      workMs: 2400,
      live: { label: "Live · Sentinel" },
      flow: [
        {
          fromLabel: "Context from the team",
          chips: ["Year-end window open", "Grant deadlines: 3 near", "Saturday shift: under-filled"],
        },
        {
          fromLabel: "How Hope calibrates for this org",
          steps: [
            { text: "Baselines each donor's own giving cadence, not a generic clock", kind: "ok" },
            { text: "Tightens lapse windows for major and recurring donors", kind: "ok" },
            { text: "Suppresses noise so staff see signal, not a flood of alerts", kind: "ok" },
          ],
        },
        {
          fromLabel: "What Hope watches in real time",
          chips: ["Giving cadence", "Recurring failures", "Grant deadlines", "Pledge balances", "Shift fill rates", "Engagement decay"],
          steps: [
            { text: "Lapse risk — major donor past their usual year-end re-gift", kind: "esc" },
            { text: "Recurring gift failed — card declined, donor about to churn", kind: "esc" },
            { text: "Grant deadline — application due in under 7 days, draft not started", kind: "esc" },
            { text: "Reporting deadline — funder report due, no submission staged", kind: "esc" },
            { text: "Volunteer shift — under-filled with no-show risk this weekend", kind: "esc" },
            { text: "Engagement decay — opens and gifts trending down for a segment", kind: "esc" },
          ],
          note: "Hope is advisory. It alerts and stages a draft — a staff member decides and acts. Every alert is logged with the signal that triggered it.",
        },
      ],
    },
  ],

  // ---------------- ARCHITECTURE ----------------
  archTitle: "One layer over the systems you already run",
  archIntro:
    "Rach.Dev sits on top of your CRM and existing tools — orchestrating agents, enforcing governance, and keeping a staff member in the loop. No rip-and-replace, and a non-profit discount for qualifying 501(c)(3) orgs.",
  archLayers: [
    {
      n: "Layer 4",
      title: "Human-in-the-loop",
      icon: "decision",
      body: "Every high-stakes action — solicitations, tax receipts, grant submissions — pauses for a staff member to approve. Agents draft and stage; people decide.",
      pills: ["Approval gates", "Staff sign-off", "Role-based access"],
    },
    {
      n: "Layer 3",
      title: "Governance & audit",
      icon: "shield",
      body: "501(c)(3) and state-solicitation controls, donor consent and opt-out enforcement, and a complete, timestamped audit trail on every action and every data touch.",
      pills: ["501(c)(3) guardrails", "Full audit log", "Consent & opt-out", "Source citations"],
    },
    {
      n: "Layer 2",
      title: "Agent orchestration",
      icon: "orchestrator",
      body: "Atlas routes each case to the right specialist, carries shared donor and volunteer context between agents, and coordinates hand-offs end to end.",
      pills: ["Routing & hand-off", "Shared context", "Escalation paths"],
    },
    {
      n: "Layer 1",
      title: "Integration",
      icon: "plug",
      body: "Bidirectional connectors to your CRM, giving platforms, accounting and email tools over the standards your systems already speak.",
      pills: ["CRM APIs", "Webhooks", "Email / SMS gateways"],
    },
  ],
  archBaseLabel: "Works with the systems you already run",
  archBaseSystems: [
    "Salesforce NPSP",
    "Bloomerang",
    "Classy",
    "Givebutter",
    "QuickBooks",
    "Mailchimp",
    "Twilio",
    "DonorPerfect",
    "Stripe",
    "Eventbrite",
  ],

  // ---------------- KNOWLEDGE ----------------
  knowledgeTitle: "A knowledge layer that knows its limits",
  knowledgeIntro:
    "Iris answers donors, volunteers and staff from your approved sources only. Every answer is cited — and a tax, legal or political question is always handed to a professional, never answered.",
  knowledgeAgentName: "Iris",
  knowledgeViewLabel: "Donor view",
  knowledgeGreeting:
    "Hi, I'm Iris. Ask me about your giving, your tax receipt, volunteer shifts or where your gift went — I'll always cite my source.",
  knowledgeDisclaimer:
    "Iris provides information only — never tax, legal, financial or political advice. Anything requiring a professional is routed to a qualified human.",
  knowledge: [
    {
      q: "Where did my year-end gift go?",
      a: "Thank you again, Robert. Your $25,000 December gift was designated to the scholarship fund, which this year supported 41 students with tuition assistance. You'll find the restricted-fund breakdown in your acknowledgement letter, and we can send a deeper impact summary anytime — just reply here.",
      src: ["CRM gift record", "Scholarship program report", "Acknowledgement letter"],
    },
    {
      q: "¿Cómo puedo obtener mi recibo de impuestos?",
      a: "Su recibo de donación deducible de impuestos se envió por correo electrónico al confirmarse su regalo, y siempre puede pedir otra copia aquí. El recibo indica el monto deducible. Para preguntas sobre cómo aplicarlo en su declaración, le recomendamos consultar a un profesional de impuestos.",
      src: ["Acknowledgement system", "IRS substantiation policy"],
    },
    {
      q: "How much of my donation can I deduct, and how should I report it on my taxes?",
      a: "I can tell you the deductible amount shown on your receipt, but I can't give tax advice or tell you how to report it — that's a question for a tax professional, and I've flagged it for our staff to follow up with the right resources. Your written acknowledgement has the figures the IRS asks for.",
      src: ["Acknowledgement record", "Staff routing"],
    },
  ],

  // ---------------- GOVERNANCE ----------------
  governanceTitle: "Governance, not just guardrails",
  governanceIntro:
    "The controls that let a non-profit board actually approve deploying agents — enforced in the system, not promised on a slide.",
  guarantees: [
    {
      title: "Staff in the loop",
      desc: "Every solicitation, tax receipt and grant submission waits for a staff member to approve. No agent makes an ask or issues a receipt on its own.",
    },
    {
      title: "Complete audit trail",
      desc: "Every action, hand-off and data access is logged with a timestamp, the agent, the source and the approver — exportable for your board and auditors.",
    },
    {
      title: "501(c)(3) & consent by design",
      desc: "Campaign-intervention and excessive-lobbying language blocked, state solicitation disclosures inserted by donor state, and donor opt-outs and preferences enforced on every send.",
    },
    {
      title: "Grounded with sources",
      desc: "Answers and impact figures come only from your approved data and cite their source. No open-web guessing, no invented outcomes in a grant proposal.",
    },
    {
      title: "No vendor lock-in",
      desc: "Standards-based connectors to your CRM and tools, and your donor data stays yours. Turn an agent off and your systems keep running.",
    },
  ],
  auditTitle: "Live audit log",
  auditIntro: "A sample of what every action looks like on the record.",
  auditLines: [
    { ts: "22:21:09", text: "Inbound SMS (es) received & answered — volunteer #1182", tag: "ok", tagLabel: "Logged" },
    { ts: "23:58:44", text: "Gift captured: $25,000 via Classy — matched to NPSP", tag: "ok", tagLabel: "Matched" },
    { ts: "00:01:12", text: "Donor data accessed: gift history (consent on file)", tag: "mod", tagLabel: "Consent" },
    { ts: "00:02:36", text: "Tax receipt drafted — restricted fund, awaiting sign-off", tag: "mod", tagLabel: "Pending" },
    { ts: "00:04:50", text: "Receipt approved by Karen Mitchell, Dev. Director", tag: "ok", tagLabel: "Approved" },
    { ts: "09:30:18", text: "Lapse risk (major donor, year-end) — gift officer alerted", tag: "esc", tagLabel: "Escalated" },
  ],

  // ---------------- OUTCOMES ----------------
  outcomesTitle: "What changes when agents own the busywork",
  outcomesIntro: "Directional outcomes our pilots target — validated on your own data, never assumed.",
  outcomes: [
    {
      value: "24/7",
      label: "Coverage, every channel",
      desc: "Donors and volunteers answered around the clock, in English and Spanish — every gift thanked within minutes, not days.",
    },
    {
      value: "Minutes",
      label: "From gift to receipt",
      desc: "Matching, compliance and a drafted IRS-compliant receipt done before a staff member even opens their inbox.",
    },
    {
      value: "Fewer",
      label: "Missed deadlines",
      desc: "Grant and reporting deadlines tracked and drafts staged early — no proposal rushed at the last minute.",
    },
    {
      value: "Hours back",
      label: "For your small team",
      desc: "Less manual receipting, reminding and report-building, more time on relationships and the mission.",
    },
  ],
  benchmarks: [
    {
      text: "Across North American non-profits, overall donor retention has hovered around 45% — meaning organizations lose more than half of their donors year to year.",
      cite: "Fundraising Effectiveness Project (AFP), 2023 data",
    },
    {
      text: "First-time (new) donor retention runs only around 13–14%, making the crucial second gift the sector's hardest and most valuable conversion.",
      cite: "Fundraising Effectiveness Project (AFP & GivingTuesday Data Commons), 2023 data",
    },
    {
      text: "Volunteer time is worth roughly $34.79 per hour — so cutting no-shows and filling shifts protects real, quantifiable value for a non-profit.",
      cite: "Independent Sector, Value of Volunteer Time (2024)",
    },
  ],
  outcomesNote:
    "Figures above are external benchmarks and pilot targets, not guarantees — we validate every number on your own data before you rely on it. Monitoring agents are advisory: they alert and stage, a staff member acts.",

  // ---------------- CTA ----------------
  ctaTitle: "Start with one workflow. Prove it. Then scale.",
  ctaIntro:
    "We stand up a single workflow on your existing CRM, show the audit trail and the outcomes, and expand only once your team trusts it — with a non-profit discount for qualifying 501(c)(3) organizations.",
  ctaSteps: [
    {
      n: "01",
      title: "Scope one workflow",
      desc: "Pick the highest-pain workflow — gift acknowledgement, lapse recovery or grant deadlines — and we map it to your systems.",
    },
    {
      n: "02",
      title: "Pilot in your environment",
      desc: "Agents run on your CRM with a staff member in the loop and a full audit trail, in weeks not quarters.",
    },
    {
      n: "03",
      title: "Measure, then expand",
      desc: "Review the outcomes on your own data, then roll the agent team out program by program.",
    },
  ],

  // ---------------- FAQ (drives FAQPage JSON-LD) ----------------
  faq: [
    {
      q: "Does Rach.Dev replace our donor CRM?",
      a: "No. Rach.Dev is an operations layer that runs on top of your existing CRM (Salesforce NPSP, Bloomerang and others) and your giving platforms (Classy, Givebutter). Your systems of record stay exactly where they are.",
    },
    {
      q: "How do you keep agents within 501(c)(3) rules?",
      a: "A dedicated compliance agent screens every outbound message against 501(c)(3) limits — no campaign intervention, no excessive lobbying — and inserts the correct state charitable-solicitation disclosures by donor state. Anything regulated escalates to staff before it ever reaches a donor.",
    },
    {
      q: "Do the AI agents send tax receipts or ask for money on their own?",
      a: "No. Every solicitation, tax receipt and grant submission pauses for a staff member to approve. The agents draft, stage and route; a human decides. Monitoring agents are advisory only.",
    },
    {
      q: "Will it write grant proposals with made-up outcomes?",
      a: "No. The drafting agent pulls every outcome and figure from your real program and impact data, flags any gaps for staff, and stages the proposal for a program director to review and approve before submission.",
    },
    {
      q: "Do the agents work in languages other than English?",
      a: "Yes. Donor engagement, volunteer reminders and supporter answers support English and Spanish out of the box, across web, email, SMS and phone.",
    },
  ],
};
