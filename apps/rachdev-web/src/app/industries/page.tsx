import type { Metadata } from "next";
import Image from "next/image";
import {
  ShoppingCart,
  Heart,
  Home,
  Scale,
  Landmark,
  GraduationCap,
  Hotel,
  Cloud,
  Users,
  Briefcase,
  Shield,
  Car,
  HeartHandshake,
  Dumbbell,
  UtensilsCrossed,
} from "lucide-react";
import { industries } from "@/data/industries";
import { templates } from "@/data/templates";
import { SectionWrapper } from '@rach/ui/components/ui/SectionWrapper';
import { SectionHeader } from '@rach/ui/components/ui/SectionHeader';
import { IndustryCard } from '@rach/ui/components/ui/IndustryCard';
import { AnimateIn } from '@rach/ui/components/ui/AnimateIn';
import { CTABanner } from '@rach/ui/components/sections/CTABanner';

export const metadata: Metadata = {
  title: "Industries",
  description:
    "Rach Dev LLP serves 15 industries with pre-built AI agent templates, compliance guardrails, and native integrations. Find the right agents for your industry.",
};

const iconMap: Record<string, React.ElementType> = {
  ShoppingCart,
  Heart,
  Home,
  Scale,
  Landmark,
  GraduationCap,
  Hotel,
  Cloud,
  Users,
  Briefcase,
  Shield,
  Car,
  HeartHandshake,
  Dumbbell,
  UtensilsCrossed,
};

export default function IndustriesPage() {
  return (
    <>
      <SectionWrapper>
        <SectionHeader
          eyebrow="Industries"
          title="Built for your industry"
          subtitle="Pre-built agent templates with industry-specific compliance, guardrails, and integrations across 15 industries — so you don't start from zero."
        />
        <AnimateIn>
          <div className="relative mx-auto aspect-[16/9] w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-band shadow-well-sm">
            <Image
              src="/illustrations/rach-illus-agent-hub.png"
              alt="A central AI agent hub connected to surrounding industry tools"
              fill
              className="object-contain p-6"
            />
          </div>
        </AnimateIn>
      </SectionWrapper>

      <SectionWrapper>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {industries.map((industry, i) => {
            const Icon = iconMap[industry.icon] || Briefcase;
            const templateCount = templates.filter(
              (t) => t.industrySlug === industry.slug
            ).length;

            return (
              <AnimateIn key={industry.id} delay={i * 0.05}>
                <IndustryCard
                  name={industry.name}
                  slug={industry.slug}
                  icon={Icon}
                  description={industry.description}
                  templateCount={templateCount}
                  image={industry.image}
                  hasDemo={Boolean(industry.agentDemoSlug)}
                />
              </AnimateIn>
            );
          })}
        </div>
      </SectionWrapper>

      <CTABanner />
    </>
  );
}
