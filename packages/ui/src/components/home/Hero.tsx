"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, AudioLines, Mic, PhoneOff } from "lucide-react";
import { HomeButton } from "./HomeButton";
import { StartBuildingButton } from '../ui/StartBuildingButton';

const BACKEND_WORDS = ["managed.", "monitored.", "secured.", "scaled.", "backed up."];
const AGENT_WORDS = ["deployed.", "trained.", "live.", "tuned."];

const VMS = [
  { n: "k3s-server-1", id: "qemu/101", cpu: 7.1, mem: 3.7, tot: 8 },
  { n: "k3s-server-2", id: "qemu/102", cpu: 6.2, mem: 4.41, tot: 8 },
  { n: "k3s-server-3", id: "qemu/103", cpu: 6.5, mem: 3.96, tot: 8 },
  { n: "k3s-worker-1", id: "qemu/111", cpu: 5.6, mem: 14.47, tot: 48 },
];

const INITIAL_SPARK = [45, 60, 40, 70, 50, 65, 85];
const INITIAL_WAVE = [30, 55, 80, 45, 70, 35, 60, 90, 50, 75, 40, 65];

const jit = (base: number, amp: number) =>
  Math.max(0.5, base + (Math.random() - 0.5) * amp);

export type HeroVariant = "full" | "backend" | "agent";

const EYEBROW: Record<HeroVariant, string> = {
  full: "Backend + AI Agents — One Platform",
  backend: "Managed Cloud — Backend as a Service",
  agent: "AI Agent Builder",
};

const SUBTITLE: Record<HeroVariant, string> = {
  full: "Production-ready backend infrastructure and an AI agent builder that turns your ideas into deployed, working agents — in a single click. No DevOps. No complexity. Just build.",
  backend: "Production-ready backend infrastructure — managed PostgreSQL, VMs, auth, and auto-generated APIs. Provisioned in a single click. No DevOps. No complexity.",
  agent: "An AI agent builder that turns your ideas into deployed, working agents — chat and voice — in a single click. No DevOps. No complexity. Just build.",
};

export function Hero({ variant = "full" }: { variant?: HeroVariant } = {}) {
  const showBackend = variant !== "agent";
  const showAgent = variant !== "backend";

  const rotateRef = useRef<HTMLSpanElement>(null);
  const rotate2Ref = useRef<HTMLSpanElement>(null);

  const [metrics, setMetrics] = useState(
    VMS.map((v) => ({ cpu: v.cpu, mem: v.mem, memPct: (v.mem / v.tot) * 100 })),
  );
  const [apiVal, setApiVal] = useState(12847);
  const [spark, setSpark] = useState<number[]>(INITIAL_SPARK);
  const [wave, setWave] = useState<number[]>(INITIAL_WAVE);
  const [ts, setTs] = useState("live");

  // Rotating headline(s) — only wire up rotators for lines that are shown.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const make = (el: HTMLSpanElement, words: string[]) => {
      let i = 0;
      return () => {
        i = (i + 1) % words.length;
        el.style.opacity = "0";
        el.style.transform = "translateY(-8px)";
        setTimeout(() => {
          el.textContent = words[i];
          el.style.transform = "translateY(8px)";
          void el.offsetWidth;
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
        }, 420);
      };
    };

    const timers: ReturnType<typeof setInterval>[] = [];
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    if (rotateRef.current) timers.push(setInterval(make(rotateRef.current, BACKEND_WORDS), 2200));
    if (rotate2Ref.current) {
      const el = rotate2Ref.current;
      timeouts.push(setTimeout(() => timers.push(setInterval(make(el, AGENT_WORDS), 2200)), 1100));
    }
    return () => {
      timers.forEach(clearInterval);
      timeouts.forEach(clearTimeout);
    };
  }, []);

  // Live tick — VM metrics, API counter, sparkline, voice waveform.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      setMetrics(VMS.map((v) => {
        const c = jit(v.cpu, 2.6);
        const m = jit(v.mem, v.tot * 0.035);
        return { cpu: c, mem: m, memPct: (m / v.tot) * 100 };
      }));
      setApiVal((p) => p + Math.floor(Math.random() * 7));
      setSpark([...Array.from({ length: 6 }, () => 30 + Math.random() * 55), 78 + Math.random() * 22]);
      setWave(Array.from({ length: 12 }, () => 20 + Math.random() * 80));
      setTs("live · " + new Date().toLocaleTimeString("en-GB"));
    }, 2400);
    return () => clearInterval(id);
  }, []);

  // ── Card blocks ──────────────────────────────────────────────────────────
  const usersTable = (cls: string) => (
    <div className={`${cls} animate-pop overflow-hidden rounded-[15px] border border-line bg-surface opacity-0 shadow-well motion-reduce:animate-none motion-reduce:opacity-100 max-[960px]:static max-[960px]:w-full max-[960px]:max-w-[420px]`}>
      <div className="flex items-center gap-2 border-b border-row px-[15px] py-[11px] font-mono text-[12px] text-ink-2">
        <span className="h-[7px] w-[7px] rounded-full bg-accent" /> users_table
      </div>
      <table className="w-full border-collapse font-mono">
        <thead>
          <tr>{["id", "name", "status"].map((h) => (
            <th key={h} className="border-b border-row px-[15px] py-2 text-left text-[10px] font-medium uppercase tracking-[0.04em] text-ink-3">{h}</th>
          ))}</tr>
        </thead>
        <tbody className="text-[11.5px] text-ink">
          <UserRow id="1" name="Alice Johnson" status="ok" label="Active" />
          <UserRow id="2" name="Bob Smith" status="ok" label="Active" />
          <UserRow id="3" name="Carol Lee" status="wait" label="Pending" last />
        </tbody>
      </table>
    </div>
  );

  const vmPool = (cls: string) => (
    <div className={`${cls} animate-pop overflow-hidden rounded-[15px] border border-line bg-surface opacity-0 shadow-well motion-reduce:animate-none motion-reduce:opacity-100 max-[960px]:static max-[960px]:w-full max-[960px]:max-w-[420px]`}>
      <div className="flex items-center gap-[9px] border-b border-row px-[18px] py-[14px]">
        <span className="text-[14px] font-semibold">Tenant VM Pool</span>
        <span className="inline-flex items-center gap-[6px] rounded-full border border-accent-line bg-accent-weak px-2 py-[2px] font-mono text-[10.5px] text-accent">
          <span className="h-[5px] w-[5px] rounded-full bg-accent" /> pool: k3s
        </span>
        <span className="ml-auto flex items-center gap-[6px] font-mono text-[10.5px] text-ink-3">
          <span className="h-[6px] w-[6px] rounded-full bg-ok motion-safe:animate-pulse2" /> {ts}
        </span>
      </div>
      <div className="grid grid-cols-[1.35fr_0.82fr_1.5fr] items-center gap-[10px] px-[18px] pb-[7px] pt-[11px]">
        {["name", "cpu", "memory"].map((h) => (
          <span key={h} className="font-mono text-[9.5px] uppercase tracking-[0.05em] text-ink-3">{h}</span>
        ))}
      </div>
      {VMS.map((v, i) => (
        <div key={v.id} className="grid grid-cols-[1.35fr_0.82fr_1.5fr] items-center gap-[10px] border-t border-row px-[18px] py-[11px]">
          <div>
            <div className="font-mono text-[12px] text-ink">{v.n}</div>
            <div className="mt-[1px] font-mono text-[10px] text-ink-3">{v.id}</div>
            <div className="mt-1 inline-flex items-center gap-[5px] text-[11px] text-ok"><span className="h-[5px] w-[5px] rounded-full bg-ok" /> running</div>
          </div>
          <div>
            <div className="font-mono text-[11px] text-ink-2"><b className="font-medium text-ink">{metrics[i].cpu.toFixed(1)}</b>%</div>
            <div className="mt-[6px] h-[5px] overflow-hidden rounded-[3px] bg-[#EEEDE9]"><i className="block h-full rounded-[3px] bg-accent transition-[width] duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]" style={{ width: `${metrics[i].cpu}%` }} /></div>
          </div>
          <div>
            <div className="font-mono text-[11px] text-ink-2"><b className="font-medium text-ink">{metrics[i].mem.toFixed(2)}</b>/{v.tot}G <span className="text-ink-3">{metrics[i].memPct.toFixed(1)}%</span></div>
            <div className="mt-[6px] h-[5px] overflow-hidden rounded-[3px] bg-[#EEEDE9]"><i className="block h-full rounded-[3px] bg-mem transition-[width] duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]" style={{ width: `${metrics[i].memPct}%` }} /></div>
          </div>
        </div>
      ))}
    </div>
  );

  const agentChat = (cls: string) => (
    <div className={`${cls} animate-pop rounded-[15px] border border-line bg-surface opacity-0 shadow-well motion-reduce:animate-none motion-reduce:opacity-100 max-[960px]:static max-[960px]:w-full max-[960px]:max-w-[420px]`}>
      <div className="flex items-center gap-[9px] border-b border-row px-[14px] py-3">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-accent-weak text-accent"><Sparkles className="h-[14px] w-[14px]" /></div>
        <div>
          <div className="text-[13px] font-semibold leading-[1.1]">Rach Chat Agent</div>
          <div className="mt-[1px] flex items-center gap-[5px] text-[11px] text-ok"><span className="h-[5px] w-[5px] rounded-full bg-ok" /> Online</div>
        </div>
      </div>
      <div className="flex flex-col gap-2 px-[14px] py-[13px]">
        <div className="max-w-[82%] self-end rounded-[13px] rounded-br-[4px] bg-accent px-[11px] py-2 text-[12px] leading-[1.4] text-white">I need help tracking my order #4821</div>
        <div className="max-w-[82%] self-start rounded-[13px] rounded-bl-[4px] bg-[#F3F3F0] px-[11px] py-2 text-[12px] leading-[1.4] text-ink">Found it &mdash; shipped yesterday, arriving Friday.</div>
        <div className="max-w-[82%] self-end rounded-[13px] rounded-br-[4px] bg-accent px-[11px] py-2 text-[12px] leading-[1.4] text-white">Can I change the delivery address?</div>
      </div>
      <div className="mx-3 mb-3 mt-[2px] flex items-center justify-between rounded-[9px] border border-line-2 px-[11px] py-2 text-[11.5px] text-ink-3">
        <span>Type a message&hellip;</span><span className="text-accent">&#8593;</span>
      </div>
    </div>
  );

  const voiceAgent = (cls: string) => (
    <div className={`${cls} animate-pop rounded-[15px] border border-line bg-surface opacity-0 shadow-well motion-reduce:animate-none motion-reduce:opacity-100 max-[960px]:static max-[960px]:w-full max-[960px]:max-w-[420px]`}>
      <div className="flex items-center gap-[9px] border-b border-row px-[14px] py-3">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-accent-weak text-accent"><AudioLines className="h-[14px] w-[14px]" /></div>
        <div>
          <div className="text-[13px] font-semibold leading-[1.1]">Rach Voice Agent</div>
          <div className="mt-[1px] flex items-center gap-[5px] text-[11px] text-ok"><span className="h-[5px] w-[5px] rounded-full bg-ok motion-safe:animate-pulse2" /> On call &middot; 00:42</div>
        </div>
      </div>
      <div className="px-[14px] py-[14px]">
        {/* waveform */}
        <div className="flex h-9 items-center justify-center gap-[3px]">
          {wave.map((h, k) => (
            <i key={k} className="w-[3px] rounded-full bg-accent transition-[height] duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)]" style={{ height: `${h}%`, opacity: 0.55 + (h / 100) * 0.45 }} />
          ))}
        </div>
        <div className="mt-3 rounded-[11px] bg-[#F3F3F0] px-[11px] py-2 text-[12px] leading-[1.4] text-ink">
          &ldquo;Book me a table for two at 7pm tonight.&rdquo;
        </div>
        <div className="mt-1 text-right text-[10.5px] text-ink-3">Booking confirmed &check;</div>
      </div>
      <div className="mx-3 mb-3 flex items-center justify-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-accent-weak text-accent"><Mic className="h-[15px] w-[15px]" /></span>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-red-500 text-white"><PhoneOff className="h-[15px] w-[15px]" /></span>
      </div>
    </div>
  );

  const apiCalls = (cls: string) => (
    <div className={`${cls} animate-pop rounded-[15px] border border-line bg-surface px-[17px] py-4 opacity-0 shadow-well-sm motion-reduce:animate-none motion-reduce:opacity-100 max-[960px]:static max-[960px]:w-full max-[960px]:max-w-[420px]`}>
      <div className="font-mono text-[10px] uppercase tracking-[0.07em] text-ink-3">API calls</div>
      <div className="mt-[5px] font-display text-[32px] font-bold leading-none tracking-[-0.02em]">{apiVal.toLocaleString("en-US")}</div>
      <div className="mt-2 flex items-center gap-[5px] text-[11.5px] text-ok">&#8599; +12.3% <span className="text-ink-3">vs last week</span></div>
      <div className="mt-[13px] flex h-7 items-end gap-[3px]">
        {spark.map((h, k) => (
          <i key={k} className={`flex-1 rounded-[2px] transition-[height] duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${k === 6 ? "bg-accent" : "bg-accent-weak"}`} style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );

  return (
    <section className="pt-20 pb-[90px]">
      <div className="mx-auto grid max-w-site grid-cols-1 items-center gap-10 px-8 min-[960px]:grid-cols-[0.92fr_1.08fr]">
        {/* ---- Copy ---- */}
        <div>
          <span className="inline-flex animate-rise items-center gap-2 text-[12.5px] font-medium uppercase tracking-[0.05em] text-accent opacity-0 [animation-delay:0.05s] motion-reduce:animate-none motion-reduce:opacity-100">
            <Sparkles className="h-[14px] w-[14px]" /> {EYEBROW[variant]}
          </span>

          <h1 className="mt-6 font-display text-[clamp(38px,4.8vw,62px)] font-extrabold leading-[0.98] tracking-[-0.025em]">
            {showBackend && (
              <span className="block animate-rise opacity-0 [animation-delay:0.12s] motion-reduce:animate-none motion-reduce:opacity-100">
                Your backend,{" "}
                <span ref={rotateRef} className="block font-extrabold text-accent transition-[opacity,transform] duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)]">managed.</span>
              </span>
            )}
            {showAgent && (
              <span className="mt-[0.18em] block animate-rise opacity-0 [animation-delay:0.2s] motion-reduce:animate-none motion-reduce:opacity-100">
                Your agents,{" "}
                <span ref={rotate2Ref} className="block font-extrabold text-accent transition-[opacity,transform] duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)]">deployed.</span>
              </span>
            )}
          </h1>

          <p className="mt-6 max-w-[430px] animate-rise text-[17.5px] leading-[1.6] text-ink-2 opacity-0 [animation-delay:0.3s] motion-reduce:animate-none motion-reduce:opacity-100">
            {SUBTITLE[variant]}
          </p>

          <div className="mt-[34px] flex animate-rise flex-wrap gap-3 opacity-0 [animation-delay:0.4s] motion-reduce:animate-none motion-reduce:opacity-100">
            <StartBuildingButton label="Start building" />
            <HomeButton variant="ghost" href="/docs">&#9654; Watch demo</HomeButton>
          </div>
        </div>

        {/* ---- Stage ---- */}
        <div className="relative min-h-[600px] max-[960px]:flex max-[960px]:min-h-0 max-[960px]:flex-col max-[960px]:gap-4">
          {variant === "backend" && (
            <>
              {usersTable("absolute left-0 top-0 z-[1] w-[300px] [animation-delay:0.3s]")}
              {vmPool("absolute right-0 top-[168px] z-[2] w-[372px] [animation-delay:0.42s]")}
            </>
          )}

          {variant === "agent" && (
            <>
              {agentChat("absolute left-0 top-[40px] z-[4] w-[262px] [animation-delay:0.3s]")}
              {voiceAgent("absolute right-0 top-[92px] z-[3] w-[262px] [animation-delay:0.48s]")}
              {apiCalls("absolute left-[64px] top-[392px] z-[5] w-[216px] [animation-delay:0.62s]")}
            </>
          )}

          {variant === "full" && (
            <>
              {usersTable("absolute left-[54px] top-0 z-[1] w-[300px] [animation-delay:0.3s]")}
              {vmPool("absolute left-0 top-[132px] z-[2] w-[372px] [animation-delay:0.42s]")}
              {agentChat("absolute right-0 top-[54px] z-[4] w-[256px] [animation-delay:0.54s]")}
              {apiCalls("absolute left-[22px] top-[438px] z-[5] w-[216px] [animation-delay:0.66s]")}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function UserRow({ id, name, status, label, last }: { id: string; name: string; status: "ok" | "wait"; label: string; last?: boolean; }) {
  const pill = status === "ok" ? "bg-ok-bg text-ok before:bg-ok" : "bg-wait-bg text-wait before:bg-wait";
  return (
    <tr>
      <td className={`px-[15px] py-2 ${last ? "" : "border-b border-row"}`}>{id}</td>
      <td className={`px-[15px] py-2 ${last ? "" : "border-b border-row"}`}>{name}</td>
      <td className={`px-[15px] py-2 ${last ? "" : "border-b border-row"}`}>
        <span className={`inline-flex items-center gap-[5px] rounded-full px-2 py-[2px] font-body text-[10.5px] font-medium before:h-[5px] before:w-[5px] before:rounded-full before:content-[''] ${pill}`}>{label}</span>
      </td>
    </tr>
  );
}
