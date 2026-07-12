"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send } from "lucide-react";
import { cn } from '@rach/ui/lib/utils';
import type { DecisionStep } from "@/data/mock/agents";
import type { DemoMessage, SupportDemo } from "@/lib/demo/types";
import { getSupportReply } from "@/lib/demo/engine";
import { streamWords, estimateTypingMs } from "@/lib/demo/stream";

interface DemoChatProps {
  demo: SupportDemo;
  /** When true, the demo's owner-rule addon is appended (demonstrates "Make it yours"). */
  ownerRuleActive?: boolean;
  /** Surfaces the decision trace of the latest reply (used by the dashboard sandbox). */
  onTrace?: (steps: DecisionStep[] | undefined) => void;
  className?: string;
}

function nowLabel(): string {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function DemoChat({ demo, ownerRuleActive = false, onTrace, className }: DemoChatProps) {
  const idRef = useRef(0);
  const nextId = () => `m_${idRef.current++}`;
  const cancelRef = useRef<(() => void) | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<DemoMessage[]>(() => [
    { id: "m_greeting", role: "agent", content: demo.greeting, timestamp: nowLabel() },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => () => cancelRef.current?.(), []);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "user", content: trimmed, timestamp: nowLabel() },
    ]);
    setInput("");
    setIsTyping(true);

    const { response, reply } = getSupportReply(demo, trimmed, { ownerRuleActive });
    onTrace?.(response.trace);

    // Brief "thinking" pause, then stream the canned reply in word by word.
    window.setTimeout(() => {
      const msgId = nextId();
      setMessages((prev) => [
        ...prev,
        { id: msgId, role: "agent", content: "", timestamp: nowLabel() },
      ]);
      cancelRef.current = streamWords(reply, (partial) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, content: partial } : m))
        );
      });
      window.setTimeout(() => setIsTyping(false), estimateTypingMs(reply));
    }, 450);
  };

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-neutral-border bg-white shadow-xl",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-neutral-border bg-bg-secondary px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-primary-blue to-primary-purple">
          <Bot size={16} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-text-primary">
            {demo.agentName} · {demo.businessName}
          </p>
          <p className="text-[10px] text-green-500">Online · scripted demo</p>
        </div>
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

      {/* Suggested prompts */}
      <div className="flex flex-wrap gap-2 border-t border-neutral-border px-4 pt-3">
        {demo.suggestedPrompts.map((p) => (
          <button
            key={p.id}
            onClick={() => send(p.userText)}
            disabled={isTyping}
            className="rounded-full border border-neutral-border bg-white px-3 py-1 text-xs text-text-secondary transition-colors hover:border-primary-blue hover:text-primary-blue disabled:cursor-not-allowed disabled:opacity-50"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="p-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="Type a message…"
            className="flex-1 rounded-lg border border-neutral-border bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue/30"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || isTyping}
            className={cn(
              "rounded-lg p-2 transition-colors",
              input.trim() && !isTyping
                ? "bg-primary-blue text-white hover:bg-primary-blue/90"
                : "cursor-not-allowed bg-bg-secondary text-text-muted"
            )}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
