export interface Industry {
  id: number;
  slug: string;
  name: string;
  icon: string;
  image?: string;
  description: string;
  painPoints: string[];
  complianceNotes: string[];
  templateSlugs: string[];
  /** Slug of the live agent demo at /agents/<slug>, if one exists for this industry. */
  agentDemoSlug?: string;
  /**
   * Live workspace this industry provisions inside the authenticated dashboard.
   * When enabled, a tenant on this industry gets the role-scoped views below
   * (the "one product" seam — same app, different workspace by tenant.industry
   * + role). Consumed by the dashboard nav once the workspace shell exists.
   */
  workspace?: {
    enabled: boolean;
    roles: string[];
    views: { key: string; label: string; href: string; roles: string[] }[];
  };
}

export const industries: Industry[] = [
  {
    id: 1,
    slug: "e-commerce",
    agentDemoSlug: "e-commerce",
    name: "E-Commerce",
    icon: "ShoppingCart",
    description: `E-commerce runs on a relentless 24/7 clock, and most of the load that buries a US online store isn't strategy — it's answering the same order questions, processing returns, screening risky checkouts, and chasing carts that almost converted. Support inboxes spike during sale events and the holidays; refunds and chargebacks pile up; bestsellers stock out mid-promotion; and high-intent shoppers bounce at checkout while roughly seven in ten carts go abandoned. Rach.Dev puts a team of named agents on exactly that busywork, on top of the storefront, payment processor and 3PL you already run.

Ava is the support front door — greeting every shopper across web chat, SMS, WhatsApp and email with a clear AI disclosure, in English or Spanish, and linking the order and history instantly. Marcus triages each contact and order, checks return eligibility against your policy, and scores risk. Nora drafts RMAs, prepaid labels and refunds; Owen pushes approved refunds to the processor and opens RMAs in the 3PL; and Riley screens every order for fraud and chargeback risk without ever touching a raw card number — PCI scope stays with your processor. Iris answers shoppers from your policies and catalog with cited sources and routes anything legal or a payment dispute to a human, and Hope, the always-on Fraud / Cart Sentinel, watches the live order, payment and inventory stream for fraud, abandoned carts, stockouts and shipping delays before they cost you a customer or a chargeback. Every refund, store credit and high-risk order pauses for a person to approve, and every action lands in a complete, timestamped audit trail.

The whole system is PCI-aware and privacy-by-design with configurable GDPR / CCPA retention, AI disclosure on every chat, and a human in the loop on everything that moves money or ships product — the agents draft, stage and route, and a person decides. See the agent team run a return, an after-hours Spanish WISMO text and a held high-risk order end to end in the live e-commerce agents demo.`,
    painPoints: [
      "High support ticket volume during sales events and holiday seasons overwhelms human teams",
      "Cart abandonment rates averaging 70% with no scalable way to recover lost shoppers",
      "Inconsistent responses across support agents leading to customer confusion and brand damage",
      "24/7 coverage requirements that are cost-prohibitive with human-only teams",
      "Difficulty scaling support internationally across time zones and languages",
    ],
    complianceNotes: [
      "PCI DSS compliance required when agents handle payment information — Rach Dev LLP agents never store card numbers and integrate with PCI-compliant payment processors",
      "GDPR and CCPA requirements for customer data handling, including right to deletion and data portability, are supported via configurable data retention policies",
      "Consumer protection regulations require transparent disclosure that customers are interacting with an AI agent, which is built into all e-commerce templates",
    ],
    templateSlugs: [
      "customer-support",
      "cart-recovery",
      "product-recommendation",
      "review-management",
    ],
  },
  {
    id: 2,
    slug: "healthcare",
    name: "Healthcare",
    icon: "Heart",
    description: `Most of a hospital's load isn't clinical judgement — it's coordination, paperwork and chasing. Front desk staff spend hours on phone, SMS and portal messages for scheduling, eligibility checks and intake; clinicians lose roughly two hours of EHR and desk work for every hour of patient care; and billing teams rework claims that could have been caught before submission. Patients, meanwhile, sit on hold or hit after-hours voicemail.

Rach Dev LLP puts a team of agents on that busywork, on top of the EHR you already run. An intake agent captures every inquiry across walk-in, phone, SMS and portal in English or Spanish, verifies identity and insurance, and opens a clean encounter. A triage agent scores acuity and escalates red flags straight to the on-call clinician. A clinical scribe pre-charts the visit and drafts the note, orders and prescriptions for sign-off. Coordination handles scheduling, labs and referrals; a revenue agent codes the encounter in CPT and ICD-10-CM and clears prior-auth and denial risk before the claim goes out; and an always-on ICU sentinel watches the live signal stream for silent deterioration.

Every clinical action — orders, prescriptions, admissions — pauses for a licensed clinician to approve; the agents draft, stage and route, and a human decides. The whole thing is HIPAA-aligned by design with minimum-necessary PHI access and a complete, timestamped audit trail, and the knowledge layer answers only from your approved sources, cites them, and never gives a diagnosis. See it end to end in the live medical agents demo.`,
    painPoints: [
      "Front desk overwhelmed across phone, SMS and portal — patients left on hold or hitting after-hours voicemail",
      "Clinicians losing roughly two hours of EHR and desk work for every hour of direct patient care",
      "Intake, insurance eligibility and prior authorization done manually, slowing every visit",
      "Claims reworked after the fact instead of coding and denial-risk being caught before submission",
      "No always-on safety net watching monitored patients for silent deterioration between rounds",
    ],
    complianceNotes: [
      "Clinician-in-the-loop on every clinical action — no agent issues an order, prescription or admission on its own; monitoring agents are advisory and stage a response for a human to act on",
      "HIPAA-aligned by design: minimum-necessary PHI access, encryption in transit and at rest, role-based permissions, a signed BAA, and a complete, timestamped audit trail on every action",
      "The knowledge layer is grounded only in your approved sources, cites every answer, and never provides a diagnosis — clinical questions are routed to a licensed clinician",
    ],
    templateSlugs: [
      "appointment-scheduling",
      "patient-intake",
      "prescription-reminder",
      "symptom-checker",
    ],
    agentDemoSlug: "medical",
    workspace: {
      enabled: true,
      roles: ["doctor", "reception", "store_manager"],
      views: [
        { key: "control-tower", label: "Control Tower", href: "/dashboard/clinical/control-tower", roles: ["tenant_admin", "admin"] },
        { key: "scribe",        label: "Scribe",        href: "/dashboard/clinical/scribe",        roles: ["doctor"] },
        { key: "reception",     label: "Reception",     href: "/dashboard/clinical/reception",     roles: ["reception"] },
        { key: "inventory",     label: "Inventory",     href: "/dashboard/clinical/inventory",     roles: ["store_manager", "tenant_admin"] },
        { key: "audit",         label: "Audit Log",     href: "/dashboard/clinical/audit",         roles: ["tenant_admin", "admin"] },
      ],
    },
  },
  {
    id: 3,
    slug: "real-estate",
    agentDemoSlug: "real-estate",
    name: "Real Estate",
    icon: "Home",
    description: `Real estate runs on responsiveness, yet most agents are juggling showings, negotiations and paperwork — so the lead who fills out a form at 10 PM hears nothing until the next morning, by which point they have already moved on to the agent who answered first. Rach Dev LLP's real estate agent team closes that gap. Instead of one bot, you get a roster of specialists working your pipeline together: Ava captures every inquiry across Zillow, Realtor.com, web forms, SMS and calls and replies in seconds; Marcus qualifies on budget, financing and timeline conversationally; Iris answers square-footage, lot-size, school and comparable-sales questions straight from your MLS; Owen books and confirms showings against your calendar; and Riley builds client-ready CMAs from active and sold comps. Every agent works on top of the systems you already run — MLS, Follow Up Boss, kvCORE, DocuSign and Google Calendar — so nothing gets re-keyed and nothing gets invented.

What makes the team trustworthy for a US brokerage is the governance underneath it. Recommendations are held to Fair-Housing-safe phrasing with no steering, RESPA guardrails block referral kickbacks, and state licensing disclosure is configured per deployment. Every commitment that actually binds you — a held showing, a listing agreement, an offer or an addendum — pauses for a licensed agent to review and sign; the agents draft, stage and route, but a human always approves. And every action lands on a complete, timestamped audit trail, so you can see exactly what was said, sourced and approved on any deal.

Behind the deals you have already won, Deal Sentinel never sleeps. It watches financing, inspection and appraisal deadlines, contingency windows, leads going cold and price or market shifts near your active contracts — and it flags a loan-commitment date about to lapse or earnest money at risk before it costs you the deal, staging the response for your team to act on. The result is a brokerage that answers in seconds, qualifies every lead, schedules itself, drafts its own paperwork and never loses a deal to a missed deadline — with your agents freed to do the work only humans can. See the whole team run a real after-hours lead, a seller listing appointment and a financing-deadline rescue, end to end, in the live demo.`,
    painPoints: [
      "Lead response times averaging 6+ hours, causing 78% of leads to go with the first agent who responds",
      "Agents spending 3-4 hours daily on administrative tasks instead of closing deals",
      "Inconsistent lead qualification leading to wasted time on unqualified showings",
      "No scalable way to follow up with past clients for referrals and repeat business",
      "Difficulty providing instant property information after hours and on weekends",
    ],
    complianceNotes: [
      "Fair Housing Act compliance is enforced in all templates — agents are configured to never discriminate based on race, color, religion, sex, disability, familial status, or national origin in property recommendations",
      "State-specific real estate licensing disclosure requirements are configurable per deployment, ensuring proper identification of AI vs. licensed agent interactions",
      "RESPA compliance guardrails prevent agents from making referral arrangements or kickback suggestions outside of permitted business relationships",
    ],
    templateSlugs: [
      "property-inquiry",
      "lead-qualification",
      "showing-scheduler",
      "market-analysis",
    ],
  },
  {
    id: 4,
    slug: "legal",
    agentDemoSlug: "legal",
    name: "Legal",
    icon: "Scale",
    description: `For a law firm, responsiveness is revenue. The prospect who fills out your contact form at 9 PM, the existing client who emails a contract for review, the personal-injury inquiry whose statute of limitation is quietly counting down — each is a moment where speed, screening and a steady hand on deadlines decide whether the matter is won, lost or never opened at all. Yet attorneys are in court, in depositions and in meetings, and intake too often lives in voicemail and email chains that stretch over days. By the time the file reaches a lawyer, the client has retained the firm that answered first.

Rach.Dev puts a team of seven specialist agents on that load, on top of the systems your firm already runs — Clio, MyCase, NetDocuments, court e-filing and Outlook. Ava works the front door across web, phone, SMS and chat, asking the right practice-area questions and building a structured intake packet 24/7 in English or Spanish. Marcus runs the conflict check and scores case viability against your criteria. Nora drafts engagement letters, demand letters and redlines from your own templates. Owen calendars deadlines and stages e-filing packets, Riley captures billable time and pre-bills against the engagement, and Iris answers clients from your approved sources with every answer cited. Always-on, Hope is the Docket Sentinel — watching every matter's statutes of limitation, filing deadlines, court dates and appeal periods and surfacing them weeks ahead. Atlas, the orchestrator, routes the work, carries shared matter context, and writes every action to an audit trail.

Two lines never move. An attorney approves every engagement, filing and outbound document — agents draft and stage, a licensed lawyer decides — and a hard Unauthorized Practice of Law guardrail keeps the agents from ever giving legal advice, interpreting the law or recommending a strategy; anything that calls for legal judgment is routed to a human. See the live demo to watch the agent team run a real matter end to end, from a midnight Spanish-language text to an approaching statute of limitation, with the attorney in the loop on every step.`,
    painPoints: [
      "New client inquiries going to voicemail during business hours when attorneys are in court or meetings",
      "Intake process taking 3-5 days from first contact to attorney review, losing prospects to faster firms",
      "Clients calling weekly for case updates, consuming paralegal time and clogging phone lines",
      "Standard document drafting eating into billable hours that could be spent on substantive legal work",
      "Difficulty scaling client communication as caseload grows without adding expensive headcount",
    ],
    complianceNotes: [
      "Unauthorized Practice of Law (UPL) guardrails are enforced on all legal templates — agents never provide legal advice, interpret laws, or recommend specific legal strategies",
      "Attorney-client privilege protections are maintained by ensuring agent conversations are stored in the firm's systems under the firm's control, with no third-party access",
      "State bar advertising rules compliance is configurable per jurisdiction, ensuring agents adhere to solicitation and communication requirements",
    ],
    templateSlugs: [
      "client-intake",
      "document-drafting",
      "case-status",
      "billing-assistant",
    ],
  },
  {
    id: 5,
    slug: "financial-services",
    agentDemoSlug: "financial-services",
    name: "Financial Services",
    icon: "Landmark",
    description: `Financial services firms — banks, credit unions, wealth managers and fintechs — run on some of the most sensitive, most regulated interactions in the economy. Every balance check, transfer, new-account application and investment question touches KYC, BSA/AML, OFAC or SEC/FINRA territory at once. Customers expect instant, personalized service; regulators expect airtight controls and a paper trail for everything. Rach.Dev resolves that tension by putting a coordinated team of AI agents on the regulated busywork — not a single chatbot, but specialists that each own one job and hand the next a complete, structured context, with a compliance officer in the loop on every regulated action.

Ava works the front door, capturing applications across web, phone, SMS and branch and collecting CIP data without the drop-off that costs US institutions clients at the hardest step. Marcus proofs identity and screens against OFAC, PEP and watchlists, stopping cold on any adverse hit. Nora assembles KYC packets and drafts SAR/CTR narratives — drafts only, never filings. Owen stages accounts, funding and warm hand-offs; Riley runs Reg E disputes and chargebacks against the regulatory clock. Iris answers from your approved sources with citations and refuses to give personalized investment advice, routing it to a licensed advisor. And Hope, the always-on Fraud/AML Sentinel, reads the live transaction stream for structuring, sanctions exposure, account takeover and card fraud — alerting and staging, while a BSA officer or analyst decides. Atlas orchestrates the whole relay and writes a timestamped, exam-ready audit trail.

It all runs as a layer on top of the systems you already operate — core banking (FIS, Fiserv, Jack Henry), Plaid, sanctions and identity-verification APIs, and Salesforce Financial Services Cloud — so there is no rip-and-replace, just compliance-first automation with human approval gates baked in. See exactly how the team handles a new-account opening, an AML structuring alert and an after-hours fraud text in the live demo.`,
    painPoints: [
      "KYC verification processes taking days instead of minutes, causing customer drop-off during onboarding",
      "Call centers overwhelmed with routine balance inquiries and transfer requests that could be automated",
      "Fraud detection lag time allowing unauthorized transactions to propagate before being caught",
      "Compliance requirements making it difficult to deploy customer-facing automation without legal review",
      "Lack of personalized financial guidance at scale, reserving advisor time for high-net-worth clients only",
    ],
    complianceNotes: [
      "SEC and FINRA compliance guardrails ensure agents never provide personalized investment advice or make suitability recommendations without proper licensing disclosures",
      "BSA/AML (Bank Secrecy Act / Anti-Money Laundering) requirements are supported via integration with identity verification and sanctions screening APIs",
      "SOC 2 Type II certified infrastructure with dedicated tenant isolation meets financial regulatory requirements for data security and access controls",
    ],
    templateSlugs: [
      "kyc-verification",
      "transaction-support",
      "investment-advisor",
      "fraud-detection",
    ],
  },
  {
    id: 6,
    slug: "education",
    agentDemoSlug: "education",
    name: "Education",
    icon: "GraduationCap",
    description: `Most of a campus's load isn't teaching — it's coordination, paperwork and chasing. Admissions teams lose qualified applicants who can't get a timely answer about programs, deadlines or transfer credit; help desks drown in the same registration, transcript and financial-aid questions every term; advisors spend their days digging through the SIS instead of advising; and students who are quietly sliding toward a withdrawal go unnoticed until it's too late. Roughly three in five US college students say financial stress alone has made them consider dropping out — a signal no one is watching in real time.

Rach Dev LLP puts a team of agents on that busywork, on top of the SIS, LMS and CRM you already run — Banner, PeopleSoft or Workday Student, Canvas or Blackboard, and Slate. An enrollment-advising agent captures every inquiry across web, phone, SMS and chat in English or Spanish, matches the student to the SIS, and opens a clean advising thread. A records-and-compliance agent verifies identity before any education record is shared and routes Title IX or harassment disclosures straight to the right office, never adjudicating a claim itself. An academic planner runs the degree audit and drafts a semester plan for sign-off; a student-success coordinator handles advising, holds and referrals; a bursar agent explains balances and clears what blocks registration; and an always-on At-Risk Student Sentinel reads attendance, grades and LMS engagement to flag a quiet slide weeks before it becomes a withdrawal.

Every high-stakes action — admission offers, registration, hold clearance, Title IX intake — pauses for an advisor, bursar or coordinator to approve; the agents draft, stage and route, and a person decides. The whole thing is FERPA-aligned by design, with identity verified before any record is released, minimum-necessary access, and a complete, timestamped audit trail, and the knowledge layer answers only from your approved sources, cites them, and refuses legal, immigration or clinical advice — handing those to a licensed professional. See it run end to end, from inquiry to enrollment, in the live education agents demo.`,
    painPoints: [
      "Admissions teams unable to respond to inquiries fast enough, losing prospective students to faster-responding institutions",
      "Student help desks overwhelmed with repetitive administrative questions during enrollment and exam periods",
      "Limited availability of tutoring and academic support outside of business hours",
      "Course advising bottlenecks where students wait weeks for an appointment with an overwhelmed advisor",
      "High dropout rates partially attributed to students feeling unsupported and unable to get timely help",
    ],
    complianceNotes: [
      "FERPA (Family Educational Rights and Privacy Act) compliance ensures student education records are never disclosed without proper authorization — agents verify identity before sharing academic information",
      "ADA accessibility requirements are supported with configurable agent interactions that accommodate screen readers and alternative input methods",
      "Title IX awareness is configured into student support agents, which are trained to recognize and appropriately route reports of discrimination or harassment",
    ],
    templateSlugs: [
      "tutoring-assistant",
      "student-support",
      "enrollment-advisor",
      "course-recommendation",
    ],
  },
  {
    id: 7,
    slug: "hospitality",
    agentDemoSlug: "hospitality",
    name: "Hospitality",
    icon: "Hotel",
    description: `Hotels, resorts and restaurants compete on experience, and in a US market where roughly two-thirds of properties still report staffing shortages, the difference between a 4-star and a 5-star review keeps coming down to responsiveness: did the booking inquiry get answered before the guest clicked away, was the accessibility need honored, did someone catch the problem before it became a public review? Rach.Dev puts a coordinated team of AI agents on exactly that work, sitting on top of the PMS, booking engine and dining tools you already run — Oracle OPERA, Mews, Cloudbeds, OpenTable, SynXis, Twilio and WhatsApp Business — with no rip-and-replace.

Maya works the front door, capturing every reservation inquiry across web chat, WhatsApp, SMS and phone in English or Spanish; Caleb screens availability and honors ADA accessibility requirements; Olivia builds quotes from live rates; Owen syncs bookings and routes housekeeping and dining; Riley handles revenue, upsells and rate — and stages every comp, override and refund for a manager. Iris is the cited, role-aware concierge that knows its limits and never gives legal or medical advice, while Hope, the always-on Service-Recovery Sentinel, reads in-stay sentiment to catch unhappy and VIP guests before they reach TripAdvisor. PCI DSS is enforced by design — payments run through your compliant booking engine and raw card data never touches Rach.Dev — and every action lands in a complete, timestamped audit trail.

The result is 24/7 coverage that never loses an inquiry to peak hours, quotes and holds in seconds, problems recovered in-house instead of in a one-star review, and hours handed back to a front desk that's stretched thin. A manager stays in the loop on every comp, rate override and refund — agents draft and stage, people decide. See the seven-agent team run a real booking, an after-hours Spanish WhatsApp request and a live service-recovery save in the interactive demo.`,
    painPoints: [
      "Reservation inquiries going unanswered during peak hours, resulting in lost bookings worth hundreds per room night",
      "Front desk staff unable to provide personalized concierge service when juggling check-ins and phone calls simultaneously",
      "Negative reviews posted publicly before the hotel has a chance to resolve the guest's complaint",
      "Seasonal staffing challenges making it impossible to maintain service levels during high-demand periods",
      "Event and group booking inquiries requiring multiple back-and-forth emails over days to finalize",
    ],
    complianceNotes: [
      "PCI DSS compliance for payment information handling — agents integrate with PCI-compliant booking engines and never store credit card numbers",
      "ADA and accessibility accommodation requirements are handled by agents that proactively ask about accessibility needs and ensure room assignments meet stated requirements",
      "Local hospitality licensing and tourism regulations are configurable per property, ensuring agents provide information consistent with local legal requirements",
    ],
    templateSlugs: [
      "reservation-agent",
      "concierge",
      "feedback-collector",
      "event-planner",
    ],
  },
  {
    id: 8,
    slug: "saas",
    agentDemoSlug: "saas",
    name: "SaaS",
    icon: "Cloud",
    description: `SaaS companies live and die by retention, and the day-to-day work that decides it almost never requires a senior engineer's judgment — it's the same tier-1 tickets, the onboarding that stalls, the invoice question, and the quiet account that cancels before anyone notices. Rach.Dev puts a team of seven specialized agents on exactly that work, on top of the US stack you already run: Zendesk or Intercom for support, Stripe for billing, Segment for product signals, Salesforce or HubSpot for CRM, your status page and PagerDuty for incidents. Ava works the front door across in-app chat, email, SMS and WhatsApp in English and Spanish; Marcus scores severity and trips the hard guardrail the instant a security or SLA red-flag appears; Nora turns a vague complaint into a reproducible bug report so engineers fix instead of interrogate; Owen drives onboarding and activation; and Riley handles billing and dunning — while never moving a cent without a human signing off.

The difference is the guardrails are enforced, not promised. Every risky action — a refund, a service credit, an incident disclosure, a breach response — pauses for a named human to approve, and every action, hand-off and data touch is written to a timestamped audit trail you can export straight into your SOC 2 evidence. Iris, the docs assistant, answers only from your approved help center and cites its source, and it explicitly refuses to give security, legal or compliance counsel — routing those questions to a human owner instead. The whole layer is SOC 2-aligned and GDPR-ready by design, with least-privilege access and configurable retention, and it's standards-based: turn an agent off and your stack keeps running exactly as before.

Overhead it all sits Hope, the always-on Churn / SLA Sentinel, reading usage, support sentiment, SLA clocks and renewal dates across every account to flag a quiet or at-risk customer weeks before the cancel screen — advisory only, staging a save play for customer success to decide and act on. Atlas, the orchestrator, routes each ticket, carries shared account context between agents, and holds the human-in-the-loop gates. Want to see it in motion? Press play on the live demo and watch the team run a real ticket end to end — a security incident, a new-account onboarding, and an after-hours Spanish WhatsApp message — with a human approving every risky step.`,
    painPoints: [
      "Support ticket volume growing 3x faster than customer base due to increasing product complexity",
      "Senior engineers spending 40% of their time on tier-1 support instead of product development",
      "New user activation rates below 30% because onboarding is self-serve and often confusing",
      "Customer feedback scattered across email, support tickets, social media, and sales calls with no aggregation",
      "Churn detected only at renewal time when it is too late to intervene effectively",
    ],
    complianceNotes: [
      "SOC 2 Type II compliance is maintained through dedicated infrastructure, encrypted data storage, and comprehensive audit logging — critical for enterprise SaaS customers",
      "GDPR data processing requirements are supported with configurable data retention, right to deletion, and data export capabilities for agents handling EU customer data",
      "SLA compliance tracking is built into agent analytics, ensuring support response times meet contractual obligations",
    ],
    templateSlugs: [
      "technical-support",
      "onboarding-assistant",
      "feature-request-collector",
      "churn-prevention",
    ],
  },
  {
    id: 9,
    slug: "recruitment",
    agentDemoSlug: "recruitment",
    name: "Recruitment",
    icon: "Users",
    description: `Recruiting in the US has become a volume game that punishes the human work that actually wins hires. One posting draws hundreds of applicants, the best candidates field competing offers within days, and recruiters spend their time parsing résumés, herding interview panels onto a calendar, and re-keying notes into Greenhouse, Lever or Workday instead of building relationships and calibrating with hiring managers. Rach.Dev puts a coordinated team of AI agents on that pipeline so your recruiters get their judgment hours back. Ava works the front door — capturing every applicant across your careers page, job boards and SMS, parsing the résumé and opening a clean ATS record in seconds. Marcus screens strictly on the job-relevant rubric you configure, with EEOC and ban-the-box guardrails that refuse protected-class and prohibited questions and escalate any disallowed filter rather than quietly applying it.

From there the work flows the way your team already runs it. Nora matches your talent pool and LinkedIn to the open req and drafts personalized outreach you approve before it sends; Owen solves the multi-party scheduling nightmare end to end, including reschedules; Riley drafts offers at the approved band and tracks time-to-fill, source-of-hire and placement status. Iris answers candidates, recruiters and hiring managers from your approved sources only — in English and Spanish — and hands any legal, immigration or work-eligibility question to a human instead of guessing. Watching over all of it, Hope, the always-on Pipeline Sentinel, flags aging reqs, candidates going cold and offer-decline risk before a top prospect slips to a competitor. Every recommendation is advisory, and every hiring decision — advance, reject, offer — pauses for a recruiter or hiring manager to approve, with a full, OFCCP/EEO-ready audit trail on every action.

The whole team runs as an operations layer on top of the ATS, calendars, sourcing channels and HRIS you already use — no rip-and-replace, your candidate data stays yours, and you can start with a single req type, prove it on your own numbers, then scale. See the agent team run a real pipeline, from inbound applicant to an after-hours Spanish text to a live EEOC compliance catch, in the interactive live demo below.`,
    painPoints: [
      "Recruiters spending 60% of their time on administrative tasks like screening and scheduling instead of relationship building",
      "Average time-to-fill exceeding 40 days, causing top candidates to accept competing offers",
      "Inconsistent candidate screening leading to unqualified candidates reaching the interview stage",
      "New hire onboarding consuming 10+ hours of HR and manager time per employee in the first month",
      "Talent pool databases going stale because there is no scalable way to re-engage past candidates for new roles",
    ],
    complianceNotes: [
      "EEOC compliance guardrails ensure screening agents never discriminate based on protected characteristics — all screening criteria must be job-relevant and consistently applied",
      "GDPR and data retention requirements for candidate data are supported with configurable retention periods and automatic deletion of applicant data after the mandated period",
      "Ban-the-box and fair chance hiring regulations are configurable per jurisdiction, ensuring agents do not inquire about criminal history where prohibited",
    ],
    templateSlugs: [
      "candidate-screening",
      "interview-scheduler",
      "onboarding-buddy",
      "job-matching",
    ],
  },
  {
    id: 10,
    slug: "professional-services",
    agentDemoSlug: "professional-services",
    name: "Professional Services",
    icon: "Briefcase",
    description: `Professional services firms — consultancies, agencies, accounting and architecture practices — sell expertise by the hour, yet the work that actually fills the day is rarely billable. Proposals, status emails, change-order haggling, timesheet chasing and invoice follow-ups quietly erode utilization while clients still expect proactive communication and fast turnaround. Rach.Dev puts a coordinated team of AI agents on that overhead: Ava captures and qualifies every inbound lead and RFP, Marcus screens each engagement for conflicts, confidentiality and professional-licensing scope, Nora drafts proposals and deliverables from your own past wins and rate cards, Owen runs project coordination and proactive client comms, and Riley handles invoicing, change-order pricing and AR follow-up — every client commitment paused for an engagement lead to approve.

Built for the realities of US firms, the system runs on top of the tools you already use — HubSpot, Monday.com, Harvest, QuickBooks and Slack — with no rip-and-replace. Each client's data is isolated so agents never cross-reference one engagement against another, every action lands in a complete, timestamped audit trail, and agents stay strictly in support roles: any request for a licensed opinion (legal, tax, audit, licensed architecture) is routed to a credentialed professional rather than answered. Overseeing it all, the Project-Health Sentinel watches budgets, timelines, scope-versus-SOW, AR aging and utilization across every active engagement, flagging scope creep as a priced change order before the hours get written off and surfacing cash and deadline risk before it becomes a client crisis.

The result is higher billable utilization, scope creep caught early, and cash in the door faster — without handing client trust to a black box, because a human approves every proposal, change order and payment term. See exactly how the agent team runs an engagement, from a new RFP to a scope-creep escalation to an after-hours WhatsApp billing question, in the live demo.`,
    painPoints: [
      "Senior consultants spending 8-10 hours per week on proposal writing that could be partially automated",
      "Clients complaining about lack of communication while project managers struggle to find time for status updates",
      "Invoice disputes and late payments causing cash flow problems due to unclear or delayed billing",
      "Knowledge trapped in individual consultants' heads, lost when they leave or transition between projects",
      "Utilization rates below 70% because too much time is spent on non-billable administrative work",
    ],
    complianceNotes: [
      "Client confidentiality requirements are enforced through data isolation — each client's data is segmented and agents never cross-reference information between client engagements",
      "Professional licensing regulations vary by service type (CPA, licensed architect, etc.) — agents are configured to operate within support roles and never provide licensed professional opinions",
      "Record retention requirements for professional services engagements are supported with configurable retention policies that meet industry-specific standards",
    ],
    templateSlugs: [
      "proposal-generator",
      "ps-billing-assistant",
      "project-status",
      "client-communication",
    ],
  },
  {
    id: 11,
    slug: "insurance",
    agentDemoSlug: "insurance",
    name: "Insurance",
    icon: "Shield",
    description: `Insurance runs on interactions — first notice of loss, quote requests, coverage questions, claim-status checks and renewal outreach — and most of them aren't coverage judgement at all. They're verification, intake, document chasing, status updates and proactive renewal calls that pile onto adjusters and producers while policyholders wait on hold or fight a confusing portal. The complexity of US insurance products means even a simple question can require pulling the policy form, cross-referencing coverage terms and explaining it in plain language across fifty different state regulatory regimes.

Rach Dev LLP puts a team of agents on that busywork, on top of the policy admin system, claims platform, Guidewire and CRM you already run. A claims-and-quote intake agent captures every FNOL and inquiry across phone, SMS, WhatsApp, chat and the web — in English or Spanish — verifies the policyholder and coverage-in-force, and opens a clean file in minutes. A coverage-triage agent scores severity and routes injury, total-loss and SIU red flags to the right licensed adjuster by state. A file agent drafts the loss narrative and captures photos and estimates with policy-form citations; a servicing agent handles estimates, repairs, status and renewals; a billing agent stages payments, reserves and subrogation flags for a licensed human to release. Over all of it, a Claims & Lapse Sentinel watches the open book around the clock for fraud indicators, renewal-lapse risk and fair-claims-practices SLA clocks — staging an SIU referral or a producer outreach before a payout or an expiration. Every coverage decision pauses for a licensed adjuster or producer, and every action lands on a timestamped audit trail built for DOI market-conduct exams, with disclosures and AI-interaction notices aligned to the NAIC Model Bulletin.

The result is 24/7 coverage on every channel, FNOL-to-file in minutes instead of a 30-minute phone call, fraud and lapse risk caught earlier, and hours given back to the licensed professionals who should be doing advisory and coverage work — not typing. See the agent team run a real auto FNOL, a property claim with fraud indicators, and an after-hours Spanish renewal end to end in the live demo.`,
    painPoints: [
      "Claims filing processes averaging 30+ minutes on the phone, frustrating policyholders and increasing operational costs",
      "Policy renewal lapse rates of 15-20% due to insufficient proactive outreach and friction in the renewal process",
      "Licensed agents spending 50% of their time on routine inquiries instead of complex advisory and sales conversations",
      "Customers unable to understand their coverage, leading to disputes at claim time and negative satisfaction scores",
      "Inconsistent information provided by different call center agents due to complex and frequently changing policy terms",
    ],
    complianceNotes: [
      "State insurance department regulations are configurable per jurisdiction — agents include required disclosures, licensing statements, and consumer protection notices specific to each state",
      "NAIC (National Association of Insurance Commissioners) guidelines for AI in insurance are followed, including transparency requirements about AI-assisted interactions",
      "Claims handling regulations vary by state and line of business — agents are configured with jurisdiction-specific guardrails for claims communication and timeline requirements",
    ],
    templateSlugs: [
      "claims-intake",
      "policy-advisor",
      "renewal-reminder",
      "coverage-comparison",
    ],
  },
  {
    id: 12,
    slug: "automotive",
    agentDemoSlug: "automotive",
    name: "Automotive",
    icon: "Car",
    description: `Car dealerships and service centers live and die on speed and follow-through. Every internet lead that sits for hours, every busy service line during the morning rush, every recall letter that never turns into a booked appointment is real money walking to the dealer down the road. The work that decides whether a shopper becomes a buyer — answering the first inquiry, qualifying intent, pulling the right unit from the feed, scheduling against live bay capacity, presenting honest payment numbers — is mostly coordination and chasing, not the human craft of closing a deal. That is exactly the work an agent team should own.

Rach.Dev puts a coordinated team of agents on your front door, your showroom phones and your service drive, running on top of the DMS and CRM you already use — CDK, Reynolds and Reynolds, Dealertrack, VinSolutions and your inventory feed. Ava captures and answers every sales and service inquiry inside the first-five-minute window across web lead, phone, SMS and chat, in English or Spanish. Marcus scores intent and routes hot buyers, Nora reads live inventory and vehicle history, Owen books test drives and service on real availability, and Riley builds payment scenarios with accurate APR, term and total-cost disclosures under the Truth in Lending Act — never a binding credit decision. Hope, the always-on Lead-Speed Sentinel, watches lead age, response SLAs, open recalls and overdue follow-ups, re-engaging before a buyer goes cold. And the hard guardrail is enforced in the system, not promised on a slide: every binding quote and financing term pauses for a licensed F&I or service manager, customer financial data is handled under FTC Safeguards Rule controls, and every action lands in a complete, timestamped audit trail.

Start with one workflow — internet-lead response, service scheduling or recall follow-up — prove it on your own numbers, then scale store by store and department by department. See the agent team capture a lead, book a service appointment and route a Spanish-language recall text end to end, with a manager in the loop on every binding quote, in the live demo.`,
    painPoints: [
      "Internet leads receiving average response times of 3+ hours, far exceeding the 5-minute window where conversion rates are highest",
      "Service department phone lines constantly busy, causing customers to go to competitors for routine maintenance",
      "Sales staff spending hours answering repetitive inventory and pricing questions that could be automated",
      "Inability to provide financing estimates or trade-in values outside of business hours when buyers are actively researching",
      "Poor follow-up processes causing 60% of leads to go cold without meaningful engagement",
    ],
    complianceNotes: [
      "Truth in Lending Act (TILA) compliance ensures financing calculator agents present APR, terms, and total cost disclosures accurately and do not make binding credit offers",
      "FTC Safeguards Rule compliance for handling customer financial information is maintained through encrypted data handling and limited data retention",
      "State-specific dealer licensing and advertising regulations are configurable per location, ensuring agents do not make claims that violate local automotive dealer advertising laws",
    ],
    templateSlugs: [
      "service-scheduler",
      "inventory-inquiry",
      "financing-calculator",
      "trade-in-estimator",
    ],
  },
  {
    id: 13,
    slug: "non-profit",
    agentDemoSlug: "non-profit",
    name: "Non-Profit",
    icon: "HeartHandshake",
    description: `Non-profits are asked to deliver maximum mission with minimum overhead, and the math rarely works. A handful of overstretched program staff end up wearing every hat at once — thanking donors, chasing grant deadlines, scheduling volunteers, reconciling gifts and rebuilding the same impact report every month — so the relationship-building that actually drives giving keeps getting squeezed out. The cost shows up in the numbers the whole sector knows: donor retention hovering around 45%, only about one in five first-time donors ever giving a second gift, and volunteer shifts going unfilled even though each volunteer hour is worth roughly $35.

Rach.Dev puts a team of seven specialized agents on that operational load, running on top of the systems you already use — Salesforce NPSP or Bloomerang, Classy and Givebutter, QuickBooks and Mailchimp — with no rip-and-replace and a discount for qualifying 501(c)(3) organizations. Ava captures every donor and volunteer across web, phone, SMS, email and events and sends a personal thank-you within minutes; Marcus enforces the hard guardrails, blocking campaign-intervention and excessive-lobbying language and inserting the right state charitable-solicitation disclosures by donor state; Nora drafts IRS-compliant tax receipts and grant proposals grounded only in your real impact data, never invented outcomes; Owen runs volunteer shifts and stewardship sequences; Riley reconciles gifts and tracks restricted funds; and Iris answers supporters from your approved sources, routing any tax, legal or political question to a qualified human. Watching over all of it, the Donor-Lapse Sentinel flags lapsing major donors, grant deadlines closing in, and shifts at risk of no-shows before they become missed revenue.

Crucially, every solicitation, tax receipt and grant submission pauses for a staff member to approve — agents draft, stage and route, but a human always decides — and every action lands in a complete, board-ready audit trail. See exactly how the agent team runs a year-end major gift, an after-hours volunteer text in Spanish, and a six-day grant deadline, end to end, in the live demo.`,
    painPoints: [
      "Donor retention rates averaging 45% because organizations lack the staff capacity for consistent personalized communication",
      "Volunteer no-show rates of 30%+ due to inadequate reminder systems and poor pre-event communication",
      "Grant deadlines missed or proposals rushed because staff are juggling program delivery with fundraising duties",
      "Impact reporting consuming 20+ staff hours per month to manually compile data from multiple sources",
      "Small teams unable to scale donor outreach beyond their existing network, limiting fundraising growth",
    ],
    complianceNotes: [
      "IRS 501(c)(3) compliance guardrails ensure agents do not engage in prohibited political campaign activities or excessive lobbying in donor and public communications",
      "Charitable solicitation registration requirements vary by state — agents are configurable to include state-specific disclosures required for online fundraising",
      "Donor data privacy is maintained through strict data isolation, and agents comply with donor opt-out and communication preference requirements",
    ],
    templateSlugs: [
      "donor-engagement",
      "volunteer-coordinator",
      "grant-writer-assistant",
      "impact-reporter",
    ],
  },
  {
    id: 14,
    slug: "fitness-wellness",
    agentDemoSlug: "fitness-wellness",
    name: "Fitness & Wellness",
    icon: "Dumbbell",
    description: `Fitness studios, gyms, and wellness centers win on experience and community, but the day-to-day reality is a front desk buried in class-booking questions, membership inquiries, no-show chases, and cancellation calls — while trainers are too busy coaching to keep members accountable between sessions. Rach.Dev puts a coordinated team of AI agents on that operational load, working on top of the booking and billing systems you already run (Mindbody, Zen Planner, ClubReady, and Stripe) rather than replacing them. Ava handles membership and class booking, waitlists, and reschedules 24/7 across phone, SMS, and web chat in English and Spanish; Owen keeps capacity full with instant waitlist promotion and no-show follow-up; and Riley turns cancellations into saves with freezes, downgrades, and pauses.

Crucially, this is an agent team built for the US fitness market's real guardrails. Marcus enforces the line that agents are not clinicians or dietitians — surfacing physician-clearance prompts and the 'not medical advice' disclaimer — and applies each state's automatic-renewal and cancellation-notice law before any retention offer is ever made. Iris answers members, trainers, and front desk only from your approved sources, cites every answer, and routes any diet or medical question to a licensed professional instead of guessing. And Hope, the always-on Engagement Sentinel, reads attendance drops, visit gaps, no-show streaks, and billing friction to flag who's drifting toward cancellation weeks before they leave — then stages a personal save for a human to send. Every member-impacting action, from a charge to a freeze to a save, pauses for a coach or owner to approve, and every step is written to a complete, timestamped audit log.

The result is fuller classes, lower churn, and a front desk freed to focus on members in the room — without adding headcount or handing decisions to a machine. See exactly how the team runs a cancellation save, a new-member booking, and an after-hours Spanish text in the live demo, where you can press play and watch every escalation, approval gate, and audit line unfold end to end.`,
    painPoints: [
      "Front desk staff spending 60% of their time on phone calls and emails about class schedules and membership questions",
      "Member churn rates averaging 30% annually, with most cancellations happening due to lack of engagement rather than dissatisfaction",
      "Trainers unable to provide between-session support and accountability at scale without working unpaid hours",
      "Class no-show rates of 20%+ resulting in underutilized capacity and frustrated waitlisted members",
      "Nutritional guidance limited to expensive one-on-one consultations that most members cannot afford",
    ],
    complianceNotes: [
      "Health and fitness disclaimer requirements are built into all wellness templates — agents clearly state they are not licensed healthcare providers and recommend consulting physicians before starting programs",
      "Nutrition advisor agents include disclaimers distinguishing general dietary guidance from medical nutrition therapy, which requires a licensed dietitian",
      "Membership contract and cancellation regulations vary by state — agents are configured to comply with local automatic renewal and cancellation notice requirements",
    ],
    templateSlugs: [
      "class-booking",
      "nutrition-advisor",
      "progress-tracker",
      "membership-manager",
    ],
  },
  {
    id: 15,
    slug: "food-beverage",
    agentDemoSlug: "food-beverage",
    name: "Food & Beverage",
    icon: "UtensilsCrossed",
    description: `Restaurants, bars, cafes, catering companies and delivery operations run on razor-thin margins where every missed call, every empty no-show table and every mishandled allergy is money and trust walking out the door. The phone rings through the dinner rush while the line is slammed, premium Friday seats sit empty because a confirmed party never showed, loyalty enrollments go unasked because no one has a free hand, and a single catering inquiry turns into a week of email. Rach.Dev meets that load with a coordinated team of AI agents — not one chatbot — that runs the front-of-house busywork across every channel a US guest actually uses: web chat, SMS, WhatsApp and the phone, in English and Spanish, around the clock.

Each agent owns one job and hands the next a complete, structured context, with an orchestrator (Atlas) routing the work and writing every action to an audit trail. Ava captures orders and reservations at the front door; Marcus runs FALCPA Big-9 allergen disclosure on every dish and enforces alcohol-age and local health rules; Nora drafts allergen-safe menu guidance and catering quotes from your live menu spec; Owen fires clean tickets into Toast, Square or Clover and holds tables in OpenTable or Resy; Riley captures payment and credits loyalty; Iris answers guests from your menu and policies with every answer cited; and Hope, the always-on Ops Sentinel, watches no-shows, late tickets, order errors, rush-hour load and dropping ratings in real time. The hard guardrail is non-negotiable: a severe allergy is never cleared by an agent — it escalates to the kitchen lead, and over-policy discounts, large-party holds and catering quotes wait for a manager or owner to approve. Everything sits on top of the POS, booking, loyalty and delivery systems you already run, with no rip-and-replace.

The result is coverage that never sleeps, fewer empty seats, cleaner tickets to the kitchen and more repeat visits — with a human in the loop on every high-stakes call and a full record behind it. See the agent team run a real allergy order, a peak-Friday reservation and an after-hours Spanish catering inquiry, end to end, in the live demo.`,
    painPoints: [
      "Phone orders during peak hours tying up staff and creating long hold times that lose customers to competitors",
      "Reservation no-show rates of 15-20% wasting premium seating capacity and impacting revenue projections",
      "Staff too busy during service to promote loyalty programs, leaving 70% of customers unenrolled",
      "Online ordering requiring manual entry into POS systems, creating errors and slowing down kitchen operations",
      "Catering inquiries requiring multiple back-and-forth communications over days to finalize menus and pricing",
    ],
    complianceNotes: [
      "Food allergen disclosure regulations (FALCPA and state-specific laws) are enforced in menu advisor agents, which always include allergen warnings and recommend confirming with staff for severe allergies",
      "Local health department and food safety regulations for order handling are configurable per location, ensuring agents communicate preparation and delivery standards accurately",
      "Alcohol service regulations vary by state and locality — agents are configured to verify legal drinking age and comply with local liquor license requirements when applicable",
    ],
    templateSlugs: [
      "order-assistant",
      "reservation-manager",
      "menu-advisor",
      "loyalty-program",
    ],
  },
];
