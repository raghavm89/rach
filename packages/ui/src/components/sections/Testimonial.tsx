"use client";

import { SectionWrapper } from '../ui/SectionWrapper';
import { AnimateIn } from '../ui/AnimateIn';
import { GradientText } from '../ui/GradientText';

export function Testimonial() {
  return (
    <SectionWrapper dark>
      <AnimateIn>
        <div className="mx-auto max-w-3xl text-center">
          <GradientText className="mb-8 text-6xl font-bold leading-none">
            &ldquo;
          </GradientText>
          <blockquote className="text-xl font-medium leading-relaxed text-text-on-dark/90 md:text-2xl">
            We built Rach Dev LLP because every founder we worked with asked the same
            question: why is backend infrastructure so hard? It shouldn&apos;t be.
            And now it isn&apos;t.
          </blockquote>
          <div className="mt-8">
            <p className="font-display font-semibold text-text-on-dark">
              — Eshan & Raghav
            </p>
            <p className="mt-1 text-sm text-text-muted">Co-Founders, Rach Dev LLP</p>
          </div>
        </div>
      </AnimateIn>
    </SectionWrapper>
  );
}
