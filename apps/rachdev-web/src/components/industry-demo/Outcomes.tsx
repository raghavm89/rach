import { BarChart3, Info } from "lucide-react";
import { SectionWrapper } from '@rach/ui/components/ui/SectionWrapper';
import { SectionHeader } from '@rach/ui/components/ui/SectionHeader';
import { Card } from '@rach/ui/components/ui/Card';
import { AnimateIn } from '@rach/ui/components/ui/AnimateIn';
import type { IndustryConfig } from "@/lib/industries/types";

export function Outcomes({ config }: { config: IndustryConfig }) {
  return (
    <SectionWrapper id="outcomes">
      <SectionHeader title={config.outcomesTitle} subtitle={config.outcomesIntro} />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {config.outcomes.map((o, i) => (
          <AnimateIn key={o.label} delay={(i % 4) * 0.06}>
            <Card className="h-full">
              <div className="font-display text-[30px] font-extrabold leading-none text-ink">{o.value}</div>
              <div className="mt-2.5 text-[13.5px] font-bold text-ink">{o.label}</div>
              <div className="mt-1.5 text-[12.5px] leading-relaxed text-ink-3">{o.desc}</div>
            </Card>
          </AnimateIn>
        ))}
      </div>

      <AnimateIn delay={0.1}>
        <div className="mt-6 rounded-2xl border border-line bg-band px-6 py-5">
          <h4 className="flex items-center gap-2 font-display text-[14px] font-bold text-ink">
            <BarChart3 className="h-4 w-4 text-accent" /> The problem, in numbers
          </h4>
          <ul className="mt-3 flex flex-col gap-2.5">
            {config.benchmarks.map((b) => (
              <li key={b.cite} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-ink">
                <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                <span>
                  {b.text} <span className="font-medium text-ink-3">— {b.cite}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </AnimateIn>

      <p className="mx-auto mt-5 flex max-w-3xl items-start gap-2 text-[12.5px] leading-relaxed text-ink-3">
        <Info className="mt-0.5 h-3.5 w-3.5 flex-none" />
        {config.outcomesNote}
      </p>
    </SectionWrapper>
  );
}
