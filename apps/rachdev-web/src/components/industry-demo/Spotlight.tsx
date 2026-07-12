import { Check } from "lucide-react";
import { AnimateIn } from '@rach/ui/components/ui/AnimateIn';
import { ICONS } from "@/lib/industries/icons";
import type { IndustryConfig } from "@/lib/industries/types";

/**
 * Optional dark "spotlight" block. Renders only when `config.spotlight` is set
 * (e.g. a future Armed Forces vertical). Dormant for medical.
 */
export function Spotlight({ config }: { config: IndustryConfig }) {
  const s = config.spotlight;
  if (!s) return null;

  return (
    <section className="relative overflow-hidden border-y border-[#1a2f5a] bg-gradient-to-br from-[#04091a] via-[#071028] to-[#0c1840] py-20 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(700px 400px at 90% 0%, rgba(37,99,235,.18), transparent 60%), radial-gradient(600px 400px at 5% 100%, rgba(30,64,175,.14), transparent 60%)",
        }}
      />
      <div className="relative mx-auto max-w-site px-8">
        <div className="text-center">
          <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#93c5fd]">
            {s.eyebrow}
          </span>
          <h2 className="mx-auto mt-4 max-w-3xl font-display text-[clamp(28px,4vw,42px)] font-extrabold leading-[1.05] tracking-[-0.025em] text-[#e8eeff]">
            {s.title}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[16px] leading-relaxed text-[#7a8db8]">{s.intro}</p>
        </div>

        <div className="mt-8 grid overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] sm:grid-cols-3">
          {s.stats.map((st, i) => (
            <div
              key={st.label}
              className={i < s.stats.length - 1 ? "border-b border-white/10 px-6 py-5 text-center sm:border-b-0 sm:border-r" : "px-6 py-5 text-center"}
            >
              <div className="font-display text-[32px] font-extrabold leading-none text-[#60a5fa]">{st.value}</div>
              <div className="mt-1.5 text-[12.5px] font-medium text-[#7a8db8]">{st.label}</div>
            </div>
          ))}
        </div>

        <div
          className="mt-8 rounded-2xl border border-[#477EF7]/30 bg-[#1B53E5]/15 px-6 py-4 text-center text-[15px] font-medium text-[#c7d7f8]"
          dangerouslySetInnerHTML={{ __html: s.tagline }}
        />

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {s.cards.map((c, i) => {
            const Icon = ICONS[c.icon];
            return (
              <AnimateIn key={c.title} delay={(i % 2) * 0.08}>
                <div className="h-full rounded-2xl border border-[#477EF7]/25 bg-white/5 p-6 transition-colors hover:border-[#477EF7]/45">
                  <div className="flex items-start gap-3.5">
                    <span className="grid h-11 w-11 flex-none place-items-center rounded-xl border border-[#477EF7]/30 bg-[#1B53E5]/30">
                      <Icon className="h-[22px] w-[22px] text-[#7aadff]" strokeWidth={1.8} />
                    </span>
                    <div>
                      <b className="font-display text-[17px] font-bold text-[#e8eeff]">{c.title}</b>
                      <span className="mt-0.5 block text-[11px] font-bold uppercase tracking-[0.06em] text-[#4a7aff]">
                        {c.kicker}
                      </span>
                    </div>
                  </div>
                  <p className="mt-3.5 text-[13.8px] leading-relaxed text-[#7a8db8]">{c.body}</p>
                  <ul className="mt-3 flex flex-col gap-2">
                    {c.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2.5 text-[13px] text-[#94a3c0]">
                        <Check className="mt-0.5 h-[14px] w-[14px] flex-none text-[#60a5fa]" strokeWidth={2.2} />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </AnimateIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}
