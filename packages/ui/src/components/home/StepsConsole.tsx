"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { AnimateIn } from '../ui/AnimateIn';
import { HomeSectionHead } from "./HomeSectionHead";

const STEPS = [
  {
    title: "Describe or select",
    desc: "Tell us what you need in plain English, or start from a production-tested template.",
  },
  {
    title: "Test in sandbox",
    desc: "Your agent runs on real infrastructure immediately. Trace every decision, share a preview.",
  },
  {
    title: "Deploy with one click",
    desc: "Flip the switch. Your agent is live, monitored, and scaling — zero migration, zero downtime.",
  },
];

// [active step, done-up-to] per stage
const STEP_CFG: [number, number][] = [
  [0, -1],
  [1, 0],
  [2, 1],
  [2, 2],
];
const STAGE_DUR = [3000, 3000, 2400, 3400];
const PILLS = ["draft", "testing", "deploying", "live"] as const;

const TYPE_FULL = "Build a support agent that tracks customer orders…";
const TRACE = [
  { a: "→", t: "user: where is order #4821?" },
  { tk: "tool", t: "lookup_order(4821)", a: "→ shipped" },
  { tk: "tool", t: "get_eta(4821)", a: "→ Fri" },
  { a: "→", t: "agent: shipped, arriving Friday." },
];
const DEP_ROWS = ["Building agent image", "Provisioning on k3s pool", "Routing & health checks"];

const pillClasses: Record<(typeof PILLS)[number], string> = {
  draft: "bg-row text-ink-2",
  testing: "bg-wait-bg text-wait border border-wait-line",
  deploying: "bg-accent-weak text-accent border border-accent-line",
  live: "bg-ok-bg text-ok border border-ok-line",
};
const pillDot: Record<(typeof PILLS)[number], string> = {
  draft: "bg-ink-3",
  testing: "bg-wait",
  deploying: "bg-accent motion-safe:animate-blink",
  live: "bg-ok motion-safe:animate-pulse2",
};

export function StepsConsole() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [reduce, setReduce] = useState(false);
  const [stage, setStage] = useState(0);

  const [typed, setTyped] = useState("");
  const [traceCount, setTraceCount] = useState(0);
  const [depPct, setDepPct] = useState(0);
  const [reqs, setReqs] = useState("142 req/s");

  // Detect reduced motion + render resting state if so.
  useEffect(() => {
    const r = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduce(r);
    if (r) {
      setStage(3);
      setTyped(TYPE_FULL);
      setTraceCount(TRACE.length);
      setDepPct(100);
    }
  }, []);

  // Gate the loop on scroll-into-view.
  useEffect(() => {
    if (reduce || !sectionRef.current) return;
    if (!("IntersectionObserver" in window)) {
      setStarted(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setStarted(true)),
      { threshold: 0.3 },
    );
    io.observe(sectionRef.current);
    return () => io.disconnect();
  }, [reduce]);

  // Stage loop driver.
  useEffect(() => {
    if (!started || reduce) return;
    const t = setTimeout(() => setStage((s) => (s + 1) % 4), STAGE_DUR[stage]);
    return () => clearTimeout(t);
  }, [started, stage, reduce]);

  // Per-stage animations.
  useEffect(() => {
    if (!started || reduce) return;
    if (stage === 0) {
      setTyped("");
      let i = 0;
      const id = setInterval(() => {
        i += 1;
        setTyped(TYPE_FULL.slice(0, i));
        if (i >= TYPE_FULL.length) clearInterval(id);
      }, 38);
      return () => clearInterval(id);
    }
    if (stage === 1) {
      setTraceCount(0);
      let i = 0;
      const id = setInterval(() => {
        i += 1;
        setTraceCount(i);
        if (i >= TRACE.length) clearInterval(id);
      }, 360);
      return () => clearInterval(id);
    }
    if (stage === 2) {
      setDepPct(0);
      const start = Date.now();
      const dur = 1700;
      const id = setInterval(() => {
        const p = Math.min(100, Math.round(((Date.now() - start) / dur) * 100));
        setDepPct(p);
        if (p >= 100) clearInterval(id);
      }, 60);
      return () => clearInterval(id);
    }
    if (stage === 3) {
      const id = setInterval(() => {
        setReqs(142 + Math.floor((Math.random() - 0.5) * 22) + " req/s");
      }, 900);
      return () => clearInterval(id);
    }
  }, [stage, started, reduce]);

  const [active, doneUpto] = STEP_CFG[stage];
  const railH = active === 0 ? 0 : active === 1 ? 50 : 100;
  const pill = PILLS[stage];

  return (
    <section className="bg-band py-24">
      <div className="mx-auto max-w-site px-8">
        <AnimateIn>
          <HomeSectionHead
            eyebrow="Step by step"
            title="Go live in three steps"
            sub="From plain-English brief to a deployed, monitored agent — running on the same infrastructure that powers your backend."
          />
        </AnimateIn>

        <div
          ref={sectionRef}
          className="mt-[54px] grid grid-cols-1 items-center gap-14 min-[960px]:grid-cols-[0.92fr_1.08fr]"
        >
          {/* Step rail */}
          <div className="relative">
            <div className="absolute left-[18.5px] top-[38px] bottom-[38px] w-[2px] bg-line-2">
              <i
                className="absolute left-0 top-0 block w-full bg-accent transition-[height] duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{ height: `${railH}%` }}
              />
            </div>
            {STEPS.map((s, k) => {
              const on = k === active;
              const done = k <= doneUpto && k !== active;
              return (
                <div key={s.title} className="relative py-[18px] pl-14">
                  <div
                    className={`absolute left-0 top-[18px] z-[2] grid h-[38px] w-[38px] place-items-center rounded-[11px] border font-mono text-[14px] font-medium transition-all duration-[400ms] ${
                      on
                        ? "border-accent bg-accent text-white shadow-[0_0_0_4px_var(--accent-weak)]"
                        : done
                          ? "border-accent bg-accent text-white"
                          : "border-line-2 bg-surface text-ink-3"
                    }`}
                  >
                    {done ? <Check className="h-[17px] w-[17px]" strokeWidth={2.6} /> : k + 1}
                  </div>
                  <div
                    className={`font-display text-[19px] font-bold tracking-[-0.01em] transition-opacity duration-[400ms] ${
                      on || done ? "opacity-100" : "opacity-45"
                    }`}
                  >
                    {s.title}
                  </div>
                  <div
                    className={`mt-[5px] max-w-[330px] text-[14.5px] text-ink-2 transition-opacity duration-[400ms] ${
                      on || done ? "opacity-100" : "opacity-45"
                    }`}
                  >
                    {s.desc}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Console */}
          <div className="overflow-hidden rounded-[16px] border border-line bg-surface shadow-well">
            <div className="flex items-center gap-[10px] border-b border-row px-[18px] py-[14px]">
              <span className="font-mono text-[13px] text-ink">
                agent: <span className="text-ink-3">order-tracker</span>
              </span>
              <span
                className={`ml-auto inline-flex items-center gap-[6px] rounded-full px-[11px] py-[3px] text-[12px] font-medium transition-all duration-[350ms] ${pillClasses[pill]}`}
              >
                <span className={`h-[6px] w-[6px] rounded-full ${pillDot[pill]}`} />
                {pill}
              </span>
            </div>

            <div className="relative min-h-[248px]">
              {/* Panel 0 — describe */}
              <Panel show={stage === 0}>
                <div className="min-h-[74px] rounded-[11px] border border-line-2 px-[15px] py-[13px] text-[14px] text-ink">
                  {typed}
                  <span className="ml-px inline-block h-4 w-px translate-y-[3px] bg-accent motion-safe:animate-blink" />
                </div>
                <div className="mt-[14px] flex flex-wrap gap-2">
                  <span className="rounded-full border border-accent-line bg-accent-weak px-3 py-[6px] text-[12.5px] font-medium text-accent">
                    E-Commerce
                  </span>
                  {["Order tracking", "Cart recovery"].map((c) => (
                    <span
                      key={c}
                      className="rounded-full border border-line-2 bg-surface px-3 py-[6px] text-[12.5px] text-ink-2"
                    >
                      {c}
                    </span>
                  ))}
                </div>
                <div className="mt-4 font-mono text-[12px] text-ink-3">
                  template: ecommerce/support &middot; 1-click
                </div>
              </Panel>

              {/* Panel 1 — sandbox */}
              <Panel show={stage === 1}>
                <div className="font-mono text-[12.5px]">
                  {TRACE.map((l, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-[9px] py-[7px] text-ink-2 transition-all duration-300 ${
                        i < traceCount ? "translate-x-0 opacity-100" : "-translate-x-[6px] opacity-0"
                      }`}
                    >
                      {l.tk ? <span className="text-ok">{l.tk}</span> : <span className="text-ink-3">{l.a}</span>}
                      <span>{l.t}</span>
                      {l.tk && <span className="text-ink-3">{l.a}</span>}
                    </div>
                  ))}
                </div>
                <div className="mt-[14px] inline-flex items-center gap-[7px] rounded-[9px] border border-ok-line bg-ok-bg px-3 py-[6px] text-[13px] font-medium text-ok">
                  <Check className="h-[14px] w-[14px]" strokeWidth={2.6} /> 3 / 3 checks passed in sandbox
                </div>
              </Panel>

              {/* Panel 2 — deploy */}
              <Panel show={stage === 2}>
                {DEP_ROWS.map((r, i) => {
                  const done = depPct >= (i + 1) * 33;
                  return (
                    <div
                      key={r}
                      className="flex items-center gap-[9px] py-[6px] font-mono text-[12.5px] text-ink-2"
                    >
                      <span className={done ? "text-ok" : "text-ink-3"}>
                        {done ? "✓" : "○"}
                      </span>
                      {r}
                    </div>
                  );
                })}
                <div className="my-4 h-[7px] overflow-hidden rounded-[4px] bg-[#EEEDE9]">
                  <i
                    className="block h-full rounded-[4px] bg-accent"
                    style={{ width: `${depPct}%`, transition: "width 60ms linear" }}
                  />
                </div>
                <div className="font-mono text-[12px] text-ink-3">
                  {depPct >= 100 ? "deployed ✓" : `deploying… ${depPct}%`}
                </div>
              </Panel>

              {/* Panel 3 — live */}
              <Panel show={stage === 3}>
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="mb-4 grid h-[54px] w-[54px] place-items-center rounded-full border border-ok-line bg-ok-bg text-ok">
                    <Check className="h-[26px] w-[26px]" strokeWidth={2.5} />
                  </div>
                  <div className="font-display text-[22px] font-bold tracking-[-0.01em]">
                    Agent deployed
                  </div>
                  <div className="mt-[7px] font-mono text-[12.5px] text-ink-3">
                    live &middot; monitored &middot; auto-scaling
                  </div>
                  <div className="mt-[14px] font-mono text-[13px] text-accent">{reqs}</div>
                </div>
              </Panel>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Panel({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`absolute inset-0 p-5 transition-all duration-[450ms] ${
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      }`}
    >
      {children}
    </div>
  );
}
