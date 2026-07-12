import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check, Shield, Settings, Plug } from "lucide-react";
import { templates } from "@/data/templates";
import { industries } from "@/data/industries";
import { SectionWrapper } from '@rach/ui/components/ui/SectionWrapper';
import { Breadcrumb } from '@rach/ui/components/ui/Breadcrumb';
import { Badge } from '@rach/ui/components/ui/Badge';
import { TemplateCard } from '@rach/ui/components/ui/TemplateCard';
import { AnimateIn } from '@rach/ui/components/ui/AnimateIn';
import { Card } from '@rach/ui/components/ui/Card';
import { CTABanner } from '@rach/ui/components/sections/CTABanner';

interface TemplatePageProps {
  params: { industry: string; slug: string };
}

export function generateStaticParams() {
  return templates.map((t) => ({
    industry: t.industrySlug,
    slug: t.slug,
  }));
}

export function generateMetadata({ params }: TemplatePageProps): Metadata {
  const template = templates.find(
    (t) => t.industrySlug === params.industry && t.slug === params.slug
  );
  if (!template) return {};

  return {
    title: `${template.name} — ${template.industry}`,
    description: template.description,
  };
}

export default function TemplatePage({ params }: TemplatePageProps) {
  const template = templates.find(
    (t) => t.industrySlug === params.industry && t.slug === params.slug
  );

  if (!template) {
    notFound();
  }

  const industry = industries.find((i) => i.slug === template.industrySlug);

  const relatedTemplates = templates.filter(
    (t) => t.industrySlug === template.industrySlug && t.id !== template.id
  );

  return (
    <>
      {/* Breadcrumb */}
      <SectionWrapper className="pb-0 pt-8 lg:pb-0 lg:pt-8">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Templates", href: "/templates" },
            {
              label: industry?.name || template.industry,
              href: `/industries/${template.industrySlug}`,
            },
            { label: template.name },
          ]}
        />
      </SectionWrapper>

      {/* Hero */}
      <SectionWrapper>
        <AnimateIn>
          <Badge variant="accent" className="mb-4">
            {template.industry}
          </Badge>
          <h1 className="font-display text-3xl font-extrabold tracking-[-0.025em] text-ink md:text-4xl lg:text-5xl">
            {template.name}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-ink-2">
            {template.description}
          </p>
        </AnimateIn>
      </SectionWrapper>

      {/* Details — Two Column */}
      <SectionWrapper>
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left: Capabilities */}
          <AnimateIn>
            <Card hoverLift={false} className="h-full">
              <div className="mb-4 flex items-center gap-2">
                <Check className="h-5 w-5 text-accent" />
                <h3 className="font-display text-xl font-bold text-ink">
                  Capabilities
                </h3>
              </div>
              <ul className="space-y-3">
                {template.capabilities.map((cap, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-ok" />
                    <span className="text-sm leading-relaxed text-ink-2">
                      {cap}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </AnimateIn>

          {/* Right: Integrations, Guardrails, Configurable Fields */}
          <div className="space-y-6">
            {/* Integrations */}
            <AnimateIn delay={0.1}>
              <Card hoverLift={false}>
                <div className="mb-4 flex items-center gap-2">
                  <Plug className="h-5 w-5 text-accent" />
                  <h3 className="font-display text-xl font-bold text-ink">
                    Integrations
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {template.integrations.map((integration, i) => (
                    <Badge key={i} className="text-xs">
                      {integration}
                    </Badge>
                  ))}
                </div>
              </Card>
            </AnimateIn>

            {/* Guardrails */}
            <AnimateIn delay={0.15}>
              <Card hoverLift={false}>
                <div className="mb-4 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-accent" />
                  <h3 className="font-display text-xl font-bold text-ink">
                    Guardrails
                  </h3>
                </div>
                <ul className="space-y-2">
                  {template.guardrails.map((guardrail, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-ink-2"
                    >
                      <Shield className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-ok" />
                      {guardrail}
                    </li>
                  ))}
                </ul>
              </Card>
            </AnimateIn>

            {/* Configurable Fields */}
            <AnimateIn delay={0.2}>
              <Card hoverLift={false}>
                <div className="mb-4 flex items-center gap-2">
                  <Settings className="h-5 w-5 text-accent" />
                  <h3 className="font-display text-xl font-bold text-ink">
                    Configurable Fields
                  </h3>
                </div>
                <ul className="space-y-2">
                  {template.configurableFields.map((field, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-ink-2"
                    >
                      <Settings className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-ink-3" />
                      {field}
                    </li>
                  ))}
                </ul>
              </Card>
            </AnimateIn>
          </div>
        </div>
      </SectionWrapper>

      {/* Related Templates */}
      {relatedTemplates.length > 0 && (
        <SectionWrapper band>
          <AnimateIn>
            <h2 className="mb-8 font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">
              More {industry?.name || template.industry} Templates
            </h2>
          </AnimateIn>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {relatedTemplates.map((related, i) => (
              <AnimateIn key={related.id} delay={i * 0.05}>
                <TemplateCard
                  name={related.name}
                  slug={related.slug}
                  industry={related.industry}
                  industrySlug={related.industrySlug}
                  description={related.description}
                  capabilities={related.capabilities}
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
