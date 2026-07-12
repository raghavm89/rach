import type { IndustryConfig } from "./types";

/**
 * Medical (US healthcare) industry config.
 *
 * Content is authored for a US hospital/clinic buyer — HIPAA, US payers,
 * CPT + ICD-10-CM coding, English + Spanish — and renders entirely in the
 * Rach.Dev design system. Interactions (Control Tower + relay + knowledge) are
 * fully scripted; no live model is called.
 */
export const medicalConfig: IndustryConfig = {
  slug: "medical",
  vertical: "Healthcare",
  industrySlug: "healthcare",
  industryName: "Healthcare",
  icon: "heart",
  tagline:
    "An agent team for intake, triage, documentation, CPT/ICD-10-CM coding and ICU monitoring — on your existing EHR, with a clinician in the loop.",
  seoTitle: "Medical AI Agents for Hospitals & Clinics",
  seoDescription:
    "Rach.Dev is an AI operations layer for hospitals and clinics — agents for intake, triage, clinical documentation, scheduling, CPT/ICD-10-CM coding and ICU monitoring, on top of your existing EHR, with a clinician in the loop on every clinical decision.",
  seoKeywords: [
    "healthcare AI agents",
    "AI medical scribe",
    "patient intake automation",
    "medical coding automation",
    "prior authorization automation",
    "ICU monitoring AI",
    "HIPAA AI agents",
    "EHR automation",
  ],

  // ---------------- HERO ----------------
  eyebrow: "Healthcare · Agentic Operations Layer",
  h1Lines: ["The AI operations layer", "for your hospital."],
  rotorLead: "Put a team of agents on your",
  rotorWords: ["intake.", "documentation.", "scheduling.", "coding & claims.", "ICU watch."],
  subhead:
    "Rach.Dev runs intake, triage, clinical documentation, scheduling, CPT/ICD-10-CM coding and ICU monitoring across the systems you already use — with a clinician in the loop on every clinical decision, and a full audit trail on every action.",
  trustRow: [
    "HIPAA-aligned by design",
    "Works with your existing EHR",
    "Clinician-in-the-loop",
    "English & Spanish",
  ],
  heroPrimaryCta: { label: "Book a pilot", href: "/contact" },
  heroSecondaryCta: { label: "See the architecture", href: "#architecture" },

  // ---------------- OPERATING PICTURE ----------------
  operateEyebrow: "The operating picture",
  operateTitle: "What an agent team takes off your floor",
  operateIntro:
    "Most of a hospital's load isn't clinical judgement — it's coordination, paperwork and chasing. Here's where agents own the busywork, mapped to how your hospital actually runs.",
  domains: [
    {
      icon: "door",
      title: "The Front Door",
      blurb: "Every inquiry captured, qualified and routed — 24/7, in English or Spanish.",
      bullets: [
        "Multi-channel intake (walk-in, phone, SMS, patient portal)",
        "Identity match & EHR record linkage",
        "Insurance eligibility & benefits verification",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "triage",
      title: "Triage & Safety",
      blurb: "Severity scoring with explicit red-flag detection and instant escalation.",
      bullets: [
        "Routes to ER, clinic or specialist by acuity",
        "Red-flag alerts page the on-call clinician",
        "Matches to the right available provider",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "scribe",
      title: "Clinical Encounter",
      blurb: "Pre-charting, ambient notes and cited references — the clinician decides.",
      bullets: [
        "Charts pre-filled with history & meds",
        "Ambient note + e-prescription draft",
        "Drug-interaction checks on every order",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "diagnostics",
      title: "Diagnostics",
      blurb: "The full loop, with critical results escalated the moment they land.",
      bullets: [
        "Order → collection → result → routing",
        "Critical-value alerts to the ordering provider",
        "Imaging via cleared partner systems",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "calendar",
      title: "Care Coordination",
      blurb: "Beds, referrals, discharge and the follow-up patients never get.",
      bullets: [
        "Scheduling, bed / OR & referral orchestration",
        "Auto discharge summary + med reconciliation",
        "Reminders & adherence nudges (EN / ES)",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "revenue",
      title: "Revenue & Coding",
      blurb: "The fastest ROI for a CFO: catch every charge, clean every claim.",
      bullets: [
        "CPT + ICD-10-CM coding from the note",
        "Charge capture & claim generation",
        "Prior-auth & denial-risk flags before submission",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "users",
      title: "Back-Office & Workforce",
      blurb: "Rosters, credentialing and the compliance paperwork no one wants to do.",
      bullets: [
        "Schedules, rosters & PTO (HR self-serve)",
        "Joint Commission / incident / reportable-condition filing",
        "Patient feedback & complaint handling",
      ],
      tag: { label: "In your build", tone: "muted" },
    },
    {
      icon: "knowledge",
      title: "Knowledge Layer",
      blurb: "A role-aware assistant grounded only in your approved sources.",
      bullets: [
        "Separate views for patient, clinician, staff",
        "Every answer cites its source",
        "Hard guardrails — never a diagnosis",
      ],
      tag: { label: "In demo", tone: "live" },
    },
  ],

  // ---------------- CONTROL TOWER ----------------
  towerTitle: "Watch the team run a case",
  towerIntro:
    "Pick a case and press play. Watch the agent team run it end to end — a clinician approves every clinical action.",
  subjectNoun: "patient",
  stages: [
    { key: "door", label: "Front Door", icon: "door" },
    { key: "triage", label: "Triage", icon: "triage" },
    { key: "encounter", label: "Encounter", icon: "scribe" },
    { key: "diagnostics", label: "Diagnostics", icon: "diagnostics" },
    { key: "decision", label: "Decision", icon: "decision" },
    { key: "coord", label: "Coordination", icon: "coord" },
    { key: "follow", label: "Follow-up", icon: "follow" },
  ],
  scenarios: [
    {
      key: "er",
      tabLabel: "ER walk-in",
      tabIcon: "alert",
      subjectName: "Robert Daniels · 58 / M",
      subjectDesc: "Chest pain, diaphoretic — walk-in",
      channel: "Walk-in · ER",
      channelIcon: "door",
      steps: [
        {
          agent: "intake",
          stage: "door",
          title: "Patient registered & verified",
          detail:
            "Matched to existing chart, insurance eligibility confirmed, ED encounter opened in seconds.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "triage",
          title: "Red-flag: possible heart attack",
          detail:
            "Chest pain + diaphoresis at 58 → ESI level 2. On-call physician and charge nurse paged immediately.",
          status: "esc",
          ms: 1300,
        },
        {
          agent: "scribe",
          stage: "encounter",
          title: "Bedside chart pre-built",
          detail:
            "Cardiac history, current meds, allergies and last troponin surfaced for the physician on arrival.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "coord",
          stage: "diagnostics",
          title: "STAT cardiac workup moving",
          detail: "EKG + serial troponin collected and routed; cardiology consult queued.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "decision",
          title: "Admission approved by the attending",
          detail:
            "Physician confirms cath-lab activation and admission to cardiology — Rach.Dev never decides this alone.",
          status: "gate",
          gateBy: "Dr. Alan Reyes · ED",
          ms: 1300,
        },
        {
          agent: "monitor",
          stage: "coord",
          title: "Telemetry watch armed",
          detail:
            "Continuous rhythm and vitals monitoring enabled on the assigned bed; deterioration alerts wired to the care team.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "revenue",
          stage: "follow",
          title: "Coded, claimed & followed up",
          detail:
            "Encounter coded in CPT / ICD-10-CM from the note, denial risk cleared, and a cardiology follow-up scheduled.",
          status: "ok",
          ms: 1100,
        },
      ],
    },
    {
      key: "clinic",
      tabLabel: "Clinic follow-up",
      tabIcon: "calendar",
      subjectName: "Karen Mitchell · 45 / F",
      subjectDesc: "Type 2 diabetes follow-up",
      channel: "Phone · Scheduling",
      channelIcon: "phone",
      steps: [
        {
          agent: "intake",
          stage: "door",
          title: "Visit booked & verified",
          detail:
            "Caller identified, copay and benefits checked, follow-up slot booked with her usual PCP.",
          status: "ok",
          ms: 1000,
        },
        {
          agent: "triage",
          stage: "triage",
          title: "Routine acuity confirmed",
          detail: "No red flags; standard 20-minute follow-up, no same-day escalation needed.",
          status: "ok",
          ms: 1000,
        },
        {
          agent: "scribe",
          stage: "encounter",
          title: "Chart pre-loaded",
          detail: "Last A1c, medication list and overdue screenings surfaced for the visit.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "coord",
          stage: "diagnostics",
          title: "Labs ordered ahead",
          detail: "Standing A1c + lipid panel queued so results are ready at the visit.",
          status: "ok",
          ms: 1000,
        },
        {
          agent: "scribe",
          stage: "decision",
          title: "Prescription renewal — physician signs",
          detail:
            "Metformin refill drafted from the note; the physician reviews and e-signs before anything is sent.",
          status: "gate",
          gateBy: "Dr. Priya Shah · PCP",
          ms: 1200,
        },
        {
          agent: "coord",
          stage: "coord",
          title: "Pharmacy + reminders set",
          detail: "e-Rx routed to her pharmacy after sign-off; visit and lab reminders scheduled.",
          status: "ok",
          ms: 1000,
        },
        {
          agent: "revenue",
          stage: "follow",
          title: "Coded & gaps closed",
          detail: "Visit coded, a care gap (eye exam) flagged, and the next follow-up pre-booked.",
          status: "ok",
          ms: 1000,
        },
      ],
    },
    {
      key: "sms",
      tabLabel: "After-hours text",
      tabIcon: "message",
      subjectName: "María García · 34 / F",
      subjectDesc: "After-hours text, in Spanish",
      channel: "SMS · After hours",
      channelIcon: "message",
      steps: [
        {
          agent: "intake",
          stage: "door",
          title: "Spanish text understood & answered",
          detail:
            "Inbound SMS in Spanish recognized at 11:40 PM; patient identified and replied to in her own language.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "triage",
          title: "Symptoms triaged safely",
          detail:
            "Fever + sore throat in a stable adult → next-day clinic, with clear ER red-flags shared.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "knowledge",
          stage: "encounter",
          title: "Grounded answer, no diagnosis",
          detail:
            "Answered her medication-timing question from approved patient materials, with sources — and explicitly did not diagnose.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "coord",
          stage: "decision",
          title: "Same-day slot held — nurse confirms",
          detail:
            "A morning slot is held; the on-call nurse approves before it is promised to the patient.",
          status: "gate",
          gateBy: "Dana Whitfield · RN",
          ms: 1200,
        },
        {
          agent: "intake",
          stage: "follow",
          title: "Confirmed in Spanish + reminders",
          detail:
            "Sent the confirmed appointment and prep instructions in Spanish, with a reminder the morning of.",
          status: "ok",
          ms: 1000,
        },
      ],
    },
  ],
  gateNote: "Every clinical action waits for a clinician. Rach.Dev drafts, stages and routes — a human approves.",
  completeToast: "Journey complete — every clinical action was clinician-approved",

  // ---------------- ROSTER (relay) ----------------
  rosterTitle: "Seven specialists, one conductor",
  rosterIntro:
    "Each agent owns one job and hands the next a complete, structured context. Atlas routes the work, enforces the human-in-the-loop gates, and writes every action to an audit log.",
  rosterClickNote: "Click Ava below — the full intake-to-billing workflow plays out automatically.",
  orchestratorName: "Atlas",
  orchestratorBlurb:
    "Atlas is the orchestrator. It routes each case to the right specialist, carries shared patient context between them, pauses for clinician approval on every clinical action, and records a complete, timestamped audit trail.",
  relayTriggerAgentKey: "intake",
  relayCompleteToast: "Workflow complete — all agents processed Karen Mitchell's case",
  agents: [
    {
      key: "intake",
      name: "Ava",
      role: "Front Desk · Intake",
      icon: "intake",
      blurb:
        "The front door. Captures every inquiry across phone, SMS, portal and walk-in, verifies identity and insurance, and opens a clean encounter — 24/7, in English or Spanish.",
      tags: ["Multi-channel intake", "Eligibility & benefits", "EN / ES"],
      pipeSub: "Intake",
      workMs: 2000,
      voice: {
        listeningTitle: "Listening…",
        listeningSub: "Capturing patient intake by voice",
        doneTitle: "Intake complete",
        doneSub: "6 fields captured · handing off to the team…",
        handoffToast: "Ava done — watch the team pick it up",
        fields: [
          { label: "Patient", value: "Karen Mitchell, 45 / F" },
          { label: "Reason for visit", value: "Type 2 diabetes follow-up" },
          { label: "History", value: "T2DM, hypertension; metformin + lisinopril" },
          { label: "Identity", value: "Matched to chart (MRN verified)", ok: true },
          { label: "Insurance", value: "Eligibility verified — $25 copay", ok: true },
          { label: "Channel", value: "Phone · English" },
        ],
      },
    },
    {
      key: "triage",
      name: "Marcus",
      role: "Triage & Safety",
      icon: "triage",
      blurb:
        "Triage & safety. Scores acuity, watches for red flags, and escalates straight to the on-call clinician — never sitting on a dangerous symptom.",
      tags: ["Acuity scoring", "Red-flag detection", "Escalation"],
      pipeSub: "Triage",
      workMs: 2100,
      flow: [
        {
          fromLabel: "Context from Ava",
          chips: ["Karen Mitchell, 45 / F", "T2DM follow-up", "Stable vitals"],
        },
        {
          steps: [
            { text: "Acuity scored — routine follow-up, no same-day risk", kind: "ok" },
            { text: "Red-flag scan clear (no chest pain, no hypoglycemia)", kind: "ok" },
            { text: "Escalation path armed if anything changes at check-in", kind: "ok" },
          ],
        },
      ],
    },
    {
      key: "scribe",
      name: "Nora",
      role: "Clinical Scribe",
      icon: "scribe",
      blurb:
        "Clinical scribe. Pre-charts the visit, drafts the ambient note and orders, and checks every prescription for interactions — leaving the clinician to decide, not type.",
      tags: ["Pre-charting", "Ambient notes", "Drug-interaction checks"],
      pipeSub: "Scribe",
      workMs: 2000,
      flow: [
        {
          fromLabel: "Context from Marcus",
          chips: ["Routine follow-up", "Last A1c 8.1%", "Meds: metformin, lisinopril"],
        },
        {
          steps: [
            { text: "Chart pre-filled with history, meds and overdue screenings", kind: "ok" },
            { text: "Metformin refill drafted from the note", kind: "ok" },
            { text: "Interaction check clean — flagged for physician e-signature", kind: "ok" },
          ],
          note: "Draft only. The prescription is sent solely after a clinician signs.",
        },
      ],
    },
    {
      key: "coord",
      name: "Owen",
      role: "Care Coordination",
      icon: "coord",
      blurb:
        "Care coordination. Books visits, orders labs ahead, routes referrals and prescriptions, and keeps patients on track with reminders and adherence nudges.",
      tags: ["Scheduling", "Referrals & labs", "Reminders"],
      pipeSub: "Coord",
      workMs: 1900,
      flow: [
        {
          fromLabel: "Context from Nora",
          chips: ["A1c + lipid panel", "e-Rx → pharmacy", "Care gap: eye exam"],
        },
        {
          steps: [
            { text: "Standing labs queued so results are ready at the visit", kind: "ok" },
            { text: "e-Rx routed to the patient's pharmacy after sign-off", kind: "ok" },
            { text: "Visit + lab reminders scheduled; eye-exam referral opened", kind: "ok" },
          ],
        },
      ],
    },
    {
      key: "revenue",
      name: "Riley",
      role: "Revenue & Coding",
      icon: "revenue",
      blurb:
        "Revenue & coding. Codes the encounter from the note in CPT and ICD-10-CM, captures every charge, and clears prior-auth and denial risk before the claim ever goes out.",
      tags: ["CPT / ICD-10-CM", "Charge capture", "Denial & prior-auth"],
      pipeSub: "Billing",
      workMs: 2000,
      flow: [
        {
          fromLabel: "Context from Owen",
          chips: ["99214 follow-up", "E11.9 · I10", "Labs: 83036, 80061"],
        },
        {
          steps: [
            { text: "Encounter coded from the note — CPT + ICD-10-CM", kind: "ok" },
            { text: "Charges captured; payer rules checked for this plan", kind: "ok" },
            { text: "Prior-auth not required; denial-risk scan clean → claim staged", kind: "ok" },
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
        "The role-aware knowledge assistant. Answers patients, clinicians and staff from your approved sources only — every answer cited, and never a diagnosis.",
      tags: ["Role-aware", "Cited answers", "Never a diagnosis"],
      pipeSub: "Knowledge",
      workMs: 1900,
      flow: [
        {
          fromLabel: "Context from Riley",
          chips: ["Patient view", "Approved sources only", "EN / ES"],
        },
        {
          steps: [
            { text: "Answered the patient's questions from approved materials", kind: "ok" },
            { text: "Every answer carried its source citation", kind: "ok" },
            { text: "Clinical-advice request → handed to a clinician, not answered", kind: "esc" },
          ],
          note: "Iris informs. It never diagnoses, prescribes or overrides a clinician.",
        },
      ],
    },
    {
      key: "monitor",
      name: "Hope",
      role: "ICU Sentinel",
      icon: "monitor",
      blurb:
        "The ICU Sentinel. Always on, reading the live signal stream for every monitored patient — flagging silent deterioration hours before it becomes a code, and staging the response for the care team.",
      tags: ["Always-on monitor", "Early-warning", "Advisory only"],
      pipeSub: "ICU",
      workMs: 2400,
      live: { label: "Live · ICU" },
      flow: [
        {
          fromLabel: "Context from the care team",
          chips: ["Post-admit telemetry", "Sepsis risk: elevated", "Renal: watch"],
        },
        {
          fromLabel: "How Hope calibrates for this patient",
          steps: [
            { text: "Baselines vitals, labs and meds for this specific patient", kind: "ok" },
            { text: "Tightens thresholds for known cardiac + renal risk", kind: "ok" },
            { text: "Suppresses nuisance alarms to cut alert fatigue", kind: "ok" },
          ],
        },
        {
          fromLabel: "What Hope reads in real time",
          chips: ["HR / rhythm", "BP / MAP", "SpO₂ / RR", "Temp", "Urine output", "Labs"],
          steps: [
            { text: "Silent ischemia — ST-segment drift with no symptoms", kind: "esc" },
            { text: "Sepsis — rising lactate with MAP trending down", kind: "esc" },
            { text: "Respiratory — falling SpO₂ as respiratory rate climbs", kind: "esc" },
            { text: "Acute kidney injury — urine output below threshold", kind: "esc" },
            { text: "Arrhythmia — new-onset AFib or runs of VT", kind: "esc" },
            { text: "Neuro — trending change in responsiveness", kind: "esc" },
          ],
          note: "Hope is advisory. It alerts and stages — a clinician decides and acts. Every alert is logged with the signal that triggered it.",
        },
      ],
    },
  ],

  // ---------------- ARCHITECTURE ----------------
  archTitle: "One layer over the systems you already run",
  archIntro:
    "Rach.Dev sits on top of your EHR and existing tools — orchestrating agents, enforcing governance, and keeping a clinician in the loop. No rip-and-replace.",
  archLayers: [
    {
      n: "Layer 4",
      title: "Human-in-the-loop",
      icon: "decision",
      body: "Every clinical action — orders, prescriptions, admissions — pauses for a clinician to approve. Agents draft and stage; people decide.",
      pills: ["Approval gates", "Clinician sign-off", "Role-based access"],
    },
    {
      n: "Layer 3",
      title: "Governance & audit",
      icon: "shield",
      body: "HIPAA-aligned controls, minimum-necessary access, and a complete, timestamped audit trail on every action and every data touch.",
      pills: ["HIPAA-aligned", "Full audit log", "PHI minimization", "Source citations"],
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
      body: "Bidirectional connectors to your EHR, telephony, clearinghouse and labs over the standards your systems already speak.",
      pills: ["HL7 / FHIR", "SMART on FHIR", "Webhooks & APIs"],
    },
  ],
  archBaseLabel: "Works with the systems you already run",
  archBaseSystems: [
    "Epic",
    "Oracle Health (Cerner)",
    "athenahealth",
    "eClinicalWorks",
    "MEDITECH",
    "Twilio",
    "Availity",
    "Change Healthcare",
    "LabCorp",
    "Quest Diagnostics",
  ],

  // ---------------- KNOWLEDGE ----------------
  knowledgeTitle: "A knowledge layer that knows its limits",
  knowledgeIntro:
    "Iris answers patients, clinicians and staff from your approved sources only. Every answer is cited — and a clinical question is always handed to a clinician, never diagnosed.",
  knowledgeAgentName: "Iris",
  knowledgeViewLabel: "Patient view",
  knowledgeGreeting:
    "Hi, I'm Iris. Ask me about appointments, billing or your care instructions — I'll always cite my source.",
  knowledgeDisclaimer:
    "Iris provides information only — never a diagnosis, prescription or medical advice. Anything clinical is routed to a licensed clinician.",
  knowledge: [
    {
      q: "When is my next appointment?",
      a: "Your next visit is a diabetes follow-up with Dr. Priya Shah on Tuesday, June 17 at 9:40 AM. Please arrive 15 minutes early and bring your current medications. You can reschedule anytime from your patient portal or by replying here.",
      src: ["Scheduling system", "Patient portal"],
    },
    {
      q: "¿Cuánto voy a pagar por la visita?",
      a: "Según su plan, esta visita de seguimiento tiene un copago de $25, que se cobra al registrarse. Los análisis de laboratorio se facturan por separado a su seguro. Si necesita un estimado detallado, puedo conectarla con facturación.",
      src: ["Eligibility check", "Payer benefits", "Billing policy"],
    },
    {
      q: "Is it safe to take my metformin with the new medication?",
      a: "That's a clinical question, so I won't advise on it myself. I've flagged your medication list and routed your question to a pharmacist and your care team, who will follow up. If you feel unwell, call 911 or go to the nearest ER.",
      src: ["Medication list", "Care-team routing"],
    },
  ],

  // ---------------- GOVERNANCE ----------------
  governanceTitle: "Governance, not just guardrails",
  governanceIntro:
    "The controls that let a hospital actually deploy agents — enforced in the system, not promised on a slide.",
  guarantees: [
    {
      title: "Clinician in the loop",
      desc: "Every order, prescription and admission waits for a licensed clinician to approve. No agent takes a clinical action on its own.",
    },
    {
      title: "Complete audit trail",
      desc: "Every action, hand-off and data access is logged with a timestamp, the agent, the source and the approver — exportable on demand.",
    },
    {
      title: "HIPAA-aligned by design",
      desc: "Minimum-necessary PHI access, encryption in transit and at rest, role-based permissions, and a signed BAA — privacy built in, not bolted on.",
    },
    {
      title: "Grounded with sources",
      desc: "Answers come only from your approved knowledge sources and cite them. No open-web guessing, no ungrounded claims.",
    },
    {
      title: "No vendor lock-in",
      desc: "Standards-based connectors (HL7 / FHIR) and your data stays yours. Turn an agent off and your systems keep running.",
    },
  ],
  auditTitle: "Live audit log",
  auditIntro: "A sample of what every action looks like on the record.",
  auditLines: [
    { ts: "23:41:02", text: "Inbound SMS (es) received & answered — patient #4821", tag: "ok", tagLabel: "Logged" },
    { ts: "09:12:55", text: "Insurance eligibility verified — copay $25", tag: "ok", tagLabel: "Verified" },
    { ts: "09:13:20", text: "PHI accessed: chart pre-load (minimum necessary)", tag: "mod", tagLabel: "PHI" },
    { ts: "09:15:08", text: "e-Rx drafted — metformin 1000mg, awaiting sign-off", tag: "mod", tagLabel: "Pending" },
    { ts: "09:15:47", text: "Prescription approved by Dr. Priya Shah, PCP", tag: "ok", tagLabel: "Approved" },
    { ts: "14:02:31", text: "Red-flag (possible ACS) — on-call physician paged", tag: "esc", tagLabel: "Escalated" },
  ],

  // ---------------- OUTCOMES ----------------
  outcomesTitle: "What changes when agents own the busywork",
  outcomesIntro: "Directional outcomes our pilots target — validated on your own data, never assumed.",
  outcomes: [
    {
      value: "24/7",
      label: "Coverage, every channel",
      desc: "Phone, SMS and portal answered around the clock, in English and Spanish — no after-hours voicemail.",
    },
    {
      value: "Minutes",
      label: "From intake to chart",
      desc: "Registration, eligibility and pre-charting done before the patient is in the room.",
    },
    {
      value: "Cleaner",
      label: "Claims out the door",
      desc: "Coding, charge capture and denial checks before submission — fewer reworks, faster cash.",
    },
    {
      value: "Hours back",
      label: "For clinicians",
      desc: "Less typing and chasing, more time on the care that needs human judgment.",
    },
  ],
  benchmarks: [
    {
      text: "Physicians and their staff report prior authorization is a high or extremely high burden, completing dozens of authorizations per physician each week.",
      cite: "AMA, 2023 Prior Authorization Physician Survey",
    },
    {
      text: "For every hour of direct patient care, physicians spend roughly two additional hours on EHR and desk work during the clinic day.",
      cite: "Sinsky et al., Annals of Internal Medicine, 2016",
    },
    {
      text: "Administrative transactions cost the US healthcare system tens of billions a year, with large savings available from automating eligibility, prior auth and claims.",
      cite: "CAQH Index, 2023",
    },
  ],
  outcomesNote:
    "Figures above are external benchmarks and pilot targets, not guarantees — we validate every number on your own data before you rely on it. Monitoring agents are advisory: they alert and stage, a clinician acts.",

  // ---------------- CTA ----------------
  ctaTitle: "Start with one service line. Prove it. Then scale.",
  ctaIntro:
    "We stand up a single workflow on your existing EHR, show the audit trail and the outcomes, and expand only once your team trusts it.",
  ctaSteps: [
    {
      n: "01",
      title: "Scope one workflow",
      desc: "Pick the highest-pain workflow — intake, prior auth or ICU monitoring — and we map it to your systems.",
    },
    {
      n: "02",
      title: "Pilot in your environment",
      desc: "Agents run on your EHR with a clinician in the loop and a full audit trail, in weeks not quarters.",
    },
    {
      n: "03",
      title: "Measure, then expand",
      desc: "Review the outcomes on your own data, then roll the agent team out service line by service line.",
    },
  ],

  // ---------------- FAQ (drives FAQPage JSON-LD) ----------------
  faq: [
    {
      q: "Does Rach.Dev replace our EHR?",
      a: "No. Rach.Dev is an operations layer that runs on top of your existing EHR (Epic, Oracle Health, athenahealth and others) over HL7/FHIR. Your systems of record stay exactly where they are.",
    },
    {
      q: "Is Rach.Dev HIPAA compliant?",
      a: "Rach.Dev is built to align with HIPAA: minimum-necessary PHI access, encryption in transit and at rest, role-based permissions, a full audit trail, and a signed Business Associate Agreement. Compliance is validated per deployment.",
    },
    {
      q: "Do the AI agents make clinical decisions?",
      a: "No. Every clinical action — orders, prescriptions, admissions — pauses for a licensed clinician to approve. The agents draft, stage and route; a human decides. Monitoring agents are advisory only.",
    },
    {
      q: "Do the agents work in languages other than English?",
      a: "Yes. Intake, reminders and patient answers support English and Spanish out of the box, across phone, SMS and the patient portal.",
    },
    {
      q: "How do the agents handle coding and billing?",
      a: "Agents code the encounter from the clinical note in CPT and ICD-10-CM, capture charges, and screen for prior-authorization requirements and denial risk before the claim is submitted.",
    },
  ],
};
