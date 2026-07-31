"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { toast } from "sonner";
import { Check, Loader2, Play, RotateCcw, ShieldCheck, TriangleAlert } from "lucide-react";
import { SectionWrapper } from '@rach/ui/components/ui/SectionWrapper';
import { SectionHeader } from '@rach/ui/components/ui/SectionHeader';
import { cn } from '@rach/ui/lib/utils';
import { ICONS } from "@/lib/industries/icons";
import type { IndustryConfig, Scenario } from "@/lib/industries/types";
import { useAgentFeed, type AgentFeedSource } from "@/lib/agentFeed";

type Phase = "idle" | "running" | "complete";
type StageState = "idle" | "reached" | "done" | "flag";
type AgentState = "idle" | "working" | "done" | "flag";

interface TNode {
  i: number;
  agentKey: string;
  title: string;
  detail: string;
  status: "active" | "done" | "flag";
  badge?: { kind: "ok" | "gate" | "esc"; label: string };
}

interface State {
  scenarioKey: string;
  phase: Phase;
  nodes: TNode[];
  stage: Record<string, StageState>;
  agent: Record<string, AgentState>;
  word: Record<string, string>;
}

type Action =
  | { type: "RESET"; scenarioKey: string; agentKeys: string[]; stageKeys: string[]; phase: Phase }
  | { type: "ACTIVATE"; node: TNode; stageKey: string; isEsc: boolean }
  | { type: "RESOLVE"; i: number; status: "ok" | "gate" | "esc"; badgeLabel: string; agentKey: string; stageKey: string; word: string }
  | { type: "COMPLETE" }
  | { type: "INSTANT"; state: State };

function idleMaps(agentKeys: string[], stageKeys: string[]) {
  const agent: Record<string, AgentState> = {};
  const word: Record<string, string> = {};
  const stage: Record<string, StageState> = {};
  agentKeys.forEach((k) => {
    agent[k] = "idle";
    word[k] = "Idle";
  });
  stageKeys.forEach((k) => (stage[k] = "idle"));
  return { agent, word, stage };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "RESET": {
      const { agent, word, stage } = idleMaps(action.agentKeys, action.stageKeys);
      return { scenarioKey: action.scenarioKey, phase: action.phase, nodes: [], stage, agent, word };
    }
    case "ACTIVATE": {
      const stage = { ...state.stage };
      const prev = stage[action.stageKey];
      if (action.isEsc) stage[action.stageKey] = "flag";
      else if (prev !== "done" && prev !== "flag") stage[action.stageKey] = "reached";
      return {
        ...state,
        nodes: [...state.nodes, action.node],
        agent: { ...state.agent, [action.node.agentKey]: "working" },
        word: { ...state.word, [action.node.agentKey]: "Working" },
        stage,
      };
    }
    case "RESOLVE": {
      const nodes = state.nodes.map((n) =>
        n.i === action.i
          ? {
              ...n,
              status: action.status === "esc" ? ("flag" as const) : ("done" as const),
              badge: { kind: action.status, label: action.badgeLabel },
            }
          : n,
      );
      const stage = { ...state.stage };
      if (action.status === "esc") stage[action.stageKey] = "flag";
      else if (stage[action.stageKey] !== "flag") stage[action.stageKey] = "done";
      return {
        ...state,
        nodes,
        agent: { ...state.agent, [action.agentKey]: action.status === "esc" ? "flag" : "done" },
        word: { ...state.word, [action.agentKey]: action.word },
        stage,
      };
    }
    case "COMPLETE":
      return { ...state, phase: "complete" };
    case "INSTANT":
      return action.state;
    default:
      return state;
  }
}

const badgeFor = (status: "ok" | "gate" | "esc", gateBy?: string) =>
  status === "gate"
    ? `Approved · ${(gateBy ?? "").split("·")[0].trim()}`
    : status === "esc"
      ? "Escalated"
      : "Done";
const wordFor = (status: "ok" | "gate" | "esc") =>
  status === "esc" ? "Escalated" : status === "gate" ? "Approved" : "Done";

export function ControlTower({
  config,
  source = "mock",
}: {
  config: IndustryConfig;
  /** "mock" = scripted marketing demo · "live" = authenticated workspace (later sprint). */
  source?: AgentFeedSource;
}) {
  // Agent-feed seam: same component, mock or live data source.
  const feed = useAgentFeed(config, source);
  const agentKeys = config.agents.map((a) => a.key);
  const stageKeys = config.stages.map((s) => s.key);

  const [state, dispatch] = useReducer(reducer, null, (): State => {
    const { agent, word, stage } = idleMaps(agentKeys, stageKeys);
    return { scenarioKey: config.scenarios[0].key, phase: "idle", nodes: [], stage, agent, word };
  });

  const timers = useRef<number[]>([]);
  const played = useRef(false);
  const towerRef = useRef<HTMLDivElement>(null);
  const traceRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const reduceMotion = () =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scenarioByKey = useCallback(
    (key: string) => config.scenarios.find((s) => s.key === key) ?? config.scenarios[0],
    [config.scenarios],
  );

  const buildFinalState = useCallback(
    (sc: Scenario): State => {
      const { agent, word, stage } = idleMaps(agentKeys, stageKeys);
      const nodes: TNode[] = sc.steps.map((step, i) => {
        agent[step.agent] = step.status === "esc" ? "flag" : "done";
        word[step.agent] = wordFor(step.status);
        if (step.status === "esc") stage[step.stage] = "flag";
        else if (stage[step.stage] !== "flag") stage[step.stage] = "done";
        return {
          i,
          agentKey: step.agent,
          title: step.title,
          detail: step.detail,
          status: step.status === "esc" ? "flag" : "done",
          badge: { kind: step.status, label: badgeFor(step.status, step.gateBy) },
        };
      });
      return { scenarioKey: sc.key, phase: "complete", nodes, stage, agent, word };
    },
    [agentKeys, stageKeys],
  );

  const runScenario = useCallback(
    (key: string) => {
      clearTimers();
      const sc = scenarioByKey(key);
      if (reduceMotion()) {
        dispatch({ type: "INSTANT", state: buildFinalState(sc) });
        toast.success(config.completeToast);
        return;
      }
      dispatch({ type: "RESET", scenarioKey: key, agentKeys, stageKeys, phase: "running" });
      let t = 300;
      sc.steps.forEach((step, i) => {
        timers.current.push(
          window.setTimeout(() => {
            dispatch({
              type: "ACTIVATE",
              node: { i, agentKey: step.agent, title: step.title, detail: step.detail, status: "active" },
              stageKey: step.stage,
              isEsc: step.status === "esc",
            });
          }, t),
        );
        timers.current.push(
          window.setTimeout(() => {
            dispatch({
              type: "RESOLVE",
              i,
              status: step.status,
              badgeLabel: badgeFor(step.status, step.gateBy),
              agentKey: step.agent,
              stageKey: step.stage,
              word: wordFor(step.status),
            });
            if (i === sc.steps.length - 1) {
              dispatch({ type: "COMPLETE" });
              toast.success(config.completeToast);
            }
          }, t + step.ms),
        );
        t += step.ms + 350;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.completeToast, scenarioByKey, buildFinalState],
  );

  const runRef = useRef(runScenario);
  runRef.current = runScenario;

  // Auto-scroll the trace as nodes arrive.
  useEffect(() => {
    if (traceRef.current) traceRef.current.scrollTop = traceRef.current.scrollHeight;
  }, [state.nodes]);

  // Auto-play once when scrolled into view.
  useEffect(() => {
    if (reduceMotion()) return;
    const el = towerRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !played.current) {
            played.current = true;
            timers.current.push(
              window.setTimeout(() => {
                if (stateRef.current.phase !== "running") runRef.current(stateRef.current.scenarioKey);
              }, 650),
            );
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.18 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Clean up timers on unmount.
  useEffect(() => () => clearTimers(), []);

  const selectScenario = (key: string) => {
    if (key === state.scenarioKey) return;
    clearTimers();
    dispatch({ type: "RESET", scenarioKey: key, agentKeys, stageKeys, phase: "idle" });
  };

  const sc = scenarioByKey(state.scenarioKey);
  const ChannelIcon = ICONS[sc.channelIcon];
  const agentMap = Object.fromEntries(config.agents.map((a) => [a.key, a]));

  return (
    <SectionWrapper id="tower">
      <SectionHeader title={config.towerTitle} subtitle={config.towerIntro} />

      <div
        ref={towerRef}
        data-feed-source={feed.source}
        data-live={feed.isLive || undefined}
        className="overflow-hidden rounded-3xl border border-line bg-gradient-to-b from-surface to-band p-3 shadow-well-sm sm:p-4"
      >
        {/* Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-2 py-2">
          <div className="flex items-center gap-2.5 font-display text-[16px] font-bold text-ink">
            <span className="relative grid h-2.5 w-2.5 place-items-center">
              <span className="absolute h-2.5 w-2.5 rounded-full bg-ok/30" />
              <span className="h-1.5 w-1.5 rounded-full bg-ok motion-safe:animate-pulse2" />
            </span>
            Control Tower
          </div>
          <div className="flex flex-wrap gap-2">
            {config.scenarios.map((s) => {
              const TabIcon = ICONS[s.tabIcon];
              const active = s.key === state.scenarioKey;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => selectScenario(s.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-all",
                    active
                      ? "border-transparent bg-accent text-white shadow-[0_6px_16px_-6px_rgba(37,99,235,0.6)]"
                      : "border-line-2 bg-surface text-ink-2 hover:border-ink-3",
                  )}
                >
                  <TabIcon className="h-3.5 w-3.5" />
                  {s.tabLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* Subject banner */}
        <div className="mx-1 mb-2.5 flex flex-wrap items-center gap-3.5 rounded-2xl border border-line bg-surface px-4 py-3.5">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-accent-weak">
            <ICONS.heart className="h-[20px] w-[20px] text-accent" />
          </span>
          <div>
            <b className="block text-[15px] font-bold leading-tight text-ink">{sc.subjectName}</b>
            <span className="text-[12.8px] text-ink-3">{sc.subjectDesc}</span>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-accent-line bg-accent-weak px-3 py-1.5 text-[12px] font-bold text-accent">
            <ChannelIcon className="h-3.5 w-3.5" />
            {sc.channel}
          </span>
        </div>

        {/* Journey rail */}
        <div className="mx-1 mb-2.5 overflow-x-auto rounded-2xl border border-line bg-surface px-4 py-4">
          <div className="flex min-w-[640px] items-start">
            {config.stages.map((stage, i) => {
              const st = state.stage[stage.key];
              const StageIcon = ICONS[stage.icon];
              return (
                <div key={stage.key} className="relative z-10 flex-1 text-center">
                  {i > 0 && (
                    <span className="absolute left-[-50%] top-[15px] -z-10 h-0.5 w-full bg-line-2" />
                  )}
                  <span
                    className={cn(
                      "mx-auto grid h-[30px] w-[30px] place-items-center rounded-full border-2 transition-all duration-300",
                      st === "idle" && "border-line-2 bg-row",
                      st === "reached" && "border-accent bg-accent-weak",
                      st === "done" && "border-ok-line bg-ok-bg",
                      st === "flag" && "border-wait-line bg-wait-bg",
                    )}
                  >
                    <StageIcon
                      className={cn(
                        "h-[15px] w-[15px] transition-colors",
                        st === "idle" && "text-ink-3",
                        st === "reached" && "text-accent",
                        st === "done" && "text-ok",
                        st === "flag" && "text-wait",
                      )}
                    />
                  </span>
                  <div
                    className={cn(
                      "mt-2 text-[11.5px] font-bold leading-tight transition-colors",
                      st === "idle" ? "text-ink-3" : "text-ink-2",
                    )}
                  >
                    {stage.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Agents | Trace */}
        <div className="grid gap-2.5 px-1 pb-1 md:grid-cols-[0.82fr_1.18fr]">
          {/* Agents */}
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="mb-3 text-[12px] font-bold uppercase tracking-[0.05em] text-ink-3">Agents</div>
            {config.agents.map((a) => {
              const AgentIcon = ICONS[a.icon];
              const st = state.agent[a.key];
              return (
                <div
                  key={a.key}
                  className={cn(
                    "mb-1 flex items-center gap-2.5 rounded-xl border p-2.5 transition-all duration-300",
                    st === "working" ? "border-accent-line bg-accent-weak" : "border-transparent",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-9 w-9 flex-none place-items-center rounded-lg transition-all",
                      st === "idle" && "bg-row",
                      st === "working" && "bg-surface shadow-[0_0_0_3px_rgba(37,99,235,0.12)]",
                      st === "done" && "bg-ok-bg",
                      st === "flag" && "bg-wait-bg",
                    )}
                  >
                    <AgentIcon
                      className={cn(
                        "h-[18px] w-[18px] transition-colors",
                        st === "idle" && "text-ink-3",
                        st === "working" && "text-accent",
                        st === "done" && "text-ok",
                        st === "flag" && "text-wait",
                      )}
                    />
                  </span>
                  <div className="min-w-0">
                    <b className="block truncate text-[13.5px] font-bold leading-tight text-ink">{a.name}</b>
                    <span className="truncate text-[11.5px] text-ink-3">{a.role}</span>
                  </div>
                  <span
                    className={cn(
                      "ml-auto inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.04em]",
                      st === "idle" && "text-ink-3",
                      st === "working" && "text-accent",
                      st === "done" && "text-ok",
                      st === "flag" && "text-wait",
                    )}
                  >
                    <span
                      className={cn(
                        "h-[7px] w-[7px] rounded-full",
                        st === "idle" && "bg-ink-3",
                        st === "working" && "bg-accent motion-safe:animate-pulse2",
                        st === "done" && "bg-ok",
                        st === "flag" && "bg-wait",
                      )}
                    />
                    {state.word[a.key]}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Trace */}
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="mb-3 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.05em] text-ink-3">
              Decision trace
              <span className="ml-auto font-body text-[11px] font-bold normal-case tracking-normal text-ink-3">
                {state.nodes.length}/{sc.steps.length}
              </span>
            </div>
            <div ref={traceRef} className="max-h-[430px] min-h-[300px] overflow-y-auto pr-1">
              {state.nodes.length === 0 ? (
                <p className="px-3 py-16 text-center text-[13px] leading-relaxed text-ink-3">
                  Press <b className="text-ink-2">Run the journey</b> — or scroll in and watch it play
                  automatically. Every clinical action waits for a clinician.
                </p>
              ) : (
                <div className="flex flex-col gap-3.5">
                  {state.nodes.map((n) => {
                    const a = agentMap[n.agentKey];
                    const NodeIcon = ICONS[a.icon];
                    return (
                      <div key={n.i} className="flex items-start gap-3">
                        <span
                          className={cn(
                            "grid h-[34px] w-[34px] flex-none place-items-center rounded-lg border transition-all",
                            n.status === "active" && "border-accent-line bg-accent-weak",
                            n.status === "done" && "border-ok-line bg-ok-bg",
                            n.status === "flag" && "border-wait-line bg-wait-bg",
                          )}
                        >
                          <NodeIcon
                            className={cn(
                              "h-4 w-4",
                              n.status === "active" && "text-accent",
                              n.status === "done" && "text-ok",
                              n.status === "flag" && "text-wait",
                            )}
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <b className="text-[13.6px] font-bold leading-tight text-ink">{n.title}</b>
                            <span className="rounded-md border border-accent-line bg-accent-weak px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-accent">
                              {a.name}
                            </span>
                          </div>
                          <p className="mt-1 text-[12.6px] leading-snug text-ink-2">{n.detail}</p>
                        </div>
                        <div className="flex-none pt-0.5">
                          {n.status === "active" ? (
                            <Loader2 className="h-4 w-4 animate-spin text-accent" />
                          ) : (
                            n.badge && (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-bold",
                                  n.badge.kind === "esc"
                                    ? "border-wait-line bg-wait-bg text-wait"
                                    : "border-ok-line bg-ok-bg text-ok",
                                )}
                              >
                                {n.badge.kind === "esc" ? (
                                  <TriangleAlert className="h-3 w-3" />
                                ) : (
                                  <Check className="h-3 w-3" strokeWidth={2.6} />
                                )}
                                {n.badge.label}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Foot */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-1 pt-3.5">
          <span className="inline-flex items-center gap-2 text-[12.5px] text-ink-2">
            <ShieldCheck className="h-[15px] w-[15px] text-ok" />
            {config.gateNote}
          </span>
          <button
            type="button"
            disabled={state.phase === "running"}
            onClick={() => runScenario(state.scenarioKey)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[14px] font-semibold text-white transition-all",
              state.phase === "running" ? "cursor-not-allowed opacity-50" : "hover:-translate-y-px",
            )}
          >
            {state.phase === "running" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Running…
              </>
            ) : state.phase === "complete" ? (
              <>
                <RotateCcw className="h-4 w-4" /> Replay journey
              </>
            ) : (
              <>
                <Play className="h-4 w-4" /> Run the journey
              </>
            )}
          </button>
        </div>
      </div>
    </SectionWrapper>
  );
}
