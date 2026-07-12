"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { toast } from "sonner";
import { ArrowRight, Check, Loader2, Mic, TriangleAlert } from "lucide-react";
import { SectionWrapper } from '@rach/ui/components/ui/SectionWrapper';
import { SectionHeader } from '@rach/ui/components/ui/SectionHeader';
import { cn } from '@rach/ui/lib/utils';
import { ICONS } from "@/lib/industries/icons";
import type { AgentDef, IndustryConfig } from "@/lib/industries/types";

type Voice = "idle" | "listening" | "done";
type NodeState = "idle" | "running" | "done";
type CardState = "idle" | "waiting" | "active" | "done";

interface State {
  busy: boolean;
  voice: Voice;
  fieldsShown: number;
  stripVisible: boolean;
  node: Record<string, NodeState>;
  conn: Record<string, boolean>;
  card: Record<string, CardState>;
  reveal: Record<string, number>;
}

type Action =
  | { type: "RESET"; keys: string[] }
  | { type: "START"; keys: string[]; trigger: string }
  | { type: "SHOW_FIELD"; count: number }
  | { type: "VOICE_DONE"; trigger: string; downstream: string[] }
  | { type: "AGENT_START"; key: string }
  | { type: "REVEAL"; key: string; count: number }
  | { type: "AGENT_DONE"; key: string }
  | { type: "FINISH" }
  | { type: "INSTANT"; state: State };

function blankMaps(keys: string[]) {
  const node: Record<string, NodeState> = {};
  const conn: Record<string, boolean> = {};
  const card: Record<string, CardState> = {};
  const reveal: Record<string, number> = {};
  keys.forEach((k) => {
    node[k] = "idle";
    conn[k] = false;
    card[k] = "idle";
    reveal[k] = 0;
  });
  return { node, conn, card, reveal };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "RESET":
      return { busy: false, voice: "idle", fieldsShown: 0, stripVisible: false, ...blankMaps(action.keys) };
    case "START":
      return {
        busy: true,
        voice: "listening",
        fieldsShown: 0,
        stripVisible: false,
        ...blankMaps(action.keys),
      };
    case "SHOW_FIELD":
      return { ...state, fieldsShown: action.count };
    case "VOICE_DONE": {
      const node = { ...state.node, [action.trigger]: "done" as NodeState };
      const card = { ...state.card };
      action.downstream.forEach((k) => (card[k] = "waiting"));
      return { ...state, voice: "done", stripVisible: true, node, card };
    }
    case "AGENT_START":
      return {
        ...state,
        conn: { ...state.conn, [action.key]: true },
        node: { ...state.node, [action.key]: "running" },
        card: { ...state.card, [action.key]: "active" },
        reveal: { ...state.reveal, [action.key]: 0 },
      };
    case "REVEAL":
      return { ...state, reveal: { ...state.reveal, [action.key]: action.count } };
    case "AGENT_DONE":
      return {
        ...state,
        node: { ...state.node, [action.key]: "done" },
        card: { ...state.card, [action.key]: "done" },
      };
    case "FINISH":
      return { ...state, busy: false };
    case "INSTANT":
      return action.state;
    default:
      return state;
  }
}

/** Flatten an agent's flow blocks into ordered reveal units (for staggered animation). */
function flowUnits(agent: AgentDef): ("step" | "other")[] {
  const units: ("step" | "other")[] = [];
  (agent.flow ?? []).forEach((b) => {
    if (b.fromLabel) units.push("other");
    if (b.chips && b.chips.length) units.push("other");
    (b.steps ?? []).forEach(() => units.push("step"));
    if (b.note) units.push("other");
  });
  return units;
}

export function AgentRoster({ config }: { config: IndustryConfig }) {
  const keys = config.agents.map((a) => a.key);
  const triggerKey = config.relayTriggerAgentKey;
  const triggerIdx = config.agents.findIndex((a) => a.key === triggerKey);
  const downstream = config.agents.filter((a) => a.key !== triggerKey).map((a) => a.key);

  const [state, dispatch] = useReducer(reducer, null, (): State => ({
    busy: false,
    voice: "idle",
    fieldsShown: 0,
    stripVisible: false,
    ...blankMaps(keys),
  }));

  const timers = useRef<number[]>([]);
  const busyRef = useRef(false);
  busyRef.current = state.busy;
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const reduceMotion = () =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => () => clearTimers(), []);

  const instantState = useCallback((): State => {
    const { node, conn, card, reveal } = blankMaps(keys);
    config.agents.forEach((a) => {
      node[a.key] = "done";
      conn[a.key] = true;
      card[a.key] = "done";
      reveal[a.key] = flowUnits(a).length;
    });
    const trigger = config.agents[triggerIdx];
    return {
      busy: false,
      voice: "done",
      fieldsShown: trigger.voice?.fields.length ?? 0,
      stripVisible: true,
      node,
      conn,
      card,
      reveal,
    };
  }, [config.agents, keys, triggerIdx]);

  const runRelay = useCallback(() => {
    if (busyRef.current) return;
    clearTimers();
    const trigger = config.agents[triggerIdx];
    const voice = trigger.voice;
    if (!voice) return;

    if (reduceMotion()) {
      dispatch({ type: "INSTANT", state: instantState() });
      toast.success(config.relayCompleteToast);
      return;
    }

    dispatch({ type: "START", keys, trigger: triggerKey });

    // Stream voice fields.
    let t = 350;
    voice.fields.forEach((_, idx) => {
      timers.current.push(window.setTimeout(() => dispatch({ type: "SHOW_FIELD", count: idx + 1 }), t));
      t += 680;
    });

    // Voice complete → reveal pipeline + dim others + handoff toast.
    const voiceDoneAt = t + 100;
    timers.current.push(
      window.setTimeout(() => {
        dispatch({ type: "VOICE_DONE", trigger: triggerKey, downstream });
        toast.success(voice.handoffToast);
      }, voiceDoneAt),
    );

    // Walk the downstream agents.
    const order = config.agents.filter((a) => a.key !== triggerKey);
    let cursor = voiceDoneAt + 800;
    order.forEach((agent, oi) => {
      const startAt = cursor;
      timers.current.push(
        window.setTimeout(() => {
          dispatch({ type: "AGENT_START", key: agent.key });
          // staggered unit reveal
          const units = flowUnits(agent);
          let d = 180;
          units.forEach((u, ui) => {
            timers.current.push(
              window.setTimeout(() => dispatch({ type: "REVEAL", key: agent.key, count: ui + 1 }), d),
            );
            d += u === "step" ? 310 : 160;
          });
          // scroll the active card into view
          timers.current.push(
            window.setTimeout(() => {
              cardRefs.current[agent.key]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }, 80),
          );
        }, startAt),
      );
      const workMs = agent.workMs ?? 2000;
      timers.current.push(
        window.setTimeout(() => {
          dispatch({ type: "AGENT_DONE", key: agent.key });
          if (oi === order.length - 1) {
            dispatch({ type: "FINISH" });
            toast.success(config.relayCompleteToast);
          }
        }, startAt + workMs),
      );
      cursor = startAt + workMs + 460;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, instantState, keys, triggerIdx, triggerKey]);

  const trigger = config.agents[triggerIdx];

  return (
    <SectionWrapper id="roster">
      <SectionHeader title={config.rosterTitle} subtitle={config.rosterIntro} />

      {/* Orchestrator band */}
      <div className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl border border-accent-line bg-accent-weak px-6 py-5">
        <span className="grid h-12 w-12 flex-none place-items-center rounded-xl bg-gradient-to-br from-primary-blue to-accent shadow-[0_8px_20px_-6px_rgba(37,99,235,0.5)]">
          <ICONS.orchestrator className="h-6 w-6 text-white" />
        </span>
        <div>
          <b className="font-display text-[18px] font-extrabold text-ink">{config.orchestratorName}</b>
          <p className="mt-0.5 max-w-3xl text-[14px] leading-relaxed text-ink-2">{config.orchestratorBlurb}</p>
        </div>
      </div>

      {/* Handoff pipeline strip */}
      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-line bg-surface transition-all duration-500",
          state.stripVisible ? "mb-6 max-h-40 px-6 py-4 opacity-100" : "mb-0 max-h-0 px-6 py-0 opacity-0",
        )}
      >
        <div className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.07em] text-ink-3">
          <ICONS.network className="h-3 w-3 text-accent" /> Live handoff pipeline
        </div>
        <div className="flex items-center overflow-x-auto pb-1">
          {config.agents.map((a, i) => {
            const NodeIcon = ICONS[a.icon];
            const ns = state.node[a.key];
            return (
              <div key={a.key} className="flex items-center">
                {i > 0 && (
                  <span
                    className={cn(
                      "mb-6 h-0.5 w-6 flex-none transition-colors duration-500 sm:w-10",
                      state.conn[a.key] ? "bg-gradient-to-r from-ok to-accent" : "bg-line-2",
                    )}
                  />
                )}
                <div className="flex min-w-[60px] flex-none flex-col items-center gap-1.5">
                  <span
                    className={cn(
                      "grid h-[34px] w-[34px] place-items-center rounded-full border-2 transition-all duration-300",
                      ns === "idle" && "border-line-2 bg-row",
                      ns === "running" && "border-accent bg-accent-weak motion-safe:animate-pulse2",
                      ns === "done" && "border-ok-line bg-ok-bg",
                    )}
                  >
                    {ns === "done" ? (
                      <Check className="h-[15px] w-[15px] text-ok" strokeWidth={2.6} />
                    ) : (
                      <NodeIcon
                        className={cn("h-[15px] w-[15px]", ns === "running" ? "text-accent" : "text-ink-3")}
                      />
                    )}
                  </span>
                  <span className={cn("text-[11.5px] font-bold", ns === "idle" ? "text-ink-3" : "text-ink-2")}>
                    {a.name}
                  </span>
                  {a.pipeSub && <span className="text-[9.5px] text-ink-3">{a.pipeSub}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Click prompt */}
      <p className="mb-4 text-center text-[13px] font-medium text-ink-2">{config.rosterClickNote}</p>

      {/* Roster grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {config.agents.map((a) => {
          const isTrigger = a.key === triggerKey;
          return (
            <div
              key={a.key}
              ref={(el) => {
                cardRefs.current[a.key] = el;
              }}
            >
              {isTrigger ? (
                <TriggerCard agent={a} state={state} onClick={runRelay} />
              ) : (
                <FlowCard agent={a} state={state} />
              )}
            </div>
          );
        })}
      </div>

      {/* Accessible static fallback hint */}
      <p className="sr-only">
        Ava captures patient intake by voice, then hands a structured summary to {downstream.length} downstream
        agents — triage, documentation, coordination, billing, knowledge and ICU monitoring — each acting on the
        shared context, with {config.orchestratorName} orchestrating and a clinician approving every clinical
        action.
      </p>
      <span className="sr-only">{trigger.name} starts the workflow.</span>
    </SectionWrapper>
  );
}

/* ---------------- cards ---------------- */

function cardShell(stateForCard: CardState) {
  return cn(
    "relative flex h-full flex-col rounded-2xl border bg-surface p-5 transition-all duration-300",
    stateForCard === "idle" && "border-line shadow-well-sm hover:-translate-y-1 hover:shadow-well",
    stateForCard === "waiting" && "border-line opacity-50 saturate-50",
    stateForCard === "active" &&
      "border-accent-line shadow-[0_0_0_4px_rgba(37,99,235,0.10),0_8px_28px_-10px_rgba(16,18,30,0.2)]",
    stateForCard === "done" && "border-ok-line shadow-[0_0_0_3px_rgba(21,128,61,0.08)]",
  );
}

function CardHead({ agent }: { agent: AgentDef }) {
  const Icon = ICONS[agent.icon];
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-accent-weak">
        <Icon className="h-[21px] w-[21px] text-accent" strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <b className="block truncate font-display text-[16px] font-bold text-ink">{agent.name}</b>
        <span className="block truncate text-[12px] font-bold uppercase tracking-[0.05em] text-accent">
          {agent.role}
        </span>
      </div>
    </div>
  );
}

function CardTags({ agent }: { agent: AgentDef }) {
  return (
    <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
      {agent.live && (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-ok-line bg-ok-bg px-2 py-1 text-[11px] font-bold text-ok">
          <span className="h-[6px] w-[6px] rounded-full bg-ok motion-safe:animate-pulse2" />
          {agent.live.label}
        </span>
      )}
      {agent.tags.map((t) => (
        <span
          key={t}
          className="rounded-md border border-line bg-band px-2 py-1 text-[11px] font-medium text-ink-2"
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function CardBadge({ stateForCard }: { stateForCard: CardState }) {
  if (stateForCard === "active")
    return (
      <span className="mb-1 inline-flex w-fit items-center gap-1.5 rounded-lg border border-accent-line bg-accent-weak px-2.5 py-1 text-[11.5px] font-bold text-accent">
        <Loader2 className="h-3 w-3 animate-spin" /> Processing…
      </span>
    );
  if (stateForCard === "done")
    return (
      <span className="mb-1 inline-flex w-fit items-center gap-1.5 rounded-lg border border-ok-line bg-ok-bg px-2.5 py-1 text-[11.5px] font-bold text-ok">
        <Check className="h-3 w-3" strokeWidth={2.6} /> Done
      </span>
    );
  return null;
}

function TriggerCard({
  agent,
  state,
  onClick,
}: {
  agent: AgentDef;
  state: State;
  onClick: () => void;
}) {
  const voice = agent.voice!;
  const open = state.voice !== "idle";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(cardShell("idle"), "w-full select-none text-left")}
      aria-label={`Start voice intake with ${agent.name}`}
    >
      <CardHead agent={agent} />
      <p className="text-[13.6px] leading-relaxed text-ink-2">{agent.blurb}</p>

      {!open && (
        <span className="mt-3 flex items-center gap-2 border-t border-dashed border-accent-line pt-3 text-[12.5px] font-bold text-accent">
          <Mic className="h-3.5 w-3.5" /> Click to start voice intake
        </span>
      )}

      {/* Voice panel */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-500",
          open ? "mt-3 max-h-[320px] border-t border-line pt-3 opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "grid h-10 w-10 flex-none place-items-center rounded-full",
              state.voice === "done"
                ? "bg-ok shadow-[0_4px_14px_-2px_rgba(21,128,61,0.4)]"
                : "bg-gradient-to-br from-primary-blue to-accent motion-safe:animate-pulse2",
            )}
          >
            {state.voice === "done" ? (
              <Check className="h-[19px] w-[19px] text-white" strokeWidth={2.6} />
            ) : (
              <Mic className="h-[18px] w-[18px] text-white" />
            )}
          </span>
          <div className="min-w-0">
            <b className="block text-[13px] font-bold leading-tight text-ink">
              {state.voice === "done" ? voice.doneTitle : voice.listeningTitle}
            </b>
            <span className="text-[11px] text-ink-3">
              {state.voice === "done" ? voice.doneSub : voice.listeningSub}
            </span>
          </div>
          <div className="ml-auto flex h-6 items-center gap-[3px]">
            {[8, 16, 22, 14, 20, 10, 18, 12].map((h, i) => (
              <span
                key={i}
                className={cn(
                  "w-[3px] rounded-full bg-accent transition-all duration-300",
                  state.voice === "listening" ? "opacity-75 motion-safe:animate-pulse2" : "opacity-20",
                )}
                style={{
                  height: state.voice === "done" ? 3 : h,
                  animationDelay: `${i * 70}ms`,
                }}
              />
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-1.5">
          {voice.fields.map((f, i) => (
            <div
              key={f.label}
              className={cn(
                "flex items-baseline gap-2 text-[12.5px] transition-all duration-300",
                i < state.fieldsShown ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
              )}
            >
              <span className="min-w-[110px] flex-none text-[11.5px] font-bold text-ink-3">{f.label}</span>
              <span className={cn("leading-snug", f.ok ? "font-bold text-ok" : "font-medium text-ink-2")}>
                {f.ok && "✓ "}
                {f.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <CardTags agent={agent} />
    </button>
  );
}

function FlowCard({ agent, state }: { agent: AgentDef; state: State }) {
  const cardState = state.card[agent.key];
  const opened = cardState === "active" || cardState === "done";
  const showAll = cardState !== "active"; // hover / done → show every unit; active → animate in
  const revealCount = state.reveal[agent.key] ?? 0;
  let unit = -1;
  const visible = () => {
    unit += 1;
    return showAll || unit < revealCount;
  };

  return (
    <div className={cn(cardShell(cardState), "group")}>
      <CardHead agent={agent} />
      <p className="text-[13.6px] leading-relaxed text-ink-2">{agent.blurb}</p>
      <CardBadge stateForCard={cardState} />

      {/* Flow panel */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-500",
          opened
            ? "mt-3 max-h-[900px] border-t border-line pt-3 opacity-100"
            : "max-h-0 opacity-0 group-hover:mt-3 group-hover:max-h-[900px] group-hover:border-t group-hover:border-line group-hover:pt-3 group-hover:opacity-100",
        )}
      >
        {(agent.flow ?? []).map((block, bi) => (
          <div key={bi} className={bi > 0 ? "mt-3" : ""}>
            {block.fromLabel &&
              (() => {
                const show = visible();
                return (
                  <div
                    className={cn(
                      "mb-2 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-3 transition-all duration-300",
                      show ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
                    )}
                  >
                    <ArrowRight className="h-[11px] w-[11px] text-accent" />
                    {block.fromLabel}
                  </div>
                );
              })()}

            {block.chips && block.chips.length > 0 &&
              (() => {
                const show = visible();
                return (
                  <div
                    className={cn(
                      "mb-2.5 flex flex-wrap gap-1.5 transition-all duration-300",
                      show ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
                    )}
                  >
                    {block.chips.map((c) => (
                      <span
                        key={c}
                        className="rounded-md border border-accent-line bg-accent-weak px-2 py-0.5 text-[11px] font-medium text-accent"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                );
              })()}

            {block.steps && block.steps.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {block.steps.map((s, si) => {
                  const show = visible();
                  return (
                    <div
                      key={si}
                      className={cn(
                        "flex items-start gap-2 text-[12.5px] font-medium leading-snug text-ink transition-all duration-300",
                        show ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-px grid h-[18px] w-[18px] flex-none place-items-center rounded",
                          s.kind === "esc" ? "bg-wait-bg" : "bg-ok-bg",
                        )}
                      >
                        {s.kind === "esc" ? (
                          <TriangleAlert className="h-[10px] w-[10px] text-wait" />
                        ) : (
                          <Check className="h-[10px] w-[10px] text-ok" strokeWidth={2.6} />
                        )}
                      </span>
                      <span>{s.text}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {block.note &&
              (() => {
                const show = visible();
                return (
                  <p
                    className={cn(
                      "mt-2.5 rounded-lg border border-line bg-band px-2.5 py-2 text-[11.5px] italic leading-snug text-ink-3 transition-all duration-300",
                      show ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
                    )}
                  >
                    {block.note}
                  </p>
                );
              })()}
          </div>
        ))}
      </div>

      <CardTags agent={agent} />
    </div>
  );
}
