import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowRight, PlayCircle, ShieldCheck } from "lucide-react";
import { industries } from "@/data/industries";
import { templates } from "@/data/templates";
import { SectionWrapper } from '@rach/ui/components/ui/SectionWrapper';
import { SectionHeader } from '@rach/ui/components/ui/SectionHeader';
import { Breadcrumb } from '@rach/ui/components/ui/Breadcrumb';
import { TemplateCard } from '@rach/ui/components/ui/TemplateCard';
import { AnimateIn } from '@rach/ui/components/ui/AnimateIn';
import { CTABanner } from '@rach/ui/components/sections/CTABanner';

interface IndustryPageProps {
  params: { slug: string };
}

export function generateStaticParams() {
  return industries.map((industry) => ({ slug: industry.slug }));
}

export function generateMetadata({ params }: IndustryPageProps): Metadata {
  const industry = industries.find((i) => i.slug === params.slug);
  if (!industry) return {};

  return {
    title: `${industry.name} AI Agents`,
    description: `AI agent templates for ${industry.name}. Pre-built with industry-specific compliance, guardrails, and integrations. Deploy in under 90 seconds.`,
  };
}

export default function IndustryPage({ params }: IndustryPageProps) {
  const industry = industries.find((i) => i.slug === params.slug);

  if (!industry) {
    notFound();
  }

  const industryTemplates = templates.filter(
    (t) => t.industrySlug === industry.slug
  );

  const descriptionParagraphs = industry.description.split("\n\n");

  return (
    <>
      {/* Breadcrumb */}
      <SectionWrapper className="pb-0 pt-8 lg:pb-0 lg:pt-8">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Industries", href: "/industries" },
            { label: industry.name },
          ]}
        />
      </SectionWrapper>

      {/* Hero / Description */}
      <SectionWrapper>
        <div className="grid items-center gap-10 md:grid-cols-2">
          <AnimateIn>
            <h1 className="font-display text-3xl font-extrabold tracking-[-0.025em] text-ink md:text-4xl lg:text-5xl">
              {industry.name}
            </h1>
          </AnimateIn>
          {industry.image && (
            <AnimateIn delay={0.2} direction="right">
              <div className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-2xl border border-line bg-band shadow-well-sm">
                <Image
                  src={industry.image}
                  alt={`${industry.name} AI agents`}
                  fill
                  className="object-contain p-6"
                  priority
                />
              </div>
            </AnimateIn>
          )}
        </div>
        <div className="mt-8 max-w-3xl space-y-6">
          {descriptionParagraphs.map((paragraph, i) => (
            <AnimateIn key={i} delay={0.1 * (i + 1)}>
              <p className="text-lg leading-relaxed text-ink-2">
                {paragraph}
              </p>
            </AnimateIn>
          ))}
        </div>

        {/* Live agent demo interlink */}
        {industry.agentDemoSlug && (
          <AnimateIn delay={0.2}>
            <Link
              href={`/agents/${industry.agentDemoSlug}`}
              className="group mt-10 flex flex-col items-start gap-4 rounded-2xl border border-accent-line bg-accent-weak p-6 transition-all hover:-translate-y-0.5 hover:shadow-well sm:flex-row sm:items-center"
            >
              <span className="grid h-12 w-12 flex-none place-items-center rounded-xl bg-accent text-white">
                <PlayCircle className="h-6 w-6" />
              </span>
              <div className="flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-accent">
                  Interactive demo
                </p>
                <h3 className="mt-1 font-display text-lg font-bold text-ink">
                  See the {industry.name} agents run a real case, end to end
                </h3>
                <p className="mt-1 text-[14px] text-ink-2">
                  Watch intake, triage, documentation, coding and ICU monitoring hand off live — a clinician
                  approves every clinical action.
                </p>
              </div>
              <span className="inline-flex flex-none items-center gap-1.5 font-semibold text-accent">
                Try the live demo
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </AnimateIn>
        )}
      </SectionWrapper>

      {/* Pain Points */}
      <SectionWrapper band>
        <AnimateIn>
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">
            Common Pain Points
          </h2>
        </AnimateIn>
        <ul className="mt-8 space-y-4">
          {industry.painPoints.map((point, i) => (
            <AnimateIn key={i} delay={i * 0.05}>
              <li className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent" />
                <span className="text-ink-2">{point}</span>
              </li>
            </AnimateIn>
          ))}
        </ul>
      </SectionWrapper>

      {/* Compliance & Regulations */}
      <SectionWrapper>
        <AnimateIn>
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">
            Compliance &amp; Regulations
          </h2>
        </AnimateIn>
        <ul className="mt-8 space-y-4">
          {industry.complianceNotes.map((note, i) => (
            <AnimateIn key={i} delay={i * 0.05}>
              <li className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-ok" />
                <span className="text-ink-2">{note}</span>
              </li>
            </AnimateIn>
          ))}
        </ul>
      </SectionWrapper>

      {/* Agent Templates */}
      {industryTemplates.length > 0 && (
        <SectionWrapper band>
          <SectionHeader
            title={`Agent Templates for ${industry.name}`}
            centered={false}
          />
          <div className="grid gap-6 sm:grid-cols-2">
            {industryTemplates.map((template, i) => (
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
      )}

      <CTABanner />
    </>
  );
}
