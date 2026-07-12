"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, MessageSquare, TriangleAlert, User } from "lucide-react";
import { SectionWrapper } from '@rach/ui/components/ui/SectionWrapper';
import { SectionHeader } from '@rach/ui/components/ui/SectionHeader';
import { cn } from '@rach/ui/lib/utils';
import { ICONS } from "@/lib/industries/icons";
import type { IndustryConfig } from "@/lib/industries/types";

type Phase = "idle" | "typing" | "answered";

export function KnowledgeDemo({ config }: { config: IndustryConfig }) {
  const [active, setActive] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const timers = useRef<number[]>([]);
  const KnowIcon = ICONS.knowledge;

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const ask = (i: number) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setActive(i);
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setPhase("answered");
      return;
    }
    setPhase("typing");
    timers.current.push(window.setTimeout(() => setPhase("answered"), 650));
  };

  const qa = active !== null ? config.knowledge[active] : null;

  return (
    <SectionWrapper id="knowledge">
      <SectionHeader title={config.knowledgeTitle} subtitle={config.knowledgeIntro} />

      <div className="grid items-center gap-8 lg:grid-cols-2">
        {/* Questions */}
        <div>
          <p className="mb-4 text-[13px] font-bold uppercase tracking-[0.05em] text-ink-3">
            Try a question
          </p>
          <div className="flex flex-col gap-2.5">
            {config.knowledge.map((k, i) => (
              <button
                key={k.q}
                type="button"
                onClick={() => ask(i)}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border px-4 py-3 text-left text-[13.5px] font-semibold transition-all",
                  active === i
                    ? "border-transparent bg-accent text-white"
                    : "border-accent-line bg-accent-weak text-accent hover:translate-x-0.5",
                )}
              >
                <MessageSquare className="h-4 w-4 flex-none" />
                {k.q}
              </button>
            ))}
          </div>
        </div>

        {/* Chat */}
        <div className="flex min-h-[320px] flex-col gap-3 rounded-2xl border border-line bg-surface p-5 shadow-well-sm">
          <div className="flex items-center gap-3 border-b border-line pb-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-primary-blue to-accent">
              <KnowIcon className="h-[18px] w-[18px] text-white" />
            </span>
            <div>
              <b className="block text-[14px] font-bold text-ink">{config.knowledgeAgentName}</b>
              <span className="text-[12px] text-ink-3">{config.knowledgeViewLabel}</span>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-3">
            {!qa && (
              <div className="flex gap-2.5">
                <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-accent-weak">
                  <KnowIcon className="h-[15px] w-[15px] text-accent" />
                </span>
                <p className="max-w-[86%] rounded-2xl rounded-bl-sm border border-line bg-band px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink">
                  {config.knowledgeGreeting}
                </p>
              </div>
            )}

            {qa && (
              <>
                <div className="flex flex-row-reverse gap-2.5">
                  <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-row">
                    <User className="h-[14px] w-[14px] text-ink-3" />
                  </span>
                  <p className="max-w-[86%] rounded-2xl rounded-br-sm bg-accent px-3.5 py-2.5 text-[13.5px] leading-relaxed text-white">
                    {qa.q}
                  </p>
                </div>

                <div className="flex gap-2.5">
                  <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-accent-weak">
                    <KnowIcon className="h-[15px] w-[15px] text-accent" />
                  </span>
                  <div className="max-w-[86%]">
                    {phase === "typing" ? (
                      <p className="inline-flex items-center gap-2 rounded-2xl rounded-bl-sm border border-line bg-band px-3.5 py-2.5 text-[13.5px] text-ink-3">
                        <Loader2 className="h-4 w-4 animate-spin" /> {config.knowledgeAgentName} is typing…
                      </p>
                    ) : (
                      <>
                        <p className="rounded-2xl rounded-bl-sm border border-line bg-band px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink">
                          {qa.a}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {qa.src.map((s) => (
                            <span
                              key={s}
                              className="inline-flex items-center gap-1.5 rounded-md border border-line-2 bg-surface px-2 py-0.5 text-[10.5px] font-bold text-ink-2"
                            >
                              <Check className="h-[11px] w-[11px] text-ok" strokeWidth={2.6} />
                              {s}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="mt-auto flex items-start gap-2 rounded-xl border border-wait-line bg-wait-bg px-3 py-2.5 text-[11.5px] leading-snug text-wait">
            <TriangleAlert className="mt-0.5 h-[14px] w-[14px] flex-none" />
            {config.knowledgeDisclaimer}
          </div>
        </div>
      </div>

      {/* Crawlable Q&A (AEO/GEO — answers in the DOM, not only behind interaction) */}
      <div className="sr-only">
        <h3>{config.knowledgeTitle} — questions and answers</h3>
        <dl>
          {config.knowledge.map((k) => (
            <div key={k.q}>
              <dt>{k.q}</dt>
              <dd>{k.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </SectionWrapper>
  );
}
