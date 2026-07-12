"use client";

import Image from "next/image";
import { SectionWrapper } from '../ui/SectionWrapper';
import { SectionHeader } from '../ui/SectionHeader';
import { GradientText } from '../ui/GradientText';
import { AnimateIn } from '../ui/AnimateIn';

const steps = [
  {
    number: "01",
    title: "Describe or Select",
    description:
      "Tell us what you need in plain English, or choose from our template library. We handle the configuration.",
    image: "/images/features/agent-templates.webp",
  },
  {
    number: "02",
    title: "Test in Sandbox",
    description:
      "Your agent runs on real infrastructure immediately. Test conversations, trace decisions, share with your team.",
    image: "/images/features/agent-sandbox.webp",
  },
  {
    number: "03",
    title: "Deploy with One Click",
    description:
      "Hit deploy. Your agent is live, monitored, and scaling. Need changes? Your developer team is one message away.",
    image: "/images/features/agent-deployed.webp",
  },
];

export function HowItWorks() {
  return (
    <SectionWrapper id="how-it-works" className="bg-bg-secondary">
      <SectionHeader
        eyebrow="STEP BY STEP"
        title="Go live in three steps"
      />

      <div className="grid gap-8 md:grid-cols-3">
        {steps.map((step, i) => (
          <AnimateIn key={i} delay={i * 0.15}>
            <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
              {/* Image area */}
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-slate-50 to-white">
                <Image
                  src={step.image}
                  alt={step.title}
                  fill
                  className="object-contain p-4 transition-transform duration-300 group-hover:scale-[1.03]"
                />
              </div>

              {/* Content */}
              <div className="flex flex-1 flex-col items-center px-6 pb-8 pt-6 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-200 bg-white shadow-sm">
                  <GradientText className="font-display text-xl font-bold">
                    {step.number}
                  </GradientText>
                </div>
                <h3 className="mb-3 font-display text-xl font-bold text-text-primary">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-text-secondary">
                  {step.description}
                </p>
              </div>
            </div>
          </AnimateIn>
        ))}
      </div>
    </SectionWrapper>
  );
}
