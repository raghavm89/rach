import type { FaqEntry, ScriptedResponse, SupportDemo } from "./types";

/**
 * Deterministic matching for the scripted demo. Pure functions, no I/O.
 *
 * Matching strategy: lowercase the input and look for any of a response's
 * keywords. Suggested-prompt chips pass their exact `userText`, which always
 * matches; free-typed input falls back to keyword search, then to a graceful
 * "I'll check with the team" reply that doubles as a soft lead-capture moment.
 */

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s#]/g, " ");
}

/** Find the first item whose `match` keywords appear in the text. */
export function findByKeywords<T extends { match: string[] }>(
  text: string,
  items: T[]
): T | undefined {
  const norm = normalize(text);
  return items.find((item) =>
    item.match.some((kw) => norm.includes(normalize(kw).trim()))
  );
}

/**
 * Resolve a scripted support reply for the given user text. Always returns a
 * response (the demo's fallback when nothing matches). When the owner rule is
 * active, its addon is appended to demonstrate "Make it yours" visibly.
 */
export function getSupportReply(
  demo: SupportDemo,
  userText: string,
  opts: { ownerRuleActive?: boolean } = {}
): { response: ScriptedResponse; reply: string } {
  const response = findByKeywords(userText, demo.responses) ?? demo.fallback;
  let reply = response.reply;
  if (opts.ownerRuleActive && response.ownerRuleAddon) {
    reply = `${reply}\n\n${response.ownerRuleAddon}`;
  }
  return { response, reply };
}

/** Match a free-typed question to a canned FAQ answer (Rae mid-flow). */
export function matchFaq(text: string, faq: FaqEntry[]): FaqEntry | undefined {
  return findByKeywords(text, faq);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+()\-.\s\d]{7,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function isLikelyPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return PHONE_RE.test(value.trim()) && digits.length >= 7 && digits.length <= 15;
}
