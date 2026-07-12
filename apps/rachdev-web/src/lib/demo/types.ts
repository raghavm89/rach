import type { DecisionStep } from "@/data/mock/agents";

/**
 * Shared types for the SCRIPTED demo experience (Track A).
 *
 * Nothing here ever calls a real LLM — every response is pre-authored. This is
 * deliberate: the public demo costs nothing to run and exposes no API key. The
 * live-LLM machinery lives in the post-signup product (Track B).
 */

export type DemoRole = "user" | "agent";

/** The capability a scripted response is meant to demonstrate to a prospect. */
export type Capability =
  | "knowledge"
  | "guardrail-decline"
  | "escalation"
  | "owner-customization"
  | "greeting"
  | "fallback";

export interface DemoMessage {
  id: string;
  role: DemoRole;
  content: string;
  timestamp: string;
}

/** A clickable suggested prompt ("chip") shown above the input. */
export interface SuggestedPrompt {
  id: string;
  /** Short label rendered on the chip. */
  label: string;
  /** Text inserted as the user's message when the chip is clicked. */
  userText: string;
}

/** One pre-authored support-agent reply. */
export interface ScriptedResponse {
  id: string;
  capability: Capability;
  /** Lowercase keywords used to match free-typed input to this response. */
  match: string[];
  /** The user-visible reply (supports \n line breaks). */
  reply: string;
  /**
   * Optional extra text appended only when the "Make it yours" owner rule is
   * toggled on — used to demonstrate owner customization visibly.
   */
  ownerRuleAddon?: string;
  /** Optional decision-trace rendered in the dashboard sandbox panel. */
  trace?: DecisionStep[];
}

/** The full scripted support demo for one business (e.g. Aria @ NovaKicks). */
export interface SupportDemo {
  agentName: string;
  businessName: string;
  oneLiner: string;
  greeting: string;
  suggestedPrompts: SuggestedPrompt[];
  responses: ScriptedResponse[];
  /** Graceful reply when nothing matches — turns unknowns into a soft handoff. */
  fallback: ScriptedResponse;
  /** Label + description for the demonstrable owner rule on the /demo page. */
  ownerRule: { label: string; description: string };
}

/* ------------------------------------------------------------------ */
/* Rae concierge (scripted lead capture)                               */
/* ------------------------------------------------------------------ */

export type LeadPreference = "self_serve" | "done_for_you";

/** What Rae collects — mirrors the /api/leads payload (minus server fields). */
export interface Lead {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  goal?: string;
  industry?: string;
  preference?: LeadPreference;
}

export type RaeStepKind = "text" | "email" | "phone" | "chips" | "text-or-chips";

export interface RaeChip {
  label: string;
  value: string;
}

/** One step of Rae's guided, contact-form-style conversation. */
export interface RaeStep {
  /** Which Lead field this step captures (omit for pure prompts). */
  field?: keyof Lead;
  kind: RaeStepKind;
  /** Prompt text; may contain {name}/{company} tokens filled from the lead. */
  prompt: string;
  optional?: boolean;
  chips?: RaeChip[];
}

/** A canned app-knowledge FAQ entry Rae can answer mid-flow. */
export interface FaqEntry {
  match: string[];
  answer: string;
}
