import { ShieldCheck } from "lucide-react";
import { SectionWrapper } from '@rach/ui/components/ui/SectionWrapper';
import { SectionHeader } from '@rach/ui/components/ui/SectionHeader';
import { AnimateIn } from '@rach/ui/components/ui/AnimateIn';
import { cn } from '@rach/ui/lib/utils';
import type { AuditLine, IndustryConfig } from "@/lib/industries/types";

const AUDIT_TAG: Record<AuditLine["tag"], string> = {
  ok: "bg-ok/15 text-[#7fe0a0]",
  mod: "bg-wait/20 text-[#ffd28a]",
  esc: "bg-[#ffb27f]/20 text-[#ffb27f]",
};

export function Governance({ config }: { config: IndustryConfig }) {
  return (
    <SectionWrapper band id="trust">
      <SectionHeader title={config.governanceTitle} subtitle={config.governanceIntro} />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* Guarantees */}
        <AnimateIn>
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-well-sm sm:p-7">
            {config.guarantees.map((g, i) => (
              <div
                key={g.title}
                className={cn(
                  "flex items-start gap-3 py-3.5",
                  i < config.guarantees.length - 1 && "border-b border-line",
                )}
              >
                <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-ok-bg">
                  <ShieldCheck className="h-[17px] w-[17px] text-ok" strokeWidth={2} />
                </span>
                <div>
                  <b className="block text-[14.5px] font-bold text-ink">{g.title}</b>
                  <span className="text-[13.5px] leading-relaxed text-ink-2">{g.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </AnimateIn>

        {/* Audit log (dark) */}
        <AnimateIn delay={0.1} direction="right">
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-well-sm sm:p-7">
            <h3 className="font-display text-[18px] font-bold text-ink">{config.auditTitle}</h3>
            <p className="mt-1 text-[13.5px] text-ink-2">{config.auditIntro}</p>
            <div className="mt-4 rounded-xl bg-surface-sidebar p-4 font-mono text-[12.5px] leading-relaxed text-dash-sidebar">
              {config.auditLines.map((a, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-3 py-[7px]",
                    i < config.auditLines.length - 1 && "border-b border-white/10",
                  )}
                >
                  <span className="flex-none tabular-nums text-[#7e86b8]">{a.ts}</span>
                  <span className="font-semibold text-white/90">{a.text}</span>
                  <span
                    className={cn(
                      "ml-auto flex-none rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em]",
                      AUDIT_TAG[a.tag],
                    )}
                  >
                    {a.tagLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </AnimateIn>
      </div>
    </SectionWrapper>
  );
}
