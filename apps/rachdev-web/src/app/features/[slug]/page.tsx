import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
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
  Check,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionWrapper } from '@rach/ui/components/ui/SectionWrapper';
import { AnimateIn } from '@rach/ui/components/ui/AnimateIn';
import { Badge } from '@rach/ui/components/ui/Badge';
import { Breadcrumb } from '@rach/ui/components/ui/Breadcrumb';
import { FeatureDetailCard } from '@rach/ui/components/ui/FeatureDetailCard';
import { CTABanner } from '@rach/ui/components/sections/CTABanner';
import { features } from "@/data/features";

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

interface FeaturePageProps {
  params: { slug: string };
}

export async function generateStaticParams() {
  return features.map((feature) => ({
    slug: feature.slug,
  }));
}

export async function generateMetadata({
  params,
}: FeaturePageProps): Promise<Metadata> {
  const { slug } = params;
  const feature = features.find((f) => f.slug === slug);

  if (!feature) {
    return { title: "Feature Not Found" };
  }

  return {
    title: feature.name,
    description: feature.shortDescription,
  };
}

export default async function FeatureDetailPage({ params }: FeaturePageProps) {
  const { slug } = params;
  const feature = features.find((f) => f.slug === slug);

  if (!feature) {
    notFound();
  }

  const relatedFeatures = features.filter((f) =>
    feature.relatedFeatures.includes(f.slug)
  );

  // Split fullDescription into paragraphs
  const paragraphs = feature.fullDescription
    .split("\n\n")
    .filter((p) => p.trim());

  return (
    <>
      {/* Breadcrumb */}
      <SectionWrapper className="pb-0 lg:pb-0">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Features", href: "/features" },
            { label: feature.name },
          ]}
        />
      </SectionWrapper>

      {/* Hero */}
      <SectionWrapper>
        <div className="grid items-center gap-10 md:grid-cols-2">
          <AnimateIn>
            <Badge className="mb-4">
              {categoryLabels[feature.category]}
            </Badge>
            <h1 className="font-display text-4xl font-extrabold tracking-[-0.025em] text-ink md:text-5xl lg:text-6xl">
              {feature.name}
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-ink-2">
              {feature.shortDescription}
            </p>
          </AnimateIn>
          {feature.image && (
            <AnimateIn delay={0.2} direction="right">
              <div className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-2xl border border-line bg-band shadow-well-sm">
                <Image
                  src={feature.image}
                  alt={feature.name}
                  fill
                  className="object-contain p-6"
                  priority
                />
              </div>
            </AnimateIn>
          )}
        </div>
      </SectionWrapper>

      {/* Full Description + Benefits */}
      <SectionWrapper>
        <div className="mx-auto max-w-3xl">
          <AnimateIn>
            <div className="space-y-5 text-base leading-relaxed text-ink-2">
              {paragraphs.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </AnimateIn>

          {/* Benefits */}
          <AnimateIn delay={0.15}>
            <div className="mt-12">
              <h2 className="font-display text-2xl font-bold text-ink">
                Key Benefits
              </h2>
              <ul className="mt-6 space-y-4">
                {feature.benefits.map((benefit, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-ok" />
                    <span className="text-sm leading-relaxed text-ink-2">
                      {benefit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </AnimateIn>
        </div>
      </SectionWrapper>

      {/* Related Features */}
      {relatedFeatures.length > 0 && (
        <SectionWrapper band>
          <AnimateIn>
            <h2 className="mb-8 font-display text-2xl font-bold text-ink">
              Related Features
            </h2>
          </AnimateIn>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {relatedFeatures.map((related, i) => {
              const Icon = iconMap[related.icon] || Database;
              return (
                <AnimateIn key={related.id} delay={i * 0.08}>
                  <FeatureDetailCard
                    name={related.name}
                    slug={related.slug}
                    icon={Icon}
                    shortDescription={related.shortDescription}
                    category={categoryLabels[related.category]}
                    image={related.image}
                  />
                </AnimateIn>
              );
            })}
          </div>
        </SectionWrapper>
      )}

      {/* CTA */}
      <CTABanner />
    </>
  );
}
