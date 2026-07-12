import type { IconKey } from "./icons";

/**
 * Industry-demo schema.
 *
 * One industry = one `IndustryConfig` object. The UI in
 * `src/components/industry-demo/*` is built once and renders entirely from this
 * config, so adding a vertical is a new config file + one registry line — no
 * component edits.
 *
 * Everything here MUST be plain serializable data (strings / numbers / arrays /
 * `IconKey` strings) so a Server Component can pass a config straight into the
 * client islands. Never put a `LucideIcon` component or JSX in a config — store
 * an `IconKey` and resolve it via `ICONS[key]` inside the component.
 */

/** ok = autonomous (green "Done") · gate = human approval (green "Approved · <gateBy>") · esc = escalation (amber "Escalated") */
export type StepStatus = "ok" | "gate" | "esc";

/* ---- Control Tower (scenario player) ---- */
export interface ScenarioStep {
  agent: string; // agent key
  stage: string; // journey-stage key
  title: string;
  detail: string;
  status: StepStatus;
  gateBy?: string; // required when status === "gate"
  ms: number; // dwell while this step is "active"
}

export interface Scenario {
  key: string;
  tabLabel: string;
  tabIcon: IconKey;
  subjectName: string; // e.g. "Robert Daniels · 58 / M"
  subjectDesc: string;
  channel: string;
  channelIcon: IconKey;
  steps: ScenarioStep[];
}

export interface JourneyStage {
  key: string;
  label: string;
  icon: IconKey;
}

/* ---- Agent roster (relay) ---- */
export interface VoiceField {
  label: string;
  value: string;
  ok?: boolean; // render the value in green (a confirmed/verified field)
}

export interface VoiceIntake {
  listeningTitle: string;
  listeningSub: string;
  doneTitle: string;
  doneSub: string;
  fields: VoiceField[];
  handoffToast: string;
}

export interface FlowStep {
  text: string;
  kind: "ok" | "esc";
}

export interface FlowBlock {
  fromLabel?: string; // "Context from Ava" etc.
  chips?: string[];
  steps?: FlowStep[];
  note?: string;
}

export interface AgentDef {
  key: string;
  name: string;
  role: string;
  icon: IconKey;
  blurb: string;
  tags: string[];
  pipeSub?: string; // short label under the name in the handoff strip ("Triage", "ICU")
  workMs?: number; // dwell while "processing" during the relay (default ~2000)
  voice?: VoiceIntake; // ONLY on the relay-trigger agent — replaces a flow panel
  flow?: FlowBlock[]; // expand-panel content shown during the relay
  live?: { label: string }; // always-on tag for proactive monitors (e.g. "Live · ICU")
}

/* ---- Operating picture ---- */
export interface DomainCard {
  icon: IconKey;
  title: string;
  blurb: string;
  bullets: string[];
  tag: { label: string; tone: "live" | "muted" | "accent" };
}

/* ---- Architecture ---- */
export interface ArchLayer {
  n: string;
  title: string;
  icon: IconKey;
  body: string;
  pills: string[];
}

/* ---- Knowledge ---- */
export interface KnowledgeQA {
  q: string;
  a: string;
  src: string[];
}

/* ---- Outcomes ---- */
export interface OutcomeCard {
  value: string;
  label: string;
  desc: string;
}

export interface Benchmark {
  text: string;
  cite: string;
}

/* ---- Governance ---- */
export interface Guarantee {
  title: string;
  desc: string;
}

export interface AuditLine {
  ts: string;
  text: string;
  tag: "ok" | "mod" | "esc";
  tagLabel: string;
}

/* ---- CTA ---- */
export interface CtaStep {
  n: string;
  title: string;
  desc: string;
}

/* ---- Optional dark "spotlight" block (used by future verticals e.g. Armed Forces) ---- */
export interface SpotlightCard {
  icon: IconKey;
  title: string;
  kicker: string;
  body: string;
  bullets: string[];
}

export interface SpotlightSection {
  eyebrow: string;
  title: string;
  intro: string;
  stats: { value: string; label: string }[];
  tagline: string; // may contain <b>…</b>
  cards: SpotlightCard[];
}

export interface IndustryConfig {
  slug: string; // "medical" → /agents/medical
  vertical: string; // "Healthcare"
  industrySlug?: string; // related /industries/<slug> for breadcrumb + interlinking
  industryName?: string; // display name of the related industry
  icon?: IconKey; // representative icon for the /agents index card
  tagline?: string; // short one-line summary for the /agents index card
  seoTitle: string;
  seoDescription: string;
  seoKeywords?: string[];

  // HERO
  eyebrow: string;
  h1Lines: string[];
  rotorLead: string;
  rotorWords: string[];
  subhead: string;
  trustRow: string[];
  heroPrimaryCta: { label: string; href: string };
  heroSecondaryCta: { label: string; href: string };

  // OPERATING PICTURE
  operateEyebrow: string;
  operateTitle: string;
  operateIntro: string;
  domains: DomainCard[];

  // CONTROL TOWER
  towerTitle: string;
  towerIntro: string;
  subjectNoun: string; // "patient" | "shipment" | "applicant"
  stages: JourneyStage[];
  scenarios: Scenario[];
  gateNote: string;
  completeToast: string;

  // ROSTER (relay)
  rosterTitle: string;
  rosterIntro: string;
  rosterClickNote: string;
  orchestratorName: string;
  orchestratorBlurb: string;
  agents: AgentDef[];
  relayTriggerAgentKey: string;
  relayCompleteToast: string;

  // ARCHITECTURE
  archTitle: string;
  archIntro: string;
  archLayers: ArchLayer[];
  archBaseLabel: string;
  archBaseSystems: string[];

  // KNOWLEDGE
  knowledgeTitle: string;
  knowledgeIntro: string;
  knowledgeAgentName: string;
  knowledgeViewLabel: string;
  knowledgeGreeting: string;
  knowledgeDisclaimer: string;
  knowledge: KnowledgeQA[];

  // GOVERNANCE
  governanceTitle: string;
  governanceIntro: string;
  guarantees: Guarantee[];
  auditTitle: string;
  auditIntro: string;
  auditLines: AuditLine[];

  // OUTCOMES
  outcomesTitle: string;
  outcomesIntro: string;
  outcomes: OutcomeCard[];
  benchmarks: Benchmark[];
  outcomesNote: string;

  // OPTIONAL dark spotlight block
  spotlight?: SpotlightSection;

  // CTA
  ctaTitle: string;
  ctaIntro: string;
  ctaSteps: CtaStep[];

  // FAQ (drives FAQPage JSON-LD for AEO/GEO; falls back to `knowledge` if absent)
  faq?: { q: string; a: string }[];
}
