import type { Metadata } from "next";
import Image from "next/image";
import {
  Database,
  ShieldCheck,
  Zap,
  HardDrive,
  Radio,
  RotateCcw,
  Network,
  Lock,
  LayoutTemplate,
  MessageSquare,
  FlaskConical,
  Rocket,
  UserCheck,
  Server,
  Headphones,
  BarChart3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionWrapper } from '@rach/ui/components/ui/SectionWrapper';
import { SectionHeader } from '@rach/ui/components/ui/SectionHeader';
import { AnimateIn } from '@rach/ui/components/ui/AnimateIn';
import { FeatureDetailCard } from '@rach/ui/components/ui/FeatureDetailCard';
import { CTABanner } from '@rach/ui/components/sections/CTABanner';
import { features } from "@/data/features";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Explore every feature of the Rach Dev LLP platform. Managed PostgreSQL, authentication, auto-generated APIs, AI agent templates, sandbox testing, one-click deploy, and more.",
};

const iconMap: Record<string, LucideIcon> = {
  Database,
  ShieldCheck,
  Zap,
  HardDrive,
  Radio,
  RotateCcw,
  Network,
  Lock,
  LayoutTemplate,
  MessageSquare,
  FlaskConical,
  Rocket,
  UserCheck,
  Server,
  Headphones,
  BarChart3,
};

const categoryLabels: Record<string, string> = {
  baas: "Backend as a Service",
  agents: "AI Agent Builder",
  platform: "Platform",
};

const categoryOrder: Array<"baas" | "agents" | "platform"> = [
  "baas",
  "agents",
  "platform",
];

export default function FeaturesPage() {
  return (
    <>
      {/* Hero */}
      <SectionWrapper>
        <SectionHeader
          eyebrow="Platform Features"
          title="Everything you need to ship"
          subtitle="From managed databases to AI agent deployment. Every feature is built to reduce your time-to-production."
        />
        <AnimateIn>
          <div className="relative mx-auto aspect-[16/9] w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-band shadow-well-sm">
            <Image
              src="/illustrations/pages/features-overview.png"
              alt="Rach Dev LLP platform modules — database, authentication, storage, APIs, and an agent node — connected into one system"
              fill
              className="object-contain p-6"
            />
          </div>
        </AnimateIn>
      </SectionWrapper>

      {/* Features grouped by category */}
      {categoryOrder.map((category, ci) => {
        const categoryFeatures = features.filter(
          (f) => f.category === category
        );

        return (
          <SectionWrapper key={category} band={ci % 2 === 1}>
            <AnimateIn>
              <h3 className="mb-8 font-display text-2xl font-bold tracking-[-0.01em] text-ink">
                {categoryLabels[category]}
              </h3>
            </AnimateIn>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {categoryFeatures.map((feature, i) => {
                const Icon = iconMap[feature.icon] || Database;
                return (
                  <AnimateIn key={feature.id} delay={i * 0.06}>
                    <FeatureDetailCard
                      name={feature.name}
                      slug={feature.slug}
                      icon={Icon}
                      shortDescription={feature.shortDescription}
                      category={categoryLabels[feature.category]}
                      image={feature.image}
                    />
                  </AnimateIn>
                );
              })}
            </div>
          </SectionWrapper>
        );
      })}

      {/* CTA */}
      <CTABanner />
    </>
  );
}
