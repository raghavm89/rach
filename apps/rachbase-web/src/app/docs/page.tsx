import type { Metadata } from "next";
import Image from "next/image";
import {
  Rocket,
  Database,
  ShieldCheck,
  Code2,
  Bot,
  Cloud,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionWrapper } from "@rach/ui/components/ui/SectionWrapper";
import { SectionHeader } from "@rach/ui/components/ui/SectionHeader";
import { AnimateIn } from "@rach/ui/components/ui/AnimateIn";
import { Card } from "@rach/ui/components/ui/Card";
import { Badge } from "@rach/ui/components/ui/Badge";
import { Button } from "@rach/ui/components/ui/Button";
import { CTABanner } from "@rach/ui/components/sections/CTABanner";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Rach Dev LLP documentation. Getting started guides, API references, and tutorials.",
};

interface DocSection {
  icon: LucideIcon;
  title: string;
  description: string;
}

const docSections: DocSection[] = [
  {
    icon: Rocket,
    title: "Getting Started",
    description:
      "Set up your project, connect your first database, and deploy your first agent.",
  },
  {
    icon: Database,
    title: "Database",
    description:
      "PostgreSQL management, schemas, migrations, pgvector, and connection pooling.",
  },
  {
    icon: ShieldCheck,
    title: "Authentication",
    description:
      "Email, OAuth, magic link auth, row-level security, and JWT tokens.",
  },
  {
    icon: Code2,
    title: "APIs",
    description:
      "REST and GraphQL endpoints, filtering, pagination, and realtime subscriptions.",
  },
  {
    icon: Bot,
    title: "AI Agents",
    description:
      "Templates, customization, sandbox testing, deployment, and monitoring.",
  },
  {
    icon: Cloud,
    title: "Deployment",
    description:
      "One-click deploy, regions, scaling, monitoring, and CI/CD integration.",
  },
];

export default function DocsPage() {
  return (
    <>
      {/* Hero */}
      <SectionWrapper>
        <SectionHeader
          eyebrow="DOCUMENTATION"
          title="Documentation"
          subtitle="Everything you need to get started and go deeper."
        />
        <AnimateIn>
          <div className="relative mx-auto aspect-[16/9] w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-band shadow-well-sm">
            <Image
              src="/illustrations/pages/docs-guide.png"
              alt="An open documentation book with code brackets, section tabs, and a search magnifier"
              fill
              className="object-contain p-6"
            />
          </div>
        </AnimateIn>
      </SectionWrapper>

      {/* Doc sections grid */}
      <SectionWrapper>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {docSections.map((section, i) => {
            const Icon = section.icon;
            return (
              <AnimateIn key={section.title} delay={i * 0.08}>
                <Card hoverLift={false} className="h-full">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-accent/10 to-accent/10">
                    <Icon className="h-5 w-5 text-accent" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold text-ink">
                    {section.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">
                    {section.description}
                  </p>
                  <div className="mt-4">
                    <Badge className="text-xs text-ink-3 bg-band">
                      Coming soon
                    </Badge>
                  </div>
                </Card>
              </AnimateIn>
            );
          })}
        </div>
      </SectionWrapper>

      {/* Coming soon message */}
      <SectionWrapper className="bg-band">
        <AnimateIn>
          <div className="text-center">
            <p className="mx-auto max-w-lg text-lg text-ink-2">
              Documentation is coming soon. In the meantime, reach out to our
              team for help.
            </p>
            <div className="mt-8">
              <Button href="/contact">Contact Us &rarr;</Button>
            </div>
          </div>
        </AnimateIn>
      </SectionWrapper>

      {/* CTA */}
      <CTABanner />
    </>
  );
}
