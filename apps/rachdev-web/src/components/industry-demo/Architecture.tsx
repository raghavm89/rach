import { ArrowDown } from "lucide-react";
import { SectionWrapper } from '@rach/ui/components/ui/SectionWrapper';
import { SectionHeader } from '@rach/ui/components/ui/SectionHeader';
import { AnimateIn } from '@rach/ui/components/ui/AnimateIn';
import { ICONS } from "@/lib/industries/icons";
import type { ArchLayer, IndustryConfig } from "@/lib/industries/types";

export function Architecture({ config }: { config: IndustryConfig }) {
  return (
    <SectionWrapper id="architecture">
      <SectionHeader title={config.archTitle} subtitle={config.archIntro} />
      <div className="mx-auto max-w-3xl">
        <AnimateIn>
          <div className="rounded-3xl border border-line bg-surface p-6 shadow-well-sm sm:p-8">
            <div className="flex flex-col gap-3">
              {config.archLayers.map((layer, i) => (
                <div key={layer.title}>
                  <LayerRow layer={layer} />
                  {i < config.archLayers.length - 1 && (
                    <div className="flex justify-center py-1.5 text-ink-3">
                      <ArrowDown className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-line-2 bg-band px-5 py-4 text-center">
              <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
                {config.archBaseLabel}
              </div>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {config.archBaseSystems.map((s) => (
                  <span
                    key={s}
                    className="rounded-lg border border-line-2 bg-surface px-3 py-1.5 text-[12px] font-medium text-ink-2"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </AnimateIn>
      </div>
    </SectionWrapper>
  );
}

function LayerRow({ layer }: { layer: ArchLayer }) {
  const Icon = ICONS[layer.icon];
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 transition-all duration-200 hover:translate-x-1 hover:shadow-well-sm">
      <div className="flex items-center gap-3">
        <span className="rounded-md bg-accent px-2 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-white">
          {layer.n}
        </span>
        <b className="font-display text-[17px] font-bold text-ink">{layer.title}</b>
        <span className="ml-auto grid h-9 w-9 place-items-center rounded-lg bg-accent-weak">
          <Icon className="h-[18px] w-[18px] text-accent" strokeWidth={1.8} />
        </span>
      </div>
      <p className="mt-2.5 text-[13.8px] leading-relaxed text-ink-2">{layer.body}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {layer.pills.map((p) => (
          <span
            key={p}
            className="rounded-full border border-line bg-band px-2.5 py-1 text-[11.5px] font-medium text-ink-2"
          >
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}
