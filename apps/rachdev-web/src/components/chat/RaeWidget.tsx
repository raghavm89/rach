"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, MessageCircle, Send, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@rach/ui/lib/utils";
import type { DemoMessage, Lead, LeadPreference } from "@/lib/demo/types";
import { isLikelyPhone, isValidEmail, matchFaq } from "@/lib/demo/engine";
import { useRaeStore } from "@/lib/demo/rae-store";
import {
  raeConfirm,
  raeDeflect,
  raeFaq,
  raeGreeting,
  raeIndustryNotes,
  raeSteps,
} from "@/data/demo/rae-flow";

function nowLabel(): string {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

const SKIP_RE = /^(skip|no|none|nope|later|n\/a)\b/i;
const QUESTION_RE = /\?|^(how|what|why|do|does|can|is|are|who|where|when|tell me|which)\b/i;

export function RaeWidget() {
  const { isOpen, open, close } = useRaeStore();

  const idRef = useRef(0);
  const nextId = () => `r_${idRef.current++}`;
  const startedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<number | null>(null);

  const [messages, setMessages] = useState<DemoMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [lead, setLead] = useState<Lead>({});
  const [done, setDone] = useState(false);

  const step = stepIndex < raeSteps.length ? raeSteps[stepIndex] : undefined;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => () => { if (typingTimer.current) window.clearTimeout(typingTimer.current); }, []);

  function fill(text: string, l: Lead): string {
    return text.replace(/\{name\}/g, l.name ?? "there").replace(/\{company\}/g, l.company ?? "");
  }

  /** Push an agent message after a short "typing" pause. */
  function agentSay(text: string, after: () => void = () => {}) {
    setIsTyping(true);
    typingTimer.current = window.setTimeout(() => {
      setMessages((prev) => [...prev, { id: nextId(), role: "agent", content: text, timestamp: nowLabel() }]);
      setIsTyping(false);
      after();
    }, 600);
  }

  function pushUser(text: string) {
    setMessages((prev) => [...prev, { id: nextId(), role: "user", content: text, timestamp: nowLabel() }]);
  }

  // Lazy-start the conversation the first time the panel opens.
  useEffect(() => {
    if (isOpen && !startedRef.current) {
      startedRef.current = true;
      agentSay(`${raeGreeting} ${fill(raeSteps[0].prompt, {})}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  async function submitLead(finalLead: Lead) {
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...finalLead, source: "rae" }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Thanks! Our team will reach out within one business day.");
    } catch {
      toast.error("We couldn't save that just now — please try the contact page.");
    }
  }

  /** Store a field value and move to the next step (or finalize). */
  function advance(update: Partial<Lead>, preface?: string) {
    const updated = { ...lead, ...update };
    setLead(updated);
    const next = stepIndex + 1;
    setStepIndex(next);

    if (next < raeSteps.length) {
      const prompt = fill(raeSteps[next].prompt, updated);
      agentSay(preface ? `${preface}\n\n${prompt}` : prompt);
    } else {
      setDone(true);
      agentSay(preface ? `${preface}\n\n${fill(raeConfirm, updated)}` : fill(raeConfirm, updated));
      void submitLead(updated);
    }
  }

  /** Core turn handler for typed input. */
  function handleText(raw: string) {
    const text = raw.trim();
    if (!text || isTyping) return;
    pushUser(text);
    setInput("");

    // After the flow is done, just answer FAQs / deflect.
    if (done || !step) {
      const faq = matchFaq(text, raeFaq);
      agentSay(faq ? faq.answer : raeDeflect);
      return;
    }

    const faq = matchFaq(text, raeFaq);
    const looksLikeQuestion = QUESTION_RE.test(text);

    switch (step.kind) {
      case "email": {
        if (isValidEmail(text)) return advance({ email: text });
        if (faq) return agentSay(`${faq.answer}\n\n${fill(step.prompt, lead)}`);
        return agentSay(`Hmm, that doesn't look like an email — mind trying again? ${fill(step.prompt, lead)}`);
      }
      case "phone": {
        if (SKIP_RE.test(text)) return advance({}, "No problem.");
        if (isLikelyPhone(text)) return advance({ phone: text });
        if (faq) return agentSay(`${faq.answer}\n\n${fill(step.prompt, lead)}`);
        return agentSay(`That doesn't look like a phone number — you can also just say "skip".`);
      }
      case "chips": {
        // preference step typed instead of clicked
        if (/\b(self|myself|diy|build it)\b/i.test(text)) return advance({ preference: "self_serve" });
        if (/\b(you|team|for me|done)\b/i.test(text)) return advance({ preference: "done_for_you" });
        if (faq) return agentSay(`${faq.answer}\n\n${fill(step.prompt, lead)}`);
        return agentSay(fill(step.prompt, lead));
      }
      default: {
        // text / text-or-chips (name, company, goal)
        if (looksLikeQuestion && faq) {
          return agentSay(`${faq.answer}\n\n${fill(step.prompt, lead)}`);
        }
        if (step.field === "goal") {
          const note = raeIndustryNotes[text];
          return advance({ goal: text }, note);
        }
        return advance({ [step.field as keyof Lead]: text } as Partial<Lead>);
      }
    }
  }

  /** Chip click — provides the value directly. */
  function handleChip(value: string, label: string) {
    if (isTyping || done || !step) return;
    pushUser(label);
    if (step.field === "goal") {
      return advance({ goal: value, industry: value }, raeIndustryNotes[value]);
    }
    if (step.field === "preference") {
      return advance({ preference: value as LeadPreference });
    }
    return advance({ [step.field as keyof Lead]: value } as Partial<Lead>);
  }

  return (
    <>
      {/* Launcher */}
      {!isOpen && (
        <button
          type="button"
          onClick={open}
          aria-label="Open chat with Rae"
          className="fixed bottom-6 right-6 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-primary-blue to-primary-purple text-white shadow-xl transition-transform hover:scale-105"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-[60] flex h-[560px] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-neutral-border bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-border bg-bg-secondary px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-primary-blue to-primary-purple">
                <Bot size={16} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">Rae · Rach.Dev</p>
                <p className="text-[10px] text-green-500">Online · usually replies instantly</p>
              </div>
            </div>
            <button type="button" onClick={close} aria-label="Close chat" className="text-text-muted hover:text-text-primary">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "rounded-tr-sm bg-primary-blue text-white"
                      : "rounded-tl-sm bg-bg-secondary text-text-secondary"
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-1 px-3 py-2">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-muted" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-muted [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-muted [animation-delay:300ms]" />
              </div>
            )}
          </div>

          {/* Chips for the current step */}
          {!done && !isTyping && step?.chips && (
            <div className="flex flex-wrap gap-2 border-t border-neutral-border px-4 pt-3">
              {step.chips.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => handleChip(c.value, c.label)}
                  className="rounded-full border border-neutral-border bg-white px-3 py-1 text-xs text-text-secondary transition-colors hover:border-primary-blue hover:text-primary-blue"
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleText(input)}
                placeholder={step?.optional ? "Type a reply or “skip”…" : "Type a reply…"}
                className="flex-1 rounded-lg border border-neutral-border bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue/30"
              />
              <button
                type="button"
                aria-label="Send message"
                onClick={() => handleText(input)}
                disabled={!input.trim() || isTyping}
                className={cn(
                  "rounded-lg p-2 transition-colors",
                  input.trim() && !isTyping
                    ? "bg-primary-blue text-white hover:bg-primary-blue/90"
                    : "cursor-not-allowed bg-bg-secondary text-text-muted"
                )}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
