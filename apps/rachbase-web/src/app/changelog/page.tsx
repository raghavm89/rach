import type { Metadata } from "next";
import { SectionWrapper } from "@rach/ui/components/ui/SectionWrapper";
import { SectionHeader } from "@rach/ui/components/ui/SectionHeader";
import { AnimateIn } from "@rach/ui/components/ui/AnimateIn";
import { Badge } from "@rach/ui/components/ui/Badge";
import { GradientText } from "@rach/ui/components/ui/GradientText";
import { CTABanner } from "@rach/ui/components/sections/CTABanner";

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "See what's new at Rach Dev LLP. Platform updates, new features, and improvements.",
};

const launchItems = [
  "Managed PostgreSQL with pgvector support",
  "Email, OAuth, and magic link authentication",
  "Auto-generated REST and GraphQL APIs",
  "Object storage with CDN delivery",
  "60 AI agent templates across 15 industries",
  "Live sandbox with decision tracing",
  "One-click deployment",
  "Developer support portal",
];

export default function ChangelogPage() {
  return (
    <>
      {/* Hero */}
      <SectionWrapper>
        <SectionHeader
          eyebrow="CHANGELOG"
          title="What's new"
          subtitle="Platform updates, new features, and improvements."
        />
      </SectionWrapper>

      {/* Timeline */}
      <SectionWrapper>
        <div className="mx-auto max-w-3xl">
          <div className="relative border-l-2 border-accent/20 pl-8">
            {/* Timeline dot */}
            <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full border-2 border-accent bg-white" />

            <AnimateIn>
              <Badge className="mb-4">March 2026</Badge>

              <h3 className="font-display text-2xl font-bold text-ink md:text-3xl">
                v1.0 — Platform <GradientText>Launch</GradientText>
              </h3>

              <div className="mt-3">
                <Badge variant="accent">Major Release</Badge>
              </div>

              <ul className="mt-6 space-y-3">
                {launchItems.map((item, i) => (
                  <AnimateIn key={item} delay={i * 0.05}>
                    <li className="flex items-start gap-3 text-ink-2">
                      <span className="mt-1.5 block h-2 w-2 flex-shrink-0 rounded-full bg-accent/40" />
                      <span>{item}</span>
                    </li>
                  </AnimateIn>
                ))}
              </ul>
            </AnimateIn>
          </div>
        </div>
      </SectionWrapper>

      {/* CTA */}
      <CTABanner />
    </>
  );
}
