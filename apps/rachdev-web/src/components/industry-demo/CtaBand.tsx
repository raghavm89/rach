import { Button } from '@rach/ui/components/ui/Button';
import { StartBuildingButton } from '@rach/ui/components/ui/StartBuildingButton';
import { AnimateIn } from '@rach/ui/components/ui/AnimateIn';
import type { IndustryConfig } from "@/lib/industries/types";

export function CtaBand({ config }: { config: IndustryConfig }) {
  return (
    <section id="cta" className="bg-page py-20 lg:py-28">
      <div className="mx-auto max-w-site px-8">
        <AnimateIn>
          <div className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-[#0A0B0E] via-[#0C1430] to-[#0F1C42] px-7 py-12 text-white sm:px-12 sm:py-14">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-70"
              style={{
                background:
                  "radial-gradient(500px 300px at 85% 10%, rgba(37,99,235,.42), transparent 60%), radial-gradient(460px 320px at 8% 100%, rgba(37,99,235,.30), transparent 60%)",
              }}
            />
            <div className="relative">
              <h2 className="max-w-[640px] font-display text-[clamp(28px,4vw,42px)] font-extrabold leading-[1.05] tracking-[-0.025em]">
                {config.ctaTitle}
              </h2>
              <p className="mt-4 max-w-[600px] text-[17px] leading-relaxed text-white/70">
                {config.ctaIntro}
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {config.ctaSteps.map((s) => (
                  <div
                    key={s.n}
                    className="rounded-2xl border border-white/10 bg-white/5 p-5"
                  >
                    <div className="font-display text-[13px] font-extrabold text-[#8fa6ff]">{s.n}</div>
                    <b className="mt-2 block text-[16px] font-bold">{s.title}</b>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/65">{s.desc}</p>
                  </div>
                ))}
              </div>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Button variant="primary" size="lg" href="/contact">
                  Book a pilot
                </Button>
                <StartBuildingButton
                  variant="secondary"
                  size="lg"
                  arrow
                  label="Customize this agent →"
                  className="border-white/30 bg-white/10 text-white hover:border-white/60 hover:bg-white/15"
                />
              </div>
            </div>
          </div>
        </AnimateIn>
      </div>
    </section>
  );
}
