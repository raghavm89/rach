import { Check } from "lucide-react";
import { SectionWrapper } from '@rach/ui/components/ui/SectionWrapper';
import { SectionHeader } from '@rach/ui/components/ui/SectionHeader';
import { Card } from '@rach/ui/components/ui/Card';
import { AnimateIn } from '@rach/ui/components/ui/AnimateIn';
import { ICONS } from "@/lib/industries/icons";
import type { DomainCard, IndustryConfig } from "@/lib/industries/types";
import { StatusPill } from "./StatusPill";

export function OperatingPicture({ config }: { config: IndustryConfig }) {
  return (
    <SectionWrapper band id="operate">
      <SectionHeader
        eyebrow={config.operateEyebrow}
        title={config.operateTitle}
        subtitle={config.operateIntro}
      />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {config.domains.map((d, i) => (
          <AnimateIn key={d.title} delay={(i % 4) * 0.06}>
            <DomainTile domain={d} />
          </AnimateIn>
        ))}
      </div>
    </SectionWrapper>
  );
}

function DomainTile({ domain }: { domain: DomainCard }) {
  const Icon = ICONS[domain.icon];
  return (
    <Card className="flex h-full flex-col">
      <StatusPill tone={domain.tag.tone} dot className="absolute right-4 top-4">
        {domain.tag.label}
      </StatusPill>
      <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-accent-weak">
        <Icon className="h-[22px] w-[22px] text-accent" strokeWidth={1.8} />
      </div>
      <h3 className="font-display text-[17px] font-bold text-ink">{domain.title}</h3>
      <p className="mt-2 text-[13.8px] leading-relaxed text-ink-2">{domain.blurb}</p>
      <ul className="mt-4 flex flex-col gap-2">
        {domain.bullets.map((b) => (
          <li key={b} className="flex items-start gap-2 text-[13px] leading-snug text-ink">
            <Check className="mt-0.5 h-[14px] w-[14px] flex-none text-accent" strokeWidth={2.4} />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
