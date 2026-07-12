import type { FaqEntry, RaeStep } from "@/lib/demo/types";

/**
 * Scripted content for "Rae" — the concierge / lead-capture agent.
 *
 * Rae's job is a fixed, contact-form-style data collection flow made
 * conversational. No live model: the steps below are walked deterministically,
 * with canned FAQ answers interleaved when the visitor asks about the product.
 */

export const raeGreeting =
  "Hi, I'm Rae 👋 I'll help you find the right agent and get you to the team. First up —";

/** The ordered conversation Rae walks the visitor through. */
export const raeSteps: RaeStep[] = [
  {
    field: "goal",
    kind: "text-or-chips",
    prompt:
      "what are you hoping to build or automate? Pick an industry, or tell me in a sentence.",
    chips: [
      { label: "E-Commerce", value: "E-Commerce" },
      { label: "Healthcare", value: "Healthcare" },
      { label: "Real Estate", value: "Real Estate" },
      { label: "SaaS", value: "SaaS" },
      { label: "Hospitality", value: "Hospitality" },
      { label: "Something else", value: "Something else" },
    ],
  },
  {
    field: "name",
    kind: "text",
    prompt: "Love it — we have templates for that. What's your name?",
  },
  {
    field: "email",
    kind: "email",
    prompt: "Thanks, {name}! What's the best work email for the team to reach you?",
  },
  {
    field: "phone",
    kind: "phone",
    optional: true,
    prompt: "Got it. A phone number too, in case we need it? (optional — feel free to skip)",
  },
  {
    field: "company",
    kind: "text",
    optional: true,
    prompt: "Which company are you with?",
  },
  {
    field: "preference",
    kind: "chips",
    prompt:
      "Last one: would you rather build it yourself, or have our team build it for you?",
    chips: [
      { label: "I'll build it (self-serve)", value: "self_serve" },
      { label: "Build it for me (done-for-you)", value: "done_for_you" },
    ],
  },
];

/** Shown once Rae has at least a name + email. */
export const raeConfirm =
  "Perfect — you're all set, {name} 🙌 Our team will reach out within one business day. Anything else I can point you to in the meantime?";

/**
 * Canned app-knowledge FAQ. Rae checks these on every free-typed turn; on a hit
 * she answers, then re-asks the current step so the flow keeps moving.
 */
export const raeFaq: FaqEntry[] = [
  {
    match: ["price", "pricing", "cost", "how much", "plan", "$"],
    answer:
      "Self-serve plans start at $199/mo and you can build agents yourself. Prefer it done for you? Our team can build and run it — happy to have them quote that on a call.",
  },
  {
    match: ["industry", "industries", "vertical", "use case", "templates", "template"],
    answer:
      "We have 60 templates across 15 industries — e-commerce, healthcare, real estate, legal, financial services, SaaS, hospitality and more. There's almost certainly a starting point for you.",
  },
  {
    match: ["data", "residency", "where", "hosted", "host", "india", "us ", "region", "gdpr", "hipaa", "compliance"],
    answer:
      "Agents run on managed backend infrastructure and your data can live in the US or India. Each template ships with industry-specific compliance guardrails baked in.",
  },
  {
    match: ["own key", "byok", "api key", "anthropic", "openai", "credits", "bring your own"],
    answer:
      "On paid plans you can bring your own model key or buy credits from us — so you stay in control of model usage and cost. Agents run on Claude + GPT-4o with automatic failover.",
  },
  {
    match: ["how does", "how it works", "how do you", "what is rach", "what do you do", "what's rach"],
    answer:
      "Rach.Dev builds production-ready AI agents and runs them on managed backend infrastructure — your own database, auth and storage. You can self-serve or have us build it for you.",
  },
  {
    match: ["done for you", "build it for me", "managed", "do it for me", "agency"],
    answer:
      "Yes! With done-for-you, our team builds, tunes and runs the agent for you end to end. Pick 'Build it for me' below and we'll take it from there.",
  },
];

/**
 * Light per-industry awareness. When a visitor picks an industry, Rae can drop a
 * relevant line; deep compliance specifics are deflected to the team (guardrail).
 */
export const raeIndustryNotes: Record<string, string> = {
  "E-Commerce": "Nice — our e-commerce agents handle order status, returns and cart recovery out of the box.",
  Healthcare: "Great — our healthcare templates are HIPAA-aware, with appointment and intake flows.",
  "Real Estate": "Perfect — real-estate agents qualify leads and schedule showings around the clock.",
  SaaS: "Awesome — SaaS agents deflect tier-1 support and onboard new users automatically.",
  Hospitality: "Lovely — hospitality agents handle reservations and concierge requests across channels.",
  "Something else": "No problem — we cover 15 industries, so there's very likely a fit.",
};

/** Deflection for anything Rae shouldn't answer authoritatively (a guardrail). */
export const raeDeflect =
  "That's a great one for the team — I'll make a note so they can give you a precise answer. Meanwhile, let's get your details so they can follow up.";
