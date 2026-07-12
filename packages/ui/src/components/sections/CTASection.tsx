"use client";

import { AnimateIn } from '../ui/AnimateIn';
import { Button } from '../ui/Button';
import { StartBuildingButton } from '../ui/StartBuildingButton';

export function CTASection() {
  return (
    <section
      id="cta"
      className="relative overflow-hidden py-24 lg:py-32"
    >
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-blue/5 via-primary-purple/5 to-accent-cyan/5" />

      <div className="relative mx-auto max-w-[1200px] px-6 text-center">
        <AnimateIn>
          <h2 className="font-display text-4xl font-bold tracking-tight text-text-primary md:text-5xl">
            Ready to build?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-text-secondary">
            Get your backend running in under 90 seconds. No credit card required
            for sandbox access.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <StartBuildingButton size="lg" variant="primary" />
            <Button variant="secondary" size="lg">
              Talk to Our Team
            </Button>
          </div>
        </AnimateIn>
      </div>
    </section>
  );
}
