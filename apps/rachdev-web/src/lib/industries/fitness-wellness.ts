import type { IndustryConfig } from "./types";

/**
 * Fitness & Wellness (US studios, gyms, boutique fitness) industry config.
 *
 * Content is authored for a US studio / gym / wellness-center owner — Mindbody,
 * Zen Planner and ClubReady booking stacks, Stripe billing, Twilio messaging,
 * state automatic-renewal & cancellation law, and the hard line that agents are
 * not licensed clinicians or dietitians. Interactions (Control Tower + relay +
 * knowledge) are fully scripted; no live model is called.
 */
export const fitnessWellnessConfig: IndustryConfig = {
  slug: "fitness-wellness",
  vertical: "Fitness & Wellness",
  industrySlug: "fitness-wellness",
  industryName: "Fitness & Wellness",
  icon: "dumbbell",
  tagline:
    "An agent team for class booking, retention, progress nudges, billing and engagement monitoring — on Mindbody, Zen Planner or ClubReady, with a coach in the loop and clear health disclaimers.",
  seoTitle: "Fitness & Wellness AI Agents for Studios & Gyms",
  seoDescription:
    "Rach.Dev is an AI operations layer for fitness studios, gyms and wellness centers — agents for membership & class booking, retention, progress tracking, billing and engagement monitoring on top of Mindbody, Zen Planner and ClubReady, with a coach in the loop and clear non-medical disclaimers.",
  seoKeywords: [
    "fitness AI agents",
    "gym class booking automation",
    "member retention AI",
    "Mindbody automation",
    "studio churn reduction",
    "fitness no-show automation",
    "wellness chatbot",
    "membership cancellation automation",
  ],

  // ---------------- HERO ----------------
  eyebrow: "Fitness & Wellness · Agentic Operations Layer",
  h1Lines: ["The AI operations layer", "for your studio."],
  rotorLead: "Put a team of agents on your",
  rotorWords: ["class booking.", "front desk.", "member retention.", "billing & freezes.", "engagement watch."],
  subhead:
    "Rach.Dev runs membership & class booking, retention saves, progress nudges, billing and engagement monitoring across the systems you already use — with a coach in the loop on every member-impacting action, and a full audit trail on every cancellation, charge and save.",
  trustRow: [
    "Not medical or nutrition advice",
    "Works with Mindbody, Zen Planner & ClubReady",
    "Coach-in-the-loop",
    "English & Spanish",
  ],
  heroPrimaryCta: { label: "Book a pilot", href: "/contact" },
  heroSecondaryCta: { label: "See the architecture", href: "#architecture" },

  // ---------------- OPERATING PICTURE ----------------
  operateEyebrow: "The operating picture",
  operateTitle: "What an agent team takes off your front desk",
  operateIntro:
    "Most of a studio's load isn't coaching — it's booking, chasing no-shows, saving cancellations and reminding people to show up. Here's where agents own the busywork, mapped to how your studio actually runs.",
  domains: [
    {
      icon: "door",
      title: "The Front Door",
      blurb: "Every inquiry, booking and waitlist captured and answered — 24/7, in English or Spanish.",
      bullets: [
        "Multi-channel intake (phone, SMS, web chat, walk-in)",
        "Class booking, waitlist, reschedule & cancel",
        "Membership match & profile linkage in your booking platform",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "shieldAlert",
      title: "Disclaimers & Compliance",
      blurb: "Health and cancellation guardrails baked in — agents know what they may not do.",
      bullets: [
        "Clear 'not a clinician / not a dietitian' disclaimers",
        "State auto-renewal & cancellation-notice rules enforced",
        "Physician-clearance prompts before new programs",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "scribe",
      title: "Progress & Coaching Notes",
      blurb: "Workout logs, milestones and trends drafted between sessions — the coach decides.",
      bullets: [
        "Logs workouts and surfaces personal-record streaks",
        "Drafts a between-session check-in for the coach",
        "Flags plateaus and missed-goal trends to the trainer",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "calendar",
      title: "Booking & Scheduling",
      blurb: "Classes, waitlists, trainer slots and reminders — capacity stays full.",
      bullets: [
        "Waitlist promotion the moment a spot opens",
        "Reschedule and freeze handling without the front desk",
        "Pre-class reminders + no-show follow-up (EN / ES)",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "revenue",
      title: "Billing & Retention",
      blurb: "The fastest ROI for an owner: save the cancel, fix the failed charge.",
      bullets: [
        "Failed-payment recovery & dunning via Stripe",
        "Cancellation saves — freeze, downgrade or pause first",
        "Plan changes and renewals within state cancellation law",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "knowledge",
      title: "Knowledge Layer",
      blurb: "A role-aware assistant grounded only in your approved sources.",
      bullets: [
        "Separate views for member, trainer and front desk",
        "Every answer cites its source",
        "Hard guardrails — never medical or nutrition therapy advice",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "heart",
      title: "Engagement Watch",
      blurb: "Always-on read on who's drifting — before they cancel, not after.",
      bullets: [
        "Attendance-drop and visit-gap detection",
        "Cancellation-risk and no-show-pattern scoring",
        "Stages a personal save for the coach to send",
      ],
      tag: { label: "In demo", tone: "live" },
    },
    {
      icon: "users",
      title: "Community & Back-Office",
      blurb: "Challenges, referrals, reviews and the admin nobody wants to do.",
      bullets: [
        "Challenge enrollment, referral and review nudges",
        "Trainer rosters, PTO and class coverage",
        "Member feedback and complaint handling",
      ],
      tag: { label: "In your build", tone: "muted" },
    },
  ],

  // ---------------- CONTROL TOWER ----------------
  towerTitle: "Watch the team run a member",
  towerIntro:
    "Pick a member and press play. Watch the agent team run it end to end — a coach or owner approves every member-impacting action.",
  subjectNoun: "member",
  stages: [
    { key: "door", label: "Front Door", icon: "door" },
    { key: "guardrail", label: "Disclaimers", icon: "shieldAlert" },
    { key: "booking", label: "Booking", icon: "calendar" },
    { key: "session", label: "Session", icon: "dumbbell" },
    { key: "decision", label: "Decision", icon: "decision" },
    { key: "billing", label: "Billing", icon: "revenue" },
    { key: "follow", label: "Follow-up", icon: "follow" },
  ],
  scenarios: [
    {
      key: "cancel",
      tabLabel: "Cancellation save",
      tabIcon: "shieldAlert",
      subjectName: "Brandon Cole · Unlimited member",
      subjectDesc: "Wants to cancel — 14 months in, attendance fading",
      channel: "Phone · Front desk",
      channelIcon: "phone",
      steps: [
        {
          agent: "intake",
          stage: "door",
          title: "Member identified & intent captured",
          detail:
            "Caller matched to his Mindbody profile; stated reason logged as 'too busy, not using it lately.'",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "triage",
          stage: "guardrail",
          title: "State cancellation law checked",
          detail:
            "Confirms his contract terms and the state's auto-renewal notice window before anything is promised — no out-of-policy save offered.",
          status: "ok",
          ms: 1200,
        },
        {
          agent: "monitor",
          stage: "session",
          title: "Cancellation risk confirmed — escalated",
          detail:
            "Visits down from 12/mo to 2/mo over 90 days; high-value member at high churn risk. Owner flagged for a personal save before the cancel is processed.",
          status: "esc",
          ms: 1300,
        },
        {
          agent: "revenue",
          stage: "decision",
          title: "Retention offer — owner approves",
          detail:
            "Agent drafts a 2-month freeze plus a downgrade to a 8-class pack; the owner reviews and approves before it is offered, per policy.",
          status: "gate",
          gateBy: "Marcus Bell · Owner",
          ms: 1300,
        },
        {
          agent: "coord",
          stage: "billing",
          title: "Freeze applied & billing paused",
          detail:
            "Approved freeze written to Mindbody and Stripe; next charge paused, confirmation sent to the member.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "intake",
          stage: "follow",
          title: "Win-back sequence scheduled",
          detail:
            "A coach check-in and a 'first class back' reminder are queued for the week the freeze ends.",
          status: "ok",
          ms: 1000,
        },
      ],
    },
    {
      key: "booking",
      tabLabel: "Class booking",
      tabIcon: "calendar",
      subjectName: "Jessica Tran · New member",
      subjectDesc: "First week — booking her first classes",
      channel: "Web chat · Booking",
      channelIcon: "message",
      steps: [
        {
          agent: "intake",
          stage: "door",
          title: "Booked & profile verified",
          detail:
            "New member identified in ClubReady, package and credits confirmed, two classes booked in one chat.",
          status: "ok",
          ms: 1000,
        },
        {
          agent: "triage",
          stage: "guardrail",
          title: "New-program disclaimer shown",
          detail:
            "Because she's new, the agent surfaces the standard physician-clearance note and the 'not medical advice' disclaimer up front.",
          status: "ok",
          ms: 1000,
        },
        {
          agent: "coord",
          stage: "booking",
          title: "Waitlist auto-promoted",
          detail:
            "A spot opened in the 6 PM HIIT class; she was promoted off the waitlist and notified instantly.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "scribe",
          stage: "session",
          title: "Goal profile drafted for her coach",
          detail:
            "From onboarding answers, a starter goal summary and suggested intro track are drafted for the trainer to review.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "scribe",
          stage: "decision",
          title: "Trainer assignment — coach confirms",
          detail:
            "Agent proposes a beginner-friendly coach and time; the studio lead approves the pairing before it is offered.",
          status: "gate",
          gateBy: "Dana Whitfield · Studio Lead",
          ms: 1200,
        },
        {
          agent: "coord",
          stage: "billing",
          title: "Reminders & prep set",
          detail:
            "Pre-class reminders, what-to-bring notes and a first-week check-in scheduled across SMS and email.",
          status: "ok",
          ms: 1000,
        },
        {
          agent: "monitor",
          stage: "follow",
          title: "Onboarding watch armed",
          detail:
            "First-90-days engagement watch enabled — if she misses her early classes, a coach nudge is staged automatically.",
          status: "ok",
          ms: 1000,
        },
      ],
    },
    {
      key: "sms",
      tabLabel: "After-hours text",
      tabIcon: "message",
      subjectName: "María Reyes · Unlimited member",
      subjectDesc: "After-hours text, in Spanish — nutrition question",
      channel: "SMS · After hours",
      channelIcon: "message",
      steps: [
        {
          agent: "intake",
          stage: "door",
          title: "Spanish text understood & answered",
          detail:
            "Inbound SMS in Spanish recognized at 10:50 PM; member identified and replied to in her own language.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "coord",
          stage: "booking",
          title: "Tomorrow's class swapped",
          detail:
            "Moved her from the 6 AM to the 7 AM spin class and confirmed the waitlist spot freed up — all over text.",
          status: "ok",
          ms: 1100,
        },
        {
          agent: "knowledge",
          stage: "guardrail",
          title: "Nutrition question — refused & routed",
          detail:
            "She asked for a meal plan to lose weight fast. The agent gave general approved tips with sources, explicitly did NOT prescribe a diet, and offered to book a licensed dietitian — in Spanish.",
          status: "esc",
          ms: 1300,
        },
        {
          agent: "coord",
          stage: "decision",
          title: "Dietitian consult held — staff confirms",
          detail:
            "A paid nutrition consult slot is held; the front desk approves before it is promised to the member.",
          status: "gate",
          gateBy: "Owen Hartley · Front Desk",
          ms: 1200,
        },
        {
          agent: "intake",
          stage: "follow",
          title: "Confirmed in Spanish + reminders",
          detail:
            "Sent the swapped class and the consult details in Spanish, with a reminder the morning of.",
          status: "ok",
          ms: 1000,
        },
      ],
    },
  ],
  gateNote:
    "Every member-impacting action waits for a coach or owner. Rach.Dev drafts, stages and routes — a human approves the save, the charge and the pairing.",
  completeToast: "Journey complete — every member-impacting action was human-approved",

  // ---------------- ROSTER (relay) ----------------
  rosterTitle: "Seven specialists, one conductor",
  rosterIntro:
    "Each agent owns one job and hands the next a complete, structured context. Atlas routes the work, enforces the human-in-the-loop gates, and writes every action to an audit log.",
  rosterClickNote: "Click Ava below — the full booking-to-retention workflow plays out automatically.",
  orchestratorName: "Atlas",
  orchestratorBlurb:
    "Atlas is the orchestrator. It routes each member to the right specialist, carries shared profile context between them, pauses for coach or owner approval on every member-impacting action, and records a complete, timestamped audit trail.",
  relayTriggerAgentKey: "intake",
  relayCompleteToast: "Workflow complete — all agents processed Jessica Tran's booking",
  agents: [
    {
      key: "intake",
      name: "Ava",
      role: "Front Desk · Membership & Booking",
      icon: "intake",
      blurb:
        "The front door. Captures every inquiry across phone, SMS, web chat and walk-in, books classes, manages waitlists, and links the member profile — 24/7, in English or Spanish.",
      tags: ["Multi-channel intake", "Class booking & waitlist", "EN / ES"],
      pipeSub: "Intake",
      workMs: 2000,
      voice: {
        listeningTitle: "Listening…",
        listeningSub: "Capturing membership & class booking by voice",
        doneTitle: "Booking complete",
        doneSub: "6 fields captured · handing off to the team…",
        handoffToast: "Ava done — watch the team pick it up",
        fields: [
          { label: "Member", value: "Jessica Tran · New member" },
          { label: "Request", value: "Book first two classes this week" },
          { label: "Goal", value: "Beginner — general fitness & consistency" },
          { label: "Profile", value: "Matched in ClubReady (account verified)", ok: true },
          { label: "Package", value: "Intro 8-class pack — credits confirmed", ok: true },
          { label: "Channel", value: "Web chat · English" },
        ],
      },
    },
    {
      key: "triage",
      name: "Marcus",
      role: "Disclaimers & Cancellation Law",
      icon: "shieldAlert",
      blurb:
        "Compliance & disclaimers. Surfaces the 'not a clinician / not a dietitian' line, prompts for physician clearance on new programs, and enforces state auto-renewal and cancellation rules before any offer is made.",
      tags: ["Health disclaimers", "Auto-renewal & cancellation law", "Guardrails"],
      pipeSub: "Compliance",
      workMs: 2100,
      flow: [
        {
          fromLabel: "Context from Ava",
          chips: ["Jessica Tran · new member", "Intro pack", "First week"],
        },
        {
          steps: [
            { text: "New-program physician-clearance note surfaced", kind: "ok" },
            { text: "'Not medical or nutrition advice' disclaimer attached", kind: "ok" },
            { text: "State cancellation & auto-renewal terms checked on file", kind: "ok" },
          ],
          note: "Marcus is the guardrail. It never gives medical or dietary advice and blocks any offer that breaks state cancellation law.",
        },
      ],
    },
    {
      key: "scribe",
      name: "Nora",
      role: "Progress & Coaching Notes",
      icon: "scribe",
      blurb:
        "Progress scribe. Logs workouts, surfaces streaks and milestones, and drafts the between-session check-in and goal summary — leaving the coach to decide, not type.",
      tags: ["Workout logging", "Milestones & trends", "Coach drafts"],
      pipeSub: "Progress",
      workMs: 2000,
      flow: [
        {
          fromLabel: "Context from Marcus",
          chips: ["Beginner profile", "Goal: consistency", "Cleared to start"],
        },
        {
          steps: [
            { text: "Starter goal summary drafted from onboarding answers", kind: "ok" },
            { text: "Intro track and pacing suggested for the trainer", kind: "ok" },
            { text: "Trainer pairing flagged for coach approval before offer", kind: "ok" },
          ],
          note: "Draft only. A coach is assigned solely after a human approves the pairing.",
        },
      ],
    },
    {
      key: "coord",
      name: "Owen",
      role: "Booking & Scheduling",
      icon: "coord",
      blurb:
        "Booking coordination. Books and swaps classes, promotes the waitlist the instant a spot opens, handles freezes and reschedules, and keeps members showing up with reminders.",
      tags: ["Scheduling & swaps", "Waitlist promotion", "Reminders"],
      pipeSub: "Booking",
      workMs: 1900,
      flow: [
        {
          fromLabel: "Context from Nora",
          chips: ["6 PM HIIT", "Waitlist: 1 spot", "First-week reminders"],
        },
        {
          steps: [
            { text: "Waitlist auto-promoted and member notified instantly", kind: "ok" },
            { text: "Pre-class reminders + what-to-bring notes scheduled", kind: "ok" },
            { text: "First-week check-in queued across SMS and email", kind: "ok" },
          ],
        },
      ],
    },
    {
      key: "revenue",
      name: "Riley",
      role: "Billing & Retention",
      icon: "revenue",
      blurb:
        "Billing & retention. Recovers failed payments via Stripe, drafts cancellation saves — freeze, downgrade or pause — and applies plan changes within state cancellation law once a human signs off.",
      tags: ["Stripe dunning", "Cancellation saves", "Plan changes"],
      pipeSub: "Billing",
      workMs: 2000,
      flow: [
        {
          fromLabel: "Context from Owen",
          chips: ["At-risk member", "Freeze + downgrade", "Within policy"],
        },
        {
          steps: [
            { text: "Failed-charge retry and dunning sequence staged in Stripe", kind: "ok" },
            { text: "Save offer drafted — 2-month freeze + class-pack downgrade", kind: "ok" },
            { text: "Out-of-policy save blocked → owner approval required", kind: "esc" },
          ],
          note: "Riley drafts and stages. No cancel, charge or save is finalized without an owner's approval.",
        },
      ],
    },
    {
      key: "knowledge",
      name: "Iris",
      role: "Knowledge Assistant",
      icon: "knowledge",
      blurb:
        "The role-aware knowledge assistant. Answers members, trainers and front desk from your approved sources only — every answer cited, and never a diagnosis, prescription or diet plan.",
      tags: ["Role-aware", "Cited answers", "Never medical advice"],
      pipeSub: "Knowledge",
      workMs: 1900,
      flow: [
        {
          fromLabel: "Context from Riley",
          chips: ["Member view", "Approved sources only", "EN / ES"],
        },
        {
          steps: [
            { text: "Answered class, pricing and policy questions from approved content", kind: "ok" },
            { text: "Every answer carried its source citation", kind: "ok" },
            { text: "Diet / medical request → handed to a licensed pro, not answered", kind: "esc" },
          ],
          note: "Iris informs. It never prescribes a diet, diagnoses, or replaces a licensed dietitian or physician.",
        },
      ],
    },
    {
      key: "monitor",
      name: "Hope",
      role: "Engagement Sentinel",
      icon: "monitor",
      blurb:
        "The Engagement Sentinel. Always on, reading attendance and behavior for every member — flagging the silent drift toward cancellation weeks before it happens, and staging a personal save for the coach.",
      tags: ["Always-on monitor", "Churn early-warning", "Advisory only"],
      pipeSub: "Engagement",
      workMs: 2400,
      live: { label: "Live · Engagement" },
      flow: [
        {
          fromLabel: "Context from the studio",
          chips: ["Member roster", "Booking + check-in history", "Plan & tenure"],
        },
        {
          fromLabel: "How Hope calibrates for this member",
          steps: [
            { text: "Baselines each member's normal visit rhythm and class mix", kind: "ok" },
            { text: "Weights tenure, plan value and onboarding stage", kind: "ok" },
            { text: "Suppresses noise from travel, holidays and known freezes", kind: "ok" },
          ],
        },
        {
          fromLabel: "What Hope watches in real time",
          chips: ["Visit frequency", "Days since last visit", "No-show streaks", "Class cancels", "Failed payments", "App inactivity"],
          steps: [
            { text: "Attendance drop — visits down sharply vs. personal baseline", kind: "esc" },
            { text: "Ghosting — long gap since last check-in for an active plan", kind: "esc" },
            { text: "No-show pattern — repeat late-cancels and missed classes", kind: "esc" },
            { text: "Onboarding stall — new member missing first-week classes", kind: "esc" },
            { text: "Billing friction — failed charge with no booking activity", kind: "esc" },
            { text: "Cancel intent — pricing / cancellation pages viewed repeatedly", kind: "esc" },
          ],
          note: "Hope is advisory. It flags and stages a personal save — a coach or owner decides and reaches out. Every flag is logged with the signal that triggered it.",
        },
      ],
    },
  ],

  // ---------------- ARCHITECTURE ----------------
  archTitle: "One layer over the systems you already run",
  archIntro:
    "Rach.Dev sits on top of your booking platform and existing tools — orchestrating agents, enforcing governance, and keeping a coach in the loop. No rip-and-replace.",
  archLayers: [
    {
      n: "Layer 4",
      title: "Human-in-the-loop",
      icon: "decision",
      body: "Every member-impacting action — cancellation saves, charges, freezes, trainer pairings — pauses for a coach or owner to approve. Agents draft and stage; people decide.",
      pills: ["Approval gates", "Owner sign-off", "Role-based access"],
    },
    {
      n: "Layer 3",
      title: "Governance & audit",
      icon: "shield",
      body: "Health and nutrition disclaimers, state auto-renewal & cancellation rules, member-data consent, and a complete, timestamped audit trail on every action and data touch.",
      pills: ["Disclaimers enforced", "Cancellation-law aware", "Full audit log", "Source citations"],
    },
    {
      n: "Layer 2",
      title: "Agent orchestration",
      icon: "orchestrator",
      body: "Atlas routes each member to the right specialist, carries shared profile context between agents, and coordinates hand-offs end to end.",
      pills: ["Routing & hand-off", "Shared context", "Escalation paths"],
    },
    {
      n: "Layer 1",
      title: "Integration",
      icon: "plug",
      body: "Bidirectional connectors to your booking platform, billing and messaging over the APIs your systems already speak.",
      pills: ["Booking APIs", "Stripe billing", "Webhooks & APIs"],
    },
  ],
  archBaseLabel: "Works with the systems you already run",
  archBaseSystems: ["Mindbody", "Zen Planner", "ClubReady", "Stripe", "Twilio"],

  // ---------------- KNOWLEDGE ----------------
  knowledgeTitle: "A knowledge layer that knows its limits",
  knowledgeIntro:
    "Iris answers members, trainers and front desk from your approved sources only. Every answer is cited — and any medical or nutrition-therapy question is always handed to a licensed professional, never answered as advice.",
  knowledgeAgentName: "Iris",
  knowledgeViewLabel: "Member view",
  knowledgeGreeting:
    "Hi, I'm Iris. Ask me about classes, your membership, pricing or freezes — I'll always cite my source.",
  knowledgeDisclaimer:
    "Iris provides information only — never medical, diagnostic or nutrition-therapy advice. Anything clinical or dietary is routed to a licensed professional.",
  knowledge: [
    {
      q: "How do I freeze my membership while I travel?",
      a: "You can freeze your Unlimited plan for up to 3 months per year at no charge. Tell me your start and end dates and I'll stage the freeze for the front desk to confirm — your billing pauses for that window and your credits are held. You can also do this anytime from the member app.",
      src: ["Membership policy", "Booking platform"],
    },
    {
      q: "¿Puedo cancelar mi membresía y me devuelven el dinero?",
      a: "Puede cancelar según los términos de su contrato y la ley de renovación automática de su estado. Le mostraré el aviso requerido y las fechas exactas, y el equipo confirmará la cancelación. Antes de cancelar, ¿le gustaría ver opciones como una pausa o un plan más pequeño? Para reembolsos, lo conecto con la recepción.",
      src: ["Cancellation policy", "State auto-renewal law", "Front desk routing"],
    },
    {
      q: "What should I eat to lose 10 pounds before my wedding?",
      a: "That's a nutrition-therapy question, so I won't prescribe a diet or plan myself — I'm not a licensed dietitian. I can share our general approved wellness tips with sources, and I'd recommend booking a consult with a licensed dietitian; I can hold a slot for you. If you have a medical condition, please check with your physician before starting any new program.",
      src: ["General wellness tips", "Dietitian referral", "Health disclaimer policy"],
    },
  ],

  // ---------------- GOVERNANCE ----------------
  governanceTitle: "Governance, not just guardrails",
  governanceIntro:
    "The controls that let a studio actually deploy agents — enforced in the system, not promised on a slide.",
  guarantees: [
    {
      title: "Coach or owner in the loop",
      desc: "Every cancellation save, charge, freeze and trainer pairing waits for a coach or owner to approve. No agent takes a member-impacting action on its own.",
    },
    {
      title: "Complete audit trail",
      desc: "Every action, hand-off and data access is logged with a timestamp, the agent, the source and the approver — exportable on demand.",
    },
    {
      title: "Disclaimers & cancellation law enforced",
      desc: "Agents state clearly they are not clinicians or dietitians, prompt for physician clearance, and follow each state's auto-renewal and cancellation-notice rules — built in, not bolted on.",
    },
    {
      title: "Grounded with sources",
      desc: "Answers come only from your approved knowledge sources and cite them. No open-web guessing, no ungrounded health or diet claims.",
    },
    {
      title: "No vendor lock-in",
      desc: "Standards-based connectors to Mindbody, Zen Planner, ClubReady and Stripe, and your data stays yours. Turn an agent off and your systems keep running.",
    },
  ],
  auditTitle: "Live audit log",
  auditIntro: "A sample of what every action looks like on the record.",
  auditLines: [
    { ts: "22:51:09", text: "Inbound SMS (es) received & answered — member #2207", tag: "ok", tagLabel: "Logged" },
    { ts: "08:14:32", text: "Class swap booked — 6 AM → 7 AM spin, waitlist cleared", tag: "ok", tagLabel: "Booked" },
    { ts: "08:15:01", text: "Nutrition request refused — routed to licensed dietitian", tag: "esc", tagLabel: "Escalated" },
    { ts: "11:02:44", text: "Cancellation-law check passed — state notice window confirmed", tag: "mod", tagLabel: "Checked" },
    { ts: "11:03:18", text: "Retention save drafted — 2-month freeze + downgrade, awaiting sign-off", tag: "mod", tagLabel: "Pending" },
    { ts: "11:04:05", text: "Save approved by Marcus Bell, Owner — freeze applied", tag: "ok", tagLabel: "Approved" },
  ],

  // ---------------- OUTCOMES ----------------
  outcomesTitle: "What changes when agents own the busywork",
  outcomesIntro: "Directional outcomes our pilots target — validated on your own data, never assumed.",
  outcomes: [
    {
      value: "24/7",
      label: "Coverage, every channel",
      desc: "Phone, SMS and web chat answered around the clock, in English and Spanish — no after-hours voicemail or missed booking.",
    },
    {
      value: "Fuller",
      label: "Classes & waitlists",
      desc: "Instant waitlist promotion and no-show follow-up keep capacity used instead of empty.",
    },
    {
      value: "Saved",
      label: "Cancellations turned around",
      desc: "Freeze, downgrade or pause offered before a cancel is processed — within state cancellation law.",
    },
    {
      value: "Hours back",
      label: "For your front desk & coaches",
      desc: "Less booking, chasing and dunning, more time on members and community in the room.",
    },
  ],
  benchmarks: [
    {
      text: "US health clubs see roughly a quarter to a third of their members leave each year, so studios must constantly replace members just to stay even.",
      cite: "IHRSA, Health Club Member Retention / Profiles of Success",
    },
    {
      text: "About half of new gym members quit within their first six months, which is why early-onboarding engagement matters so much.",
      cite: "IHRSA Retention Report (cited by SchedulingKit Fitness Industry Statistics)",
    },
    {
      text: "Under the FTC's 2024 'Click-to-Cancel' Negative Option Rule, sellers of recurring memberships must make cancelling as easy as signing up.",
      cite: "FTC, Final 'Click-to-Cancel' Rule, October 2024",
    },
  ],
  outcomesNote:
    "Figures above are external benchmarks and pilot targets, not guarantees — we validate every number on your own data before you rely on it. Monitoring agents are advisory: they flag and stage a save, a coach or owner acts.",

  // ---------------- CTA ----------------
  ctaTitle: "Start with one workflow. Prove it. Then scale.",
  ctaIntro:
    "We stand up a single workflow on your existing booking platform, show the audit trail and the outcomes, and expand only once your team trusts it.",
  ctaSteps: [
    {
      n: "01",
      title: "Scope one workflow",
      desc: "Pick the highest-pain workflow — class booking, cancellation saves or engagement monitoring — and we map it to your systems.",
    },
    {
      n: "02",
      title: "Pilot in your environment",
      desc: "Agents run on Mindbody, Zen Planner or ClubReady with a coach in the loop and a full audit trail, in weeks not quarters.",
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
      q: "Does Rach.Dev replace our booking software?",
      a: "No. Rach.Dev is an operations layer that runs on top of your existing booking platform — Mindbody, Zen Planner or ClubReady — and your Stripe billing, over their APIs. Your systems of record stay exactly where they are.",
    },
    {
      q: "Do the agents give medical or nutrition advice?",
      a: "No. Agents state clearly that they are not licensed clinicians or dietitians. They share general approved wellness information with sources, prompt members to get physician clearance before new programs, and route any medical or nutrition-therapy question to a licensed professional.",
    },
    {
      q: "Do the agents handle cancellations on their own?",
      a: "No. Every cancellation save, charge, freeze and trainer pairing pauses for a coach or owner to approve, and the agents follow each state's auto-renewal and cancellation-notice rules. The agents draft, stage and route; a human decides.",
    },
    {
      q: "How do the agents reduce churn?",
      a: "The Engagement Sentinel watches attendance, visit gaps, no-show streaks and billing friction for every member, flags who's drifting toward cancellation weeks early, and stages a personal save — a freeze, downgrade or coach check-in — for your team to send.",
    },
    {
      q: "Do the agents work in languages other than English?",
      a: "Yes. Booking, reminders and member answers support English and Spanish out of the box, across phone, SMS and web chat.",
    },
  ],
};
