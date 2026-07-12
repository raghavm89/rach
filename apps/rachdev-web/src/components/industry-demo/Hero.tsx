import { Check } from "lucide-react";
import { Button } from '@rach/ui/components/ui/Button';
import { GradientText } from '@rach/ui/components/ui/GradientText';
import { ICONS } from "@/lib/industries/icons";
import type { IndustryConfig } from "@/lib/industries/types";
import { HeroRotor } from "./HeroRotor";

export function Hero({ config }: { config: IndustryConfig }) {
  const EyebrowIcon = ICONS.shield;
  return (
    <section className="relative overflow-hidden border-b border-line bg-page">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[-30%] -z-0 mx-auto h-[520px] max-w-3xl rounded-full bg-accent-weak/60 blur-3xl"
      />
      <div className="relative mx-auto max-w-site px-8 pt-16 pb-14 text-center lg:pt-24">
        <span className="inline-flex items-center gap-2 rounded-full border border-accent-line bg-accent-weak px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-accent">
          <EyebrowIcon className="h-[14px] w-[14px]" />
          {config.eyebrow}
        </span>

        <h1 className="mx-auto mt-6 max-w-[14ch] font-display text-[clamp(38px,6vw,64px)] font-extrabold leading-[1.02] tracking-[-0.025em] text-ink">
          {config.h1Lines[0]}
          {config.h1Lines[1] && (
            <>
              <br />
              <GradientText>{config.h1Lines[1]}</GradientText>
            </>
          )}
        </h1>

        <HeroRotor lead={config.rotorLead} words={config.rotorWords} />

        <p className="mx-auto mt-6 max-w-[680px] text-[clamp(16px,2.1vw,18.5px)] leading-relaxed text-ink-2">
          {config.subhead}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button variant="primary" size="lg" href={config.heroPrimaryCta.href}>
            {config.heroPrimaryCta.label}
          </Button>
          <Button variant="secondary" size="lg" href={config.heroSecondaryCta.href}>
            {config.heroSecondaryCta.label}
          </Button>
        </div>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 text-[13.5px] font-medium text-ink-2">
          {config.trustRow.map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-ok" strokeWidth={2.4} />
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
