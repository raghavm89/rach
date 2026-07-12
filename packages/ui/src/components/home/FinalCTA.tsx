'use client';

import { AnimateIn } from '../ui/AnimateIn';
import { HomeButton } from "./HomeButton";
import { StartBuildingButton } from '../ui/StartBuildingButton';

export function FinalCTA() {
  return (
    <section className="bg-band py-[90px] text-center">
      <div className="mx-auto max-w-site px-8">
        <AnimateIn>
          <h2 className="font-display text-[clamp(34px,4.5vw,56px)] font-extrabold leading-none tracking-[-0.025em]">
            Ready to build?
          </h2>
          <p className="mx-auto mt-[18px] max-w-[480px] text-[17px] text-ink-2">
            Get your backend running in under 90 seconds. No credit card required
            for sandbox access.
          </p>
          <div className="mt-[34px] flex flex-wrap justify-center gap-3">
            <StartBuildingButton useHomeButton label="Start building" />
            <HomeButton variant="ghost" href="/contact">Talk to our team</HomeButton>
          </div>
        </AnimateIn>
      </div>
    </section>
  );
}
