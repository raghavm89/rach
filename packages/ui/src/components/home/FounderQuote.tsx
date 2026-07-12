import { AnimateIn } from '../ui/AnimateIn';

export function FounderQuote() {
  return (
    <section className="py-24 text-center">
      <div className="mx-auto max-w-site px-8">
        <AnimateIn>
          <blockquote className="mx-auto max-w-[860px] font-display text-[clamp(24px,3vw,36px)] font-semibold leading-[1.3] tracking-[-0.02em] text-ink">
            &ldquo;We built Rach Dev LLP because every founder we worked with asked the
            same question: why is backend infrastructure so hard? It shouldn&rsquo;t
            be. And now it isn&rsquo;t.&rdquo;
          </blockquote>
          <div className="mt-[26px] font-semibold text-accent">Eshan &amp; Raghav</div>
          <div className="mt-[3px] text-[14px] text-ink-3">Co-Founders, Rach Dev LLP</div>
        </AnimateIn>
      </div>
    </section>
  );
}
