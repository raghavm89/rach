import type { Metadata } from "next";
import Image from "next/image";
import { industries } from "@/data/industries";
import { templates } from "@/data/templates";
import { SectionWrapper } from '@rach/ui/components/ui/SectionWrapper';
import { SectionHeader } from '@rach/ui/components/ui/SectionHeader';
import { TemplateCard } from '@rach/ui/components/ui/TemplateCard';
import { AnimateIn } from '@rach/ui/components/ui/AnimateIn';
import { CTABanner } from '@rach/ui/components/sections/CTABanner';

export const metadata: Metadata = {
  title: "Templates",
  description:
    "Browse 60 production-ready AI agent templates across 15 industries. Each template includes compliance guardrails, integrations, and configurable fields. Deploy in under 90 seconds.",
};

export default function TemplatesPage() {
  // Group templates by industry
  const grouped = industries
    .map((industry) => ({
      industry,
      templates: templates.filter((t) => t.industrySlug === industry.slug),
    }))
    .filter((group) => group.templates.length > 0);

  return (
    <>
      <SectionWrapper>
        <SectionHeader
          eyebrow="Template Library"
          title="60 agent templates, ready to deploy"
          subtitle="Production-ready AI agents with industry-specific compliance, guardrails, and integrations. Pick a template, configure it, and launch."
        />
        <AnimateIn>
          <div className="relative mx-auto aspect-[16/9] w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-band shadow-well-sm">
            <Image
              src="/illustrations/pages/templates-library.png"
              alt="A grid of agent templates with one template lifted out of the grid"
              fill
              className="object-contain p-6"
            />
          </div>
        </AnimateIn>
      </SectionWrapper>

      {grouped.map((group, groupIndex) => (
        <SectionWrapper key={group.industry.slug} band={groupIndex % 2 === 1}>
          <AnimateIn>
            <h3 className="mb-8 font-display text-2xl font-bold tracking-[-0.015em] text-ink md:text-3xl">
              {group.industry.name}
            </h3>
          </AnimateIn>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {group.templates.map((template, i) => (
              <AnimateIn key={template.id} delay={i * 0.05}>
                <TemplateCard
                  name={template.name}
                  slug={template.slug}
                  industry={template.industry}
                  industrySlug={template.industrySlug}
                  description={template.description}
                  capabilities={template.capabilities}
                />
              </AnimateIn>
            ))}
          </div>
        </SectionWrapper>
      ))}

      <CTABanner />
    </>
  );
}
