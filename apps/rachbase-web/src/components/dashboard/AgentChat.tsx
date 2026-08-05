"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bot, Plus, Send, Loader2, Coins, X, ChevronLeft,
  AlertCircle, CreditCard, ExternalLink, TrendingUp, Receipt, Activity,
} from "lucide-react";
import { agent, ChatSession, ChatMessage, CreditPack } from "@rach/ui/lib/api";
import { cn } from "@rach/ui/lib/utils";
import { useRouter } from "next/navigation";

interface AgentChatProps {
  token: string;
  onClose: () => void;
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export function AgentChat({ token, onClose }: AgentChatProps) {
  const [sessions, setSessions]       = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages]       = useState<ChatMessage[]>([]);
  const [balance, setBalance]         = useState<number>(0);
  const [packs, setPacks]             = useState<CreditPack[]>([]);
  const [input, setInput]             = useState("");
  const [sending, setSending]         = useState(false);
  const [streaming, setStreaming]     = useState("");
  const [view, setView]               = useState<"sessions" | "chat" | "topup" | "usage">("sessions");
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const router = useRouter();
  const [usageSummary, setUsageSummary]   = useState<{ balance: number; total_purchased: number; total_used: number; total_tokens: number } | null>(null);
  const [creditHistory, setCreditHistory] = useState<{ id: number; type: string; amount: number; description: string; created_at: string; user_name?: string | null }[]>([]);
  const [sessionUsage, setSessionUsage]   = useState<{ id: number; title: string; message_count: number; total_tokens: number; total_credits: number; updated_at: string }[]>([]);
  const [usageLoading, setUsageLoading]   = useState(false);
  const messagesEndRef                = useRef<HTMLDivElement>(null);

  // ── Load initial data ──────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [sessData, credData] = await Promise.all([
        agent.listSessions(token),
        agent.getCredits(token),
      ]);
      setSessions(sessData.sessions);
      setBalance(credData.balance);
      setPacks(credData.packs);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (view !== "usage" || !token) return;
    setUsageLoading(true);
    Promise.all([
      agent.getUsageSummary(token),
      agent.getCreditHistory(token),
      agent.getSessionUsage(token),
    ]).then(([summary, history, sessions]) => {
      setUsageSummary(summary);
      setCreditHistory(history.transactions);
      setSessionUsage(sessions.sessions);
    }).catch(() => {}).finally(() => setUsageLoading(false));
  }, [view, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  // ── Session actions ────────────────────────────────────────────────────────

  const openSession = async (session: ChatSession) => {
    setActiveSession(session);
    setView("chat");
    setMessages([]);
    try {
      const data = await agent.getMessages(token, session.id);
      setMessages(data.messages);
    } catch {}
  };

  const newSession = async () => {
    try {
      const data = await agent.createSession(token);
      setSessions((p) => [data.session, ...p]);
      setActiveSession(data.session);
      setMessages([]);
      setView("chat");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // ── Send message ───────────────────────────────────────────────────────────

  const sendMessage = async () => {
    if (!input.trim() || !activeSession || sending || balance <= 0) return;

    const userMsg = input.trim();
    setInput("");
    setSending(true);
    setStreaming("");

    // Optimistic user message
    const optimistic: ChatMessage = {
      id: Date.now(), role: "user", content: userMsg,
      tokens_used: 0, credits_used: 0, created_at: new Date().toISOString(),
    };
    setMessages((p) => [...p, optimistic]);

    try {
      const res = await fetch(`${BASE_URL}/api/agent/sessions/${activeSession.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: userMsg }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send");
      }

      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      let   buffer  = "";
      let   full    = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === "text") {
              full += evt.text;
              setStreaming(full);
            }
            if (evt.type === "done") {
              setBalance(evt.balance);
              setStreaming("");
              setMessages((p) => [...p, {
                id: Date.now() + 1, role: "assistant", content: full,
                tokens_used: evt.tokens, credits_used: evt.credits_used,
                created_at: new Date().toISOString(),
              }]);
              // Update session title
              setSessions((prev) => prev.map((s) =>
                s.id === activeSession.id
                  ? { ...s, title: userMsg.slice(0, 50), updated_at: new Date().toISOString() }
                  : s
              ));
            }
          } catch {}
        }
      }
    } catch (err) {
      setError((err as Error).message);
      setMessages((p) => p.filter((m) => m.id !== optimistic.id));
    } finally {
      setSending(false);
      setStreaming("");
    }
  };

  // ── Top-up ─────────────────────────────────────────────────────────────────

  const buyPack = (pack: CreditPack) => {
    router.push(`/dashboard/billing?tab=credits&pack=${pack.id}`);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-surface-card border-l border-black/10">

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-black/8 shrink-0">
        {view === "chat" && (
          <button onClick={() => setView("sessions")}
            className="rounded p-1 hover:bg-black/5 transition-colors">
            <ChevronLeft size={15} className="text-black/50" />
          </button>
        )}
        <Bot size={15} className="text-primary-blue shrink-0" />
        <span className="text-sm font-semibold text-black flex-1 truncate">
          {view === "chat"  && activeSession ? activeSession.title :
           view === "usage" ? "Usage" :
           view === "topup" ? "Add Credits" : "Deploy Agent"}
        </span>

        {/* Usage button */}
        <button
          onClick={() => setView(view === "usage" ? "sessions" : "usage")}
          className="rounded p-1 hover:bg-black/5 transition-colors"
          title="Usage"
        >
          <TrendingUp size={14} className={view === "usage" ? "text-primary-blue" : "text-black/40"} />
        </button>

        {/* Credit balance */}
        <button
          onClick={() => setView(view === "topup" ? "sessions" : "topup")}
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors",
            balance > 0
              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              : "bg-red-50 text-red-600 hover:bg-red-100"
          )}
        >
          <Coins size={10} />
          {balance} credits
        </button>

        <button onClick={onClose}
          className="rounded p-1 hover:bg-black/5 transition-colors">
          <X size={14} className="text-black/40" />
        </button>
      </div>

      {error && (
        <div className="mx-3 mt-2 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
          <AlertCircle size={12} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError("")}><X size={11} /></button>
        </div>
      )}

      {/* ── Sessions list ── */}
      {view === "sessions" && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-3">
            <button
              onClick={newSession}
              className="flex items-center gap-2 w-full rounded-lg border border-dashed border-black/20 px-3 py-2.5 text-xs font-semibold text-black/50 hover:border-black/40 hover:text-black hover:bg-black/3 transition-colors"
            >
              <Plus size={13} /> New chat
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={16} className="animate-spin text-black/30" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-10 px-4">
              <Bot size={24} className="mx-auto text-black/20 mb-2" />
              <p className="text-xs text-black/40">No chats yet. Start a new one!</p>
            </div>
          ) : (
            <div className="px-2 pb-3 space-y-0.5">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => openSession(s)}
                  className="flex items-start gap-2 w-full rounded-lg px-3 py-2.5 text-left hover:bg-black/5 transition-colors"
                >
                  <Bot size={13} className="text-black/30 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-black truncate">{s.title}</p>
                    <p className="text-[10px] text-black/40">
                      {s.message_count} messages · {new Date(s.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Chat view ── */}
      {view === "chat" && (
        <>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.length === 0 && !streaming && (
              <div className="text-center py-8 px-3">
                <Bot size={24} className="mx-auto text-black/20 mb-2" />
                <p className="text-xs text-black/40 leading-relaxed">
                  Ask me anything about your deployments — I can debug issues, trigger deploys, or run diagnostic commands.
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex gap-2", msg.role === "user" && "flex-row-reverse")}>
                <div className={cn(
                  "max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap",
                  msg.role === "user"
                    ? "bg-ink-solid text-white rounded-tr-sm"
                    : "bg-surface-hover text-black rounded-tl-sm"
                )}>
                  {msg.content}
                  {msg.credits_used > 0 && (
                    <p className="mt-1 text-[10px] opacity-50">
                      {msg.credits_used} credit{msg.credits_used !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* Streaming */}
            {streaming && (
              <div className="flex gap-2">
                <div className="max-w-[85%] rounded-xl rounded-tl-sm px-3 py-2 bg-surface-hover text-xs text-black leading-relaxed whitespace-pre-wrap">
                  {streaming}
                  <span className="inline-block w-1.5 h-3 bg-black/40 ml-0.5 animate-pulse rounded-sm" />
                </div>
              </div>
            )}

            {sending && !streaming && (
              <div className="flex gap-2">
                <div className="rounded-xl rounded-tl-sm px-3 py-2 bg-surface-hover">
                  <Loader2 size={13} className="animate-spin text-black/40" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-black/8 px-3 py-3">
            {balance <= 0 && (
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                <AlertCircle size={11} className="shrink-0" />
                No credits left.
                <button onClick={() => setView("topup")} className="underline font-semibold">Top up</button>
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder={balance <= 0 ? "Add credits to chat…" : "Ask about your deployment…"}
                disabled={balance <= 0 || sending}
                rows={2}
                className="flex-1 resize-none rounded-lg border border-black/12 px-3 py-2 text-xs text-black placeholder:text-black/30 focus:outline-none focus:border-black/30 transition-colors disabled:opacity-50 bg-surface-hover"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || sending || balance <= 0}
                className="self-end flex items-center justify-center w-8 h-8 rounded-lg bg-ink-solid text-white hover:bg-neutral-800 disabled:opacity-40 transition-colors"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Top-up view ── */}
      {view === "topup" && (
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
          <div className="text-center mb-4">
            <Coins size={24} className="mx-auto text-primary-blue mb-2" />
            <p className="text-sm font-semibold text-black">Add Credits</p>
            <p className="text-xs text-black/40 mt-0.5">
              Current balance: <span className="font-semibold text-black">{balance} credits</span>
            </p>
          </div>

          {packs.map((pack) => (
            <button
              key={pack.id}
              onClick={() => buyPack(pack)}
              className="flex items-center justify-between w-full rounded-xl border border-black/10 bg-surface-card hover:border-primary-blue/40 hover:bg-primary-blue/3 px-4 py-3 transition-all text-left"
            >
              <div>
                <p className="text-sm font-semibold text-black">{pack.label}</p>
                <p className="text-xs text-black/50">{pack.credits.toLocaleString()} credits</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-black">${pack.price_usd}</span>
                <ExternalLink size={13} className="text-black/30" />
              </div>
            </button>
          ))}

          <p className="text-[10px] text-black/30 text-center pt-2">
            1,000 tokens = 1 credit · Credits never expire
          </p>
        </div>
      )}

      {/* ── Usage view ── */}
      {view === "usage" && (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {usageLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={18} className="animate-spin text-black/30" />
            </div>
          ) : (
            <>
              {usageSummary && (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Balance",   value: `${usageSummary.balance} cr`,           icon: <Coins size={12} />,    color: "text-primary-blue" },
                    { label: "Purchased", value: `${usageSummary.total_purchased} cr`,   icon: <CreditCard size={12} />, color: "text-emerald-600" },
                    { label: "Used",      value: `${usageSummary.total_used} cr`,        icon: <Activity size={12} />,  color: "text-black/60" },
                    { label: "Tokens",    value: usageSummary.total_tokens.toLocaleString(), icon: <Bot size={12} />,   color: "text-black/60" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg border border-black/8 bg-surface-hover p-3">
                      <div className={cn("flex items-center gap-1 text-[10px] font-semibold mb-1", s.color)}>
                        {s.icon}{s.label}
                      </div>
                      <p className="text-sm font-bold text-black font-mono">{s.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {sessionUsage.length > 0 && (
                <div className="rounded-lg border border-black/8 overflow-hidden">
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-surface-hover border-b border-black/8">
                    <Bot size={12} className="text-black/40" />
                    <span className="text-[11px] font-semibold text-black/60 uppercase tracking-wide">Sessions</span>
                  </div>
                  <div className="divide-y divide-black/5">
                    {sessionUsage.slice(0, 10).map((s) => (
                      <div key={s.id} className="flex items-center gap-2 px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-black truncate">{s.title}</p>
                          <p className="text-[10px] text-black/40">{s.message_count} msgs · {s.total_tokens.toLocaleString()} tokens</p>
                        </div>
                        <span className="text-[10px] font-semibold text-primary-blue shrink-0">{s.total_credits} cr</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {creditHistory.length > 0 && (
                <div className="rounded-lg border border-black/8 overflow-hidden">
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-surface-hover border-b border-black/8">
                    <Receipt size={12} className="text-black/40" />
                    <span className="text-[11px] font-semibold text-black/60 uppercase tracking-wide">History</span>
                  </div>
                  <div className="divide-y divide-black/5">
                    {creditHistory.slice(0, 15).map((tx) => (
                      <div key={tx.id} className="flex items-center gap-2 px-3 py-2">
                        <span className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold capitalize shrink-0",
                          tx.type === "purchase" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                        )}>{tx.type}</span>
                        <p className="text-[10px] text-black/50 flex-1 truncate">{tx.description}</p>
                        <span className={cn("text-xs font-mono font-semibold shrink-0",
                          tx.amount > 0 ? "text-emerald-600" : "text-black/60"
                        )}>{tx.amount > 0 ? "+" : ""}{tx.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!usageSummary && (
                <p className="text-center text-black/30 text-xs py-8">No usage data yet.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
