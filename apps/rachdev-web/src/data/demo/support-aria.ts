import type { SupportDemo } from "@/lib/demo/types";

/**
 * Scripted content for the demo support agent — "Aria @ NovaKicks".
 *
 * This is EDITABLE COPY, not code: tweak the chips, replies, and traces freely.
 * Each response is tagged with the capability it demonstrates so a prospect can
 * see the product's behaviors (knowledge, guardrails, escalation, owner rules)
 * without any live model being called.
 */
export const ariaDemo: SupportDemo = {
  agentName: "Aria",
  businessName: "NovaKicks",
  oneLiner: "an online sneaker store",
  greeting:
    "Hi! I'm Aria, NovaKicks' support agent. I can help with orders, returns, shipping, sizing, and products. Try one of the prompts below 👇",

  ownerRule: {
    label: "Always offer 10% off on returns",
    description:
      'An example "Make it yours" rule. Toggle it on, then ask about a return — watch Aria apply it automatically.',
  },

  suggestedPrompts: [
    { id: "p_order", label: "Track my order", userText: "Where's my order #NK-4821?" },
    { id: "p_return", label: "Start a return", userText: "I want to return these sneakers" },
    { id: "p_damaged", label: "Item arrived damaged", userText: "My sneakers arrived damaged" },
    { id: "p_sizing", label: "Sizing help", userText: "Do the Air Glide Runners run true to size?" },
    { id: "p_offtopic", label: "Ask something off-topic", userText: "What's the weather today?" },
  ],

  responses: [
    {
      id: "order",
      capability: "knowledge",
      match: ["track", "order", "#nk-4821", "nk-4821", "4821", "where is my", "wheres my", "delivery"],
      reply:
        "I found order #NK-4821 — Air Glide Runners, size 9. It shipped via BlueDart and is out for delivery today, arriving by 8 PM. Want me to text you the live tracking link?",
      trace: [
        { id: "order_1", type: "trigger", label: "Message received", detail: "User asked about order #NK-4821", durationMs: 4 },
        { id: "order_2", type: "action", label: "Order lookup", detail: "Queried orders for #NK-4821 → status: out for delivery", durationMs: 142 },
        { id: "order_3", type: "knowledge", label: "Shipping policy", detail: "Matched 2 chunks on delivery windows", tokenCount: 640, durationMs: 88 },
        { id: "order_4", type: "llm", label: "LLM call (Claude)", detail: "Composed order-status reply", tokenCount: 410, cost: 0.0021, durationMs: 720 },
        { id: "order_5", type: "response", label: "Response sent", detail: "Returned status + offered tracking link", durationMs: 6 },
      ],
    },
    {
      id: "return",
      capability: "knowledge",
      match: ["return", "refund", "send back", "exchange"],
      reply:
        "Happy to help with a return! NovaKicks accepts returns within 30 days of delivery, and refunds land 3–5 business days after we receive the items. I can generate a prepaid label now — would you like it emailed, or as a QR code for any drop-off point?",
      ownerRuleAddon:
        "And because you're returning — here's 10% off your next order: WELCOME10 🎉",
      trace: [
        { id: "return_1", type: "trigger", label: "Message received", detail: "User wants to start a return", durationMs: 4 },
        { id: "return_2", type: "knowledge", label: "Return policy", detail: "Matched 3 chunks: 30-day window, refund timing", tokenCount: 980, durationMs: 96 },
        { id: "return_3", type: "llm", label: "LLM call (Claude)", detail: "Explained policy + offered prepaid label", tokenCount: 520, cost: 0.0026, durationMs: 760 },
        { id: "return_4", type: "response", label: "Response sent", detail: "Return options presented", durationMs: 6 },
      ],
    },
    {
      id: "damaged",
      capability: "escalation",
      match: ["damaged", "broken", "defective", "wrong item", "torn", "ripped"],
      reply:
        "Oh no — I'm really sorry your sneakers arrived damaged. That's not the NovaKicks experience we want for you. I'm connecting you with Priya from our team, who'll sort a replacement or full refund right away. She'll pick up this conversation with all the details so you won't have to repeat anything.",
      trace: [
        { id: "damaged_1", type: "trigger", label: "Message received", detail: "User reports a damaged item", durationMs: 4 },
        { id: "damaged_2", type: "knowledge", label: "Guardrail check", detail: "Damaged-item report → escalation required", durationMs: 22 },
        { id: "damaged_3", type: "action", label: "Escalation triggered", detail: "Handed off to human (Priya) with full context", durationMs: 60 },
        { id: "damaged_4", type: "response", label: "Response sent", detail: "Empathized + confirmed human handoff", durationMs: 6 },
      ],
    },
    {
      id: "sizing",
      capability: "knowledge",
      match: ["size", "sizing", "true to size", "fit", "run small", "run large", "air glide"],
      reply:
        "Great question! The Air Glide Runners run true to size for most people. If you're between sizes or have wide feet, customers usually size up by half. Want me to pull our fit guide for your usual size?",
      trace: [
        { id: "sizing_1", type: "trigger", label: "Message received", detail: "User asked about sizing", durationMs: 4 },
        { id: "sizing_2", type: "knowledge", label: "Product knowledge", detail: "Matched fit-guide chunks for Air Glide Runners", tokenCount: 720, durationMs: 84 },
        { id: "sizing_3", type: "llm", label: "LLM call (Claude)", detail: "Summarized fit guidance", tokenCount: 360, cost: 0.0018, durationMs: 690 },
        { id: "sizing_4", type: "response", label: "Response sent", detail: "Returned sizing guidance", durationMs: 6 },
      ],
    },
    {
      id: "offtopic",
      capability: "guardrail-decline",
      match: ["weather", "joke", "news", "stock price", "who won", "politics", "recipe"],
      reply:
        "I'd love to help, but I'm focused on NovaKicks orders, returns, shipping, sizing, and products — so I can't help with that one. Is there anything about your order or our sneakers I can sort out for you?",
      trace: [
        { id: "offtopic_1", type: "trigger", label: "Message received", detail: "Off-topic request detected", durationMs: 4 },
        { id: "offtopic_2", type: "action", label: "Guardrail enforced", detail: "Out-of-scope → politely declined, stayed on topic", durationMs: 18 },
        { id: "offtopic_3", type: "response", label: "Response sent", detail: "Declined + redirected to supported topics", durationMs: 6 },
      ],
    },
  ],

  fallback: {
    id: "fallback",
    capability: "fallback",
    match: [],
    reply:
      "Good question! In the live version I'd answer that straight from NovaKicks' knowledge base. For this demo I'll make a note and our team can follow up — in the meantime, try one of the suggested prompts to see how I handle real requests.",
    trace: [
      { id: "fallback_1", type: "trigger", label: "Message received", detail: "No scripted match for this demo", durationMs: 4 },
      { id: "fallback_2", type: "action", label: "Graceful fallback", detail: "Acknowledged + offered handoff (no guess)", durationMs: 12 },
      { id: "fallback_3", type: "response", label: "Response sent", detail: "Soft handoff message", durationMs: 6 },
    ],
  },
};
