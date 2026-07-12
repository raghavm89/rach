import { cn } from '../../lib/utils';
import { Bot } from "lucide-react";

const messages = [
  { role: "user" as const, text: "I need help tracking my order #4821" },
  {
    role: "agent" as const,
    text: "I found your order. It shipped yesterday and is expected to arrive by Friday.",
  },
  { role: "user" as const, text: "Can I change the delivery address?" },
];

export function ChatMockup({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "w-[280px] overflow-hidden rounded-xl border border-neutral-border bg-white shadow-xl",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-neutral-border bg-bg-secondary px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-r from-primary-blue to-primary-purple">
          <Bot size={14} className="text-white" />
        </div>
        <div>
          <p className="text-xs font-semibold text-text-primary">Rach Agent</p>
          <p className="text-[10px] text-green-500">Online</p>
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-3 p-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed",
              msg.role === "user"
                ? "ml-auto bg-primary-blue/10 text-text-primary"
                : "bg-bg-secondary text-text-secondary"
            )}
          >
            {msg.text}
          </div>
        ))}

        {/* Typing indicator */}
        <div className="flex gap-1 px-3 py-2">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-muted" />
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-muted [animation-delay:150ms]" />
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-muted [animation-delay:300ms]" />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-neutral-border px-4 py-3">
        <div className="rounded-lg bg-bg-secondary px-3 py-2 text-xs text-text-muted">
          Type a message...
        </div>
      </div>
    </div>
  );
}
