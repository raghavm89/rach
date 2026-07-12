"use client";

import { AnimateIn } from '../ui/AnimateIn';
import { Button } from '../ui/Button';
import { StartBuildingButton } from '../ui/StartBuildingButton';

interface CTABannerProps {
  title?: string;
  subtitle?: string;
}

export function CTABanner({
  title = "Ready to build?",
  subtitle = "Get your backend running in under 90 seconds.",
}: CTABannerProps) {
  return (
    <section className="bg-band py-24 text-center lg:py-28">
      <div className="mx-auto max-w-site px-8">
        <AnimateIn>
          <h2 className="font-display text-[clamp(34px,4.5vw,56px)] font-extrabold leading-none tracking-[-0.025em] text-ink">
            {title}
          </h2>
          <p className="mx-auto mt-[18px] max-w-[480px] text-[17px] text-ink-2">
            {subtitle}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <StartBuildingButton size="lg" variant="primary" />
            <Button variant="secondary" size="lg" href="/contact">
              Talk to Our Team
            </Button>
          </div>
        </AnimateIn>
      </div>
    </section>
  );
}
