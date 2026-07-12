import type { IndustryConfig } from "./types";

/**
 * Insurance (US P&C + life/health carrier and agency) industry config.
 *
 * Content is authored for a US insurance buyer — state DOI regulation, the NAIC
 * Model Bulletin on the Use of AI Systems by Insurers, fair-claims-practices
 * rules, English + Spanish — and renders entirely in the Rach.Dev design system.
 * Interactions (Control Tower + relay + knowledge) are fully scripted; no live
 * model is called.
 */
export const insuranceConfig: IndustryConfig = {
  slug: "insurance",
  vertical: "Insurance",
  industrySlug: "insurance",
  industryName: "Insurance",
  icon: "shield",
  tagline:
    "An agent team for FNOL & quote intake, coverage triage, claims documentation, renewals and fraud/lapse monitoring — on your policy admin and claims platforms, with a licensed human in the loop.",
  seoTitle: "Insurance AI Agents for Carriers & Agencies",
  seoDescription:
    "Rach.Dev is an AI operations layer for insurance carriers and agencies — agents for claims & quote intake, coverage triage, FNOL documentation, renewals, and fraud/lapse monitoring, on top of your policy admin system, claims platform, Guidewire and CRM, with a licensed adjuster or producer in the loop and state-DOI / NAIC guardrails on every action.",
  seoKeywords: [
    "insurance AI agents",
    "FNOL automation",
    "claims intake automation",
    "AI for insurance carriers",
    "policy renewal automation",
    "insurance fraud detection AI",
    "NAIC AI model bulletin",
    "Guidewire automation",
  ],

  // ---------------- HERO ----------------
  eyebrow: "Insurance · Agentic Operations Layer",
  h1Lines: ["The AI operations layer", "for your book of business."],
  rotorLead: "Put a team of agents on your",
  rotorWords: ["FNOL intake.", "quotes.", "claims docs.", "renewals.", "fraud watch."],
  subhead:
    "Rach.Dev runs claims & quote intake, coverage triage, FNOL documentation, renewals and fraud/lapse monitoring across the systems you already use — with a licensed adjuster or producer in the loop on every coverage decision, and a full audit trail on every action.",
  trustRow: [
    "State-DOI & NAIC-aligned by design",
    "Works with your policy admin & claims platform",
    "Licensed-human-in-the-loop",
    "English & Spanish",
  ],
  heroPrimaryCta: { label: "Book a pilot", href: "/contact" },
  heroSecondaryCta: { label: "See the architecture", href: "#architecture" },

  // ---------------- OPERATING PICTURE ----------------
  operateEyebrow: "The operating picture",
  operateTitle: "What an agent team takes off your floor",
  operateIntro:
    "Most of a carrier's load isn't coverage judgement — it's intake, paperwork, chasing documents and renewal outreach. Here's where agents own the busywork, mapped to how your book actually runs.",
  domains: [
    {
      icon: "door",
      title: "The Front Door",
      blurb: "Every FNOL, quote and policy question captured, qualified and routed — 24/7, in English or Spanish.",
      bullets: [
        "Multi-channel intake (phone, SMS, WhatsApp, web, agent portal)",
        "Policy match & policyholder identity verification",
        "Coverage-in-force and effective-date confirmation",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "triage",
      title: "Coverage Triage",
      blurb: "Severity and coverage scoring with explicit red-flag detection and instant routing.",
      bullets: [
        "Routes by line of business, severity and complexity",
        "Total-loss, injury and SIU red-flags page a licensed adjuster",
        "Matches to the right adjuster or producer by license & state",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "scribe",
      title: "Claim & Quote File",
      blurb: "FNOL write-ups, photo/document capture and cited policy references — the adjuster decides.",
      bullets: [
        "Loss narrative drafted from the policyholder's own words",
        "Photo, estimate and document intake with completeness checks",
        "Coverage citations pulled from the actual policy form",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "diagnostics",
      title: "Evidence & Verification",
      blurb: "The full loop — third-party data ordered and SIU referrals escalated the moment a flag trips.",
      bullets: [
        "Police report, ISO ClaimSearch and prior-loss lookups",
        "Damage estimate / appraisal ordering and routing",
        "SIU referral staged when fraud indicators surface",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "calendar",
      title: "Servicing & Coordination",
      blurb: "Endorsements, payments, status updates and the renewals customers never hear about.",
      bullets: [
        "Endorsements, ID cards and billing changes staged for sign-off",
        "Claim status updates and rental / repair coordination",
        "Renewal outreach & lapse-prevention nudges (EN / ES)",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "revenue",
      title: "Billing & Payments",
      blurb: "The fastest ROI for a CFO: clean every premium transaction, settle every covered claim faster.",
      bullets: [
        "Premium quote, bind-ready packet and invoice generation",
        "Claim payment / reserve recommendations for adjuster sign-off",
        "Subrogation and salvage flags before the file closes",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "users",
      title: "Back-Office & Compliance",
      blurb: "Producer licensing, DOI complaints and the regulatory filings no one wants to do.",
      bullets: [
        "Producer appointment & license-status tracking",
        "State DOI complaint logging and timeline tracking",
        "Required disclosures and AI-interaction notices by state",
      ],
      tag: { label: "In your build", tone: "muted" },
    },
    {
      icon: "knowledge",
      title: "Knowledge Layer",
      blurb: "A role-aware assistant grounded only in your approved policy forms and bulletins.",
      bullets: [
        "Separate views for policyholder, producer and adjuster",
        "Every answer cites the policy section or bulletin",
        "Hard guardrails — never a binding coverage determination",
      ],
      tag: { label: "In demo", tone: "live" },
    },
  ],

  // ---------------- CONTROL TOWER ----------------
  towerTitle: "Watch the team run a claim",
  towerIntro:
    "Pick a case and press play. Watch the agent team run it end to end — a licensed adjuster or producer approves every coverage decision.",
  subjectNoun: "policyholder",
  stages: [
    { key: "door", label: "Front Door", icon: "door" },
    { key: "triage", label: "Triage", icon: "triage" },
    { key: "file", label: "File Build", icon: "scribe" },
    { key: "evidence", label: "Evidence", icon: "diagnostics" },
    { key: "decision", label: "Decision", icon: "decision" },
    { key: "service", label: "Servicing", icon: "coord" },
    { key: "follow", label: "Follow-up", icon: "follow" },
  ],
  scenarios: [
    {
      key: "auto-fnol",
      tabLabel: "Auto FNOL",
      tabIcon: "car",
      subjectName: "Robert Daniels · Policy AU-48213",
      subjectDesc: "Rear-end collision, drivable — first notice of loss",
      channel: "Phone · FNOL line",
      channelIcon: "phone",
      steps: [
        {
          agent: "intake",
          stage: "door",
          title: "Policyholder verified & FNOL opened",
          detail:
            "Matched to active auto policy, coverage-in-force and deductible confirmed, a new claim opened in seconds.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "triage",
          title: "Coverage triage — collision, no injuries",
          detail:
            "Drivable two-car collision, comprehensive + collision in force, no injuries reported → standard material-damage track.",
          status: "ok",
          ms: 1200,
        },
        {
          agent: "scribe",
          stage: "file",
          title: "Loss narrative & photos captured",
          detail:
            "Recorded the policyholder's account, collected damage photos and the other party's info, and cited the applicable coverage form.",
          status: "ok",
          ms: 1200,
        },
        {
          agent: "coord",
          stage: "evidence",
          title: "Estimate & prior-loss ordered",
          detail: "Appraisal scheduled at a network shop; ISO ClaimSearch and prior-loss lookups requested and routed.",
          status: "ok",
          ms: 1200,
        },
        {
          agent: "triage",
          stage: "decision",
          title: "Coverage & reserve confirmed by the adjuster",
          detail:
            "Adjuster confirms coverage applies and approves the opening reserve — Rach.Dev never determines coverage alone.",
          status: "gate",
          gateBy: "Alan Reyes · Licensed Adjuster",
          ms: 1300,
        },
        {
          agent: "coord",
          stage: "service",
          title: "Rental & repair coordinated",
          detail:
            "Rental authorized under the policy limit, repair appointment booked, and the policyholder texted a tracking link.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "revenue",
          stage: "follow",
          title: "Payment staged & subrogation flagged",
          detail:
            "Payment packet prepared for adjuster release, deductible netted, and a subrogation flag opened against the at-fault carrier.",
          status: "ok",
          ms: 1100,
        },
      ],
    },
    {
      key: "homeowner-suspect",
      tabLabel: "Property — SIU flag",
      tabIcon: "alert",
      subjectName: "Karen Mitchell · Policy HO-90147",
      subjectDesc: "Water-damage claim with fraud indicators",
      channel: "Web · Claims portal",
      channelIcon: "file",
      steps: [
        {
          agent: "intake",
          stage: "door",
          title: "Homeowner claim opened & verified",
          detail:
            "Matched to active HO-3 policy, coverage and deductible confirmed, water-damage claim opened from the portal submission.",
          status: "ok",
          ms: 1000,
        },
        {
          agent: "scribe",
          stage: "file",
          title: "Loss narrative & documents captured",
          detail:
            "Collected the loss description, photos and a contractor estimate; cited the policy's water-damage and exclusion sections.",
          status: "ok",
          ms: 1200,
        },
        {
          agent: "diagnostics",
          stage: "evidence",
          title: "Fraud indicators detected — SIU referral",
          detail:
            "Recent coverage increase, prior similar loss, and an estimate inconsistent with the photos → Claims Sentinel flags and stages an SIU referral.",
          status: "esc",
          ms: 1300,
        },
        {
          agent: "triage",
          stage: "decision",
          title: "SIU referral approved by the manager",
          detail:
            "Claims manager reviews the indicators and approves the SIU referral and an Examination Under Oath request — a human owns this call.",
          status: "gate",
          gateBy: "Dana Whitfield · SIU Manager",
          ms: 1300,
        },
        {
          agent: "coord",
          stage: "service",
          title: "Acknowledgement sent within statute",
          detail:
            "Sent the state-required acknowledgement and reservation-of-rights, with the next steps and a fair-claims-practices timeline.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "revenue",
          stage: "follow",
          title: "Reserve held pending investigation",
          detail:
            "Reserve set to investigative status, payment held, and the file routed to SIU with a complete, timestamped record.",
          status: "ok",
          ms: 1100,
        },
      ],
    },
    {
      key: "renewal-sms",
      tabLabel: "After-hours renewal",
      tabIcon: "message",
      subjectName: "María García · Policy AU-77410",
      subjectDesc: "Lapse-risk renewal, after-hours text in Spanish",
      channel: "SMS · After hours",
      channelIcon: "message",
      steps: [
        {
          agent: "monitor",
          stage: "door",
          title: "Lapse risk flagged before expiration",
          detail:
            "Lapse Sentinel flags an auto policy 9 days from expiration with no payment on file and a recent rate change — high lapse risk.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "intake",
          stage: "triage",
          title: "Spanish text understood & answered",
          detail:
            "Reached out by SMS in Spanish at 9:20 PM; the policyholder replied, was identified, and was answered in her own language.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "knowledge",
          stage: "file",
          title: "Grounded answer, no coverage opinion",
          detail:
            "Explained the premium change and renewal options from her actual policy and the rate filing, with sources — and did not render a binding coverage opinion.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "coord",
          stage: "decision",
          title: "Renewal terms confirmed by the producer",
          detail:
            "A licensed producer reviews and approves the renewal offer and any coverage change before it is presented to her.",
          status: "gate",
          gateBy: "Priya Shah · Licensed Producer",
          ms: 1200,
        },
        {
          agent: "intake",
          stage: "follow",
          title: "Renewal confirmed in Spanish + autopay",
          detail:
            "Sent the confirmed renewal, ID cards and an autopay link in Spanish, with a reminder before the effective date — lapse avoided.",
          status: "ok",
          ms: 1000,
        },
      ],
    },
  ],
  gateNote:
    "Every coverage decision waits for a licensed human. Rach.Dev drafts, stages and routes — an adjuster or producer approves.",
  completeToast: "Journey complete — every coverage decision was approved by a licensed human",

  // ---------------- ROSTER (relay) ----------------
  rosterTitle: "Seven specialists, one conductor",
  rosterIntro:
    "Each agent owns one job and hands the next a complete, structured file. Atlas routes the work, enforces the human-in-the-loop gates, and writes every action to an audit log.",
  rosterClickNote: "Click Ava below — the full FNOL-to-settlement workflow plays out automatically.",
  orchestratorName: "Atlas",
  orchestratorBlurb:
    "Atlas is the orchestrator. It routes each claim or quote to the right specialist, carries the shared policyholder and policy context between them, pauses for a licensed adjuster or producer to approve every coverage decision, and records a complete, timestamped audit trail.",
  relayTriggerAgentKey: "intake",
  relayCompleteToast: "Workflow complete — all agents processed Robert Daniels's auto FNOL",
  agents: [
    {
      key: "intake",
      name: "Ava",
      role: "Front Desk · Claims & Quote Intake",
      icon: "intake",
      blurb:
        "The front door. Captures every FNOL, quote and policy question across phone, SMS, WhatsApp, web and the agent portal, verifies the policyholder and coverage-in-force, and opens a clean file — 24/7, in English or Spanish.",
      tags: ["Multi-channel intake", "Policy & coverage verification", "EN / ES"],
      pipeSub: "Intake",
      workMs: 2000,
      voice: {
        listeningTitle: "Listening…",
        listeningSub: "Capturing first notice of loss by voice",
        doneTitle: "FNOL complete",
        doneSub: "6 fields captured · handing off to the team…",
        handoffToast: "Ava done — watch the team pick it up",
        fields: [
          { label: "Policyholder", value: "Robert Daniels" },
          { label: "Loss reported", value: "Rear-end collision, vehicle drivable, no injuries" },
          { label: "Line of business", value: "Personal auto · collision + comprehensive" },
          { label: "Policy", value: "AU-48213 matched — coverage in force", ok: true },
          { label: "Identity", value: "Verified — DOB + last 4 on file", ok: true },
          { label: "Channel", value: "Phone · English" },
        ],
      },
    },
    {
      key: "triage",
      name: "Marcus",
      role: "Coverage Triage & Safety",
      icon: "triage",
      blurb:
        "Coverage triage. Scores severity and coverage, watches for injury, total-loss and SIU red flags, and routes straight to the right licensed adjuster — never sitting on a high-exposure claim.",
      tags: ["Severity & coverage scoring", "Red-flag detection", "Adjuster routing"],
      pipeSub: "Triage",
      workMs: 2100,
      flow: [
        {
          fromLabel: "Context from Ava",
          chips: ["Robert Daniels · AU-48213", "Auto collision", "No injuries · drivable"],
        },
        {
          steps: [
            { text: "Severity scored — material damage, standard complexity", kind: "ok" },
            { text: "Red-flag scan clear (no injury, no total-loss, no SIU hit)", kind: "ok" },
            { text: "Routed to the licensed adjuster for the policyholder's state", kind: "ok" },
          ],
        },
      ],
    },
    {
      key: "scribe",
      name: "Nora",
      role: "Claim & Quote File",
      icon: "scribe",
      blurb:
        "File specialist. Drafts the loss narrative from the policyholder's own words, captures photos, estimates and documents, and cites the applicable coverage form — leaving the adjuster to decide, not type.",
      tags: ["Loss narrative", "Document & photo intake", "Policy-form citations"],
      pipeSub: "File",
      workMs: 2000,
      flow: [
        {
          fromLabel: "Context from Marcus",
          chips: ["Material damage", "Deductible $500", "Coverage: Part D collision"],
        },
        {
          steps: [
            { text: "Loss narrative drafted from the recorded statement", kind: "ok" },
            { text: "Damage photos and third-party info captured and checked for completeness", kind: "ok" },
            { text: "Applicable coverage and exclusions cited from the actual policy form", kind: "ok" },
          ],
          note: "Draft only. Coverage is determined solely after a licensed adjuster reviews and approves.",
        },
      ],
    },
    {
      key: "coord",
      name: "Owen",
      role: "Servicing & Coordination",
      icon: "coord",
      blurb:
        "Servicing & coordination. Orders estimates, books repairs and rentals, sends status updates, and keeps policyholders on track through renewals with reminders and lapse-prevention nudges.",
      tags: ["Estimates & repairs", "Status & renewals", "Reminders"],
      pipeSub: "Service",
      workMs: 1900,
      flow: [
        {
          fromLabel: "Context from Nora",
          chips: ["Network-shop appraisal", "Rental within limit", "Status link → SMS"],
        },
        {
          steps: [
            { text: "Appraisal scheduled and prior-loss lookups ordered", kind: "ok" },
            { text: "Rental authorized under the policy limit; repair booked", kind: "ok" },
            { text: "Status updates and renewal reminders scheduled (EN / ES)", kind: "ok" },
          ],
        },
      ],
    },
    {
      key: "revenue",
      name: "Riley",
      role: "Billing & Payments",
      icon: "revenue",
      blurb:
        "Billing & payments. Builds bind-ready quote packets and invoices, prepares claim payment and reserve recommendations from the file, and flags subrogation and salvage before a file closes — all for a licensed human to release.",
      tags: ["Quotes & invoicing", "Payment & reserve prep", "Subrogation & salvage"],
      pipeSub: "Billing",
      workMs: 2000,
      flow: [
        {
          fromLabel: "Context from Owen",
          chips: ["Estimate $4,180", "Deductible netted", "At-fault: third party"],
        },
        {
          steps: [
            { text: "Payment packet prepared from the file for adjuster release", kind: "ok" },
            { text: "Reserve recommendation staged; deductible applied", kind: "ok" },
            { text: "Subrogation flag opened against the at-fault carrier", kind: "ok" },
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
        "The role-aware knowledge assistant. Answers policyholders, producers and adjusters from your approved policy forms and bulletins only — every answer cited, and never a binding coverage determination.",
      tags: ["Role-aware", "Cited answers", "Never a binding ruling"],
      pipeSub: "Knowledge",
      workMs: 1900,
      flow: [
        {
          fromLabel: "Context from Riley",
          chips: ["Policyholder view", "Approved forms only", "EN / ES"],
        },
        {
          steps: [
            { text: "Answered the policyholder's questions from approved policy materials", kind: "ok" },
            { text: "Every answer carried its policy-section or bulletin citation", kind: "ok" },
            { text: "Coverage-determination request → handed to a licensed adjuster, not answered", kind: "esc" },
          ],
          note: "Iris informs. It never determines coverage, denies a claim or overrides a licensed professional.",
        },
      ],
    },
    {
      key: "monitor",
      name: "Hope",
      role: "Claims & Lapse Sentinel",
      icon: "monitor",
      blurb:
        "The Claims & Lapse Sentinel. Always on across the open book — flagging fraud indicators on live claims, renewal-lapse risk before expiration, and claim-SLA clocks running toward a fair-claims-practices breach, and staging the response for the team.",
      tags: ["Always-on monitor", "Fraud & lapse & SLA", "Advisory only"],
      pipeSub: "Sentinel",
      workMs: 2400,
      live: { label: "Live · Book" },
      flow: [
        {
          fromLabel: "Context from the book",
          chips: ["Open claims", "Renewals in 30 days", "Fair-claims SLA clocks"],
        },
        {
          fromLabel: "How Hope calibrates for this carrier",
          steps: [
            { text: "Baselines normal claim and renewal patterns by line of business", kind: "ok" },
            { text: "Loads each state's fair-claims-practices timelines and DOI rules", kind: "ok" },
            { text: "Tunes fraud thresholds to your SIU appetite to cut false positives", kind: "ok" },
          ],
        },
        {
          fromLabel: "What Hope watches in real time",
          chips: ["Fraud indicators", "Lapse risk", "SLA clocks", "Reserve drift", "Total-loss", "Litigation"],
          steps: [
            { text: "Fraud — prior-loss pattern and estimate-vs-photo mismatch on a new claim", kind: "esc" },
            { text: "Lapse — renewal nearing expiration with no payment and a recent rate change", kind: "esc" },
            { text: "SLA breach — acknowledgement or decision clock past the state deadline", kind: "esc" },
            { text: "Reserve drift — incurred trending past the set reserve", kind: "esc" },
            { text: "Total-loss — repair estimate crossing the salvage threshold", kind: "esc" },
            { text: "Litigation — attorney representation or DOI complaint detected", kind: "esc" },
          ],
          note: "Hope is advisory. It alerts and stages — a licensed adjuster or producer decides and acts. Every alert is logged with the signal that triggered it.",
        },
      ],
    },
  ],

  // ---------------- ARCHITECTURE ----------------
  archTitle: "One layer over the systems you already run",
  archIntro:
    "Rach.Dev sits on top of your policy admin system, claims platform and CRM — orchestrating agents, enforcing governance, and keeping a licensed human in the loop. No rip-and-replace.",
  archLayers: [
    {
      n: "Layer 4",
      title: "Human-in-the-loop",
      icon: "decision",
      body: "Every coverage decision — coverage confirmations, reserves, payments, denials, SIU referrals — pauses for a licensed adjuster or producer to approve. Agents draft and stage; people decide.",
      pills: ["Approval gates", "Adjuster / producer sign-off", "Role-based access"],
    },
    {
      n: "Layer 3",
      title: "Governance & audit",
      icon: "shield",
      body: "State-DOI and NAIC-aligned controls, fair-claims-practices guardrails, AI-interaction disclosures, and a complete, timestamped audit trail on every action and every data touch.",
      pills: ["State-DOI & NAIC-aligned", "Full audit log", "Fair-claims guardrails", "Source citations"],
    },
    {
      n: "Layer 2",
      title: "Agent orchestration",
      icon: "orchestrator",
      body: "Atlas routes each claim or quote to the right specialist, carries shared policy context between agents, and coordinates hand-offs end to end.",
      pills: ["Routing & hand-off", "Shared context", "Escalation paths"],
    },
    {
      n: "Layer 1",
      title: "Integration",
      icon: "plug",
      body: "Bidirectional connectors to your policy admin system, claims platform, Guidewire and CRM over the standards and APIs your systems already speak.",
      pills: ["ACORD standards", "Guidewire APIs", "Webhooks & APIs"],
    },
  ],
  archBaseLabel: "Works with the systems you already run",
  archBaseSystems: [
    "Policy admin system",
    "Claims platform",
    "Guidewire ClaimCenter",
    "Guidewire PolicyCenter",
    "Duck Creek",
    "Salesforce Financial Services Cloud",
    "Twilio",
    "ISO ClaimSearch",
    "LexisNexis",
    "Verisk",
  ],

  // ---------------- KNOWLEDGE ----------------
  knowledgeTitle: "A knowledge layer that knows its limits",
  knowledgeIntro:
    "Iris answers policyholders, producers and adjusters from your approved policy forms and bulletins only. Every answer is cited — and a coverage question is always handed to a licensed professional, never ruled on.",
  knowledgeAgentName: "Iris",
  knowledgeViewLabel: "Policyholder view",
  knowledgeGreeting:
    "Hi, I'm Iris. Ask me about your policy, a claim's status or your bill — I'll always cite my source.",
  knowledgeDisclaimer:
    "Iris provides information only — never a binding coverage determination, claim denial or insurance advice. Anything that decides coverage is routed to a licensed adjuster or producer.",
  knowledge: [
    {
      q: "What's the status of my auto claim?",
      a: "Your collision claim AU-48213 is open and assigned to adjuster Alan Reyes. The appraisal is scheduled for Thursday, June 11 at the network shop, and a rental has been authorized under your policy limit. You'll get a text the moment the estimate is approved. You can view the full timeline anytime in the claims portal.",
      src: ["Claims platform", "Policyholder portal"],
    },
    {
      q: "¿Por qué subió mi prima este año?",
      a: "Según su póliza y la presentación de tarifas de su estado, su prima de auto cambió por un ajuste de tarifa aprobado y un cambio en su historial de manejo. Le puedo mostrar el desglose línea por línea y sus opciones de renovación. Para revisar coberturas o un posible descuento, la conecto con un productor con licencia.",
      src: ["Policy declarations", "State rate filing", "Renewal terms"],
    },
    {
      q: "Is my basement flooding from the storm covered?",
      a: "That's a coverage determination, so I won't decide it myself. I've opened a claim, attached your photos, and routed it to a licensed adjuster who will review your policy's water-damage and flood provisions and follow up with you. If this is an emergency, please call 911.",
      src: ["Policy form HO-3", "Adjuster routing"],
    },
  ],

  // ---------------- GOVERNANCE ----------------
  governanceTitle: "Governance, not just guardrails",
  governanceIntro:
    "The controls that let a carrier actually deploy agents — enforced in the system, not promised on a slide.",
  guarantees: [
    {
      title: "Licensed human in the loop",
      desc: "Every coverage decision — coverage confirmations, reserves, payments, denials and SIU referrals — waits for a licensed adjuster or producer to approve. No agent makes a coverage call on its own.",
    },
    {
      title: "Complete audit trail",
      desc: "Every action, hand-off and data access is logged with a timestamp, the agent, the source and the approver — exportable for DOI market-conduct exams on demand.",
    },
    {
      title: "State-DOI & NAIC-aligned by design",
      desc: "State-specific disclosures, AI-interaction notices per the NAIC AI Model Bulletin, fair-claims-practices timelines, encryption in transit and at rest, and role-based permissions — compliance built in, not bolted on.",
    },
    {
      title: "Grounded with sources",
      desc: "Answers come only from your approved policy forms, rate filings and bulletins, and cite them. No open-web guessing, no ungrounded coverage claims.",
    },
    {
      title: "No vendor lock-in",
      desc: "Standards-based connectors (ACORD, Guidewire APIs) and your data stays yours. Turn an agent off and your policy and claims systems keep running.",
    },
  ],
  auditTitle: "Live audit log",
  auditIntro: "A sample of what every action looks like on the record.",
  auditLines: [
    { ts: "21:20:14", text: "Outbound SMS (es) renewal outreach — policy AU-77410", tag: "ok", tagLabel: "Logged" },
    { ts: "08:31:09", text: "Coverage-in-force verified — policy AU-48213", tag: "ok", tagLabel: "Verified" },
    { ts: "08:32:47", text: "Policyholder PII accessed: FNOL file build (minimum necessary)", tag: "mod", tagLabel: "PII" },
    { ts: "08:35:22", text: "Reserve recommendation staged — $4,180, awaiting sign-off", tag: "mod", tagLabel: "Pending" },
    { ts: "08:36:05", text: "Coverage & reserve approved by Alan Reyes, Licensed Adjuster", tag: "ok", tagLabel: "Approved" },
    { ts: "13:18:40", text: "Fraud indicators (HO-90147) — SIU referral escalated to manager", tag: "esc", tagLabel: "Escalated" },
  ],

  // ---------------- OUTCOMES ----------------
  outcomesTitle: "What changes when agents own the busywork",
  outcomesIntro: "Directional outcomes our pilots target — validated on your own data, never assumed.",
  outcomes: [
    {
      value: "24/7",
      label: "Coverage, every channel",
      desc: "FNOL, quotes and policy questions answered around the clock, in English and Spanish — no after-hours hold music.",
    },
    {
      value: "Minutes",
      label: "From FNOL to file",
      desc: "Verification, loss narrative and document intake done while the policyholder is still on the line.",
    },
    {
      value: "Earlier",
      label: "Fraud & lapse flags",
      desc: "Indicators and renewal-lapse risk surfaced before payout or expiration — staged for SIU or a producer.",
    },
    {
      value: "Hours back",
      label: "For adjusters & producers",
      desc: "Less typing and chasing, more time on the coverage judgement and advisory work that needs a licensed human.",
    },
  ],
  benchmarks: [
    {
      text: "Insurance fraud is estimated to cost Americans roughly $308 billion every year across all lines — the case for earlier, grounded fraud flags is large.",
      cite: "Coalition Against Insurance Fraud, The Impact of Insurance Fraud on the U.S. Economy, 2022",
    },
    {
      text: "Auto repair claim cycle times averaged about 23 days in 2023, and managing the wait is now central to claims satisfaction — faster intake and coordination matter.",
      cite: "J.D. Power, 2023 U.S. Auto Claims Satisfaction Study",
    },
    {
      text: "Individual life insurance policies lapse at roughly 5% per year, with a large share lapsing in the first few years — proactive renewal outreach is where retention is won.",
      cite: "American Council of Life Insurers, Life Insurers Fact Book (NAIC / LIMRA data)",
    },
  ],
  outcomesNote:
    "Figures above are external benchmarks and pilot targets, not guarantees — we validate every number on your own data before you rely on it. Monitoring agents are advisory: they alert and stage, a licensed adjuster or producer acts.",

  // ---------------- CTA ----------------
  ctaTitle: "Start with one line of business. Prove it. Then scale.",
  ctaIntro:
    "We stand up a single workflow on your existing policy admin and claims platforms, show the audit trail and the outcomes, and expand only once your team trusts it.",
  ctaSteps: [
    {
      n: "01",
      title: "Scope one workflow",
      desc: "Pick the highest-pain workflow — FNOL intake, renewals or fraud/lapse monitoring — and we map it to your systems.",
    },
    {
      n: "02",
      title: "Pilot in your environment",
      desc: "Agents run on your policy admin and claims platforms with a licensed human in the loop and a full audit trail, in weeks not quarters.",
    },
    {
      n: "03",
      title: "Measure, then expand",
      desc: "Review the outcomes on your own data, then roll the agent team out line by line of business.",
    },
  ],

  // ---------------- FAQ (drives FAQPage JSON-LD) ----------------
  faq: [
    {
      q: "Does Rach.Dev replace our policy admin or claims platform?",
      a: "No. Rach.Dev is an operations layer that runs on top of your existing policy admin system and claims platform (Guidewire, Duck Creek and others) over ACORD standards and their APIs. Your systems of record stay exactly where they are.",
    },
    {
      q: "How does Rach.Dev handle state insurance regulation and the NAIC AI rules?",
      a: "Agents are configured per jurisdiction: state-specific disclosures, AI-interaction notices aligned to the NAIC Model Bulletin on the Use of AI Systems by Insurers, fair-claims-practices timelines, and a full audit trail for market-conduct exams. Compliance is validated per deployment.",
    },
    {
      q: "Do the AI agents make coverage decisions or deny claims?",
      a: "No. Every coverage decision — coverage confirmations, reserves, payments, denials and SIU referrals — pauses for a licensed adjuster or producer to approve. The agents draft, stage and route; a licensed human decides. Monitoring agents are advisory only.",
    },
    {
      q: "Do the agents work in languages other than English?",
      a: "Yes. FNOL intake, renewals and policyholder answers support English and Spanish out of the box, across phone, SMS, WhatsApp, chat and the web portal.",
    },
    {
      q: "How does fraud and lapse monitoring work?",
      a: "An always-on Sentinel watches the open book for fraud indicators on live claims, renewal-lapse risk before expiration, and fair-claims SLA clocks. It flags and stages a response — SIU referral or producer outreach — for a licensed human to act on.",
    },
  ],
};
