import type { Metadata } from "next";
import Image from "next/image";
import {
  Lock,
  Server,
  KeyRound,
  DatabaseBackup,
  ScrollText,
  Fingerprint,
  FileCheck,
  ShieldCheck,
  CreditCard,
  Eye,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionWrapper } from "@rach/ui/components/ui/SectionWrapper";
import { SectionHeader } from "@rach/ui/components/ui/SectionHeader";
import { AnimateIn } from "@rach/ui/components/ui/AnimateIn";
import { Card } from "@rach/ui/components/ui/Card";
import { Badge } from "@rach/ui/components/ui/Badge";
import { Button } from "@rach/ui/components/ui/Button";
import { Accordion } from "@rach/ui/components/ui/Accordion";
import { CTABanner } from "@rach/ui/components/sections/CTABanner";

export const metadata: Metadata = {
  title: "Security & Compliance",
  description:
    "How Rach Dev LLP protects your data: encryption in transit and at rest, dedicated tenant isolation, row-level security, encrypted backups, audit logging, and compliance-ready architecture for GDPR, CCPA, HIPAA, and PCI.",
};

interface SecurityItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

const protections: SecurityItem[] = [
  {
    icon: Lock,
    title: "Encryption Everywhere",
    description:
      "Data is encrypted in transit with TLS 1.2+ and at rest with AES-256. Keys are managed and rotated by the platform, not left to your application code.",
  },
  {
    icon: Server,
    title: "Dedicated Tenant Isolation",
    description:
      "Every project runs on its own dedicated PostgreSQL instance with guaranteed resources — no shared multi-tenant database where a noisy neighbor can read or degrade your data.",
  },
  {
    icon: KeyRound,
    title: "Row-Level Security",
    description:
      "Authorization is enforced at the database layer with RLS policies tied to each authenticated user, so access rules can't be bypassed by a bug in application code.",
  },
  {
    icon: DatabaseBackup,
    title: "Encrypted Backups & Recovery",
    description:
      "Automated, encrypted daily backups with point-in-time recovery to any second within the last 30 days, stored in a separate availability zone from your primary database.",
  },
  {
    icon: ScrollText,
    title: "Audit Logging",
    description:
      "Privileged actions and agent conversations are recorded in audit-friendly, exportable formats with configurable retention, so you always have a trail of what happened and when.",
  },
  {
    icon: Fingerprint,
    title: "Access Controls",
    description:
      "Role-based access, OAuth and SSO sign-in, and least-privilege defaults across the platform keep credentials and infrastructure access tightly scoped.",
  },
];

interface ComplianceItem {
  icon: LucideIcon;
  title: string;
  status: string;
  description: string;
}

const compliance: ComplianceItem[] = [
  {
    icon: FileCheck,
    title: "GDPR & CCPA",
    status: "Supported",
    description:
      "Configurable data-retention policies, right-to-deletion, and data-portability workflows help you meet GDPR and CCPA obligations for the data your agents handle.",
  },
  {
    icon: ShieldCheck,
    title: "HIPAA-Ready Architecture",
    status: "By design",
    description:
      "Healthcare templates are built so agents never store protected health information (PHI) outside your HIPAA-compliant systems, with audit-compliant logging throughout.",
  },
  {
    icon: CreditCard,
    title: "PCI-Conscious Payments",
    status: "By design",
    description:
      "Agents never store raw card numbers and integrate with PCI-compliant payment processors, keeping cardholder data out of the platform entirely.",
  },
  {
    icon: Eye,
    title: "SOC 2 Type II",
    status: "In progress",
    description:
      "We're actively building toward SOC 2 Type II. We'd rather tell you exactly where we are than imply a certification we don't yet hold — reach out for our current posture.",
  },
];

const faqs = [
  {
    question: "How is my data encrypted?",
    answer:
      "All data is encrypted in transit using TLS 1.2 or higher and at rest using AES-256. Backups are encrypted with the same standard and stored separately from your primary database.",
  },
  {
    question: "Is my database shared with other customers?",
    answer:
      "No. Every project is provisioned with a dedicated PostgreSQL instance and isolated resources. There is no shared multi-tenant database, which removes an entire class of cross-tenant data-leak risks.",
  },
  {
    question: "Do your AI agents store sensitive customer data?",
    answer:
      "Agents are configured to keep sensitive data — PHI, raw payment card numbers, and similar — out of the platform. They integrate with your compliant systems of record and payment processors rather than storing that data themselves.",
  },
  {
    question: "Are you SOC 2 certified?",
    answer:
      "We are working toward SOC 2 Type II and are not certified yet. We believe in being honest about our security posture, so please contact us for the current status, our roadmap, and any documentation you need for vendor review.",
  },
  {
    question: "Can I get an audit log of agent activity?",
    answer:
      "Yes. Privileged actions and agent conversations are logged in exportable, audit-friendly formats with configurable retention so you can review and export activity for compliance and incident response.",
  },
];

export default function SecurityPage() {
  return (
    <>
      {/* Hero */}
      <SectionWrapper>
        <SectionHeader
          eyebrow="Trust & Security"
          title="Security and compliance, built in"
          subtitle="Security isn't a checkbox we added later — it's how the platform is architected. Dedicated isolation, encryption everywhere, and compliance-ready defaults from day one."
        />
        <AnimateIn>
          <div className="relative mx-auto aspect-[16/9] w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-band shadow-well-sm">
            <Image
              src="/illustrations/pages/security-compliance.png"
              alt="A security shield with a checkmark, flanked by a compliance checklist and a locked audit log"
              fill
              className="object-contain p-6"
            />
          </div>
        </AnimateIn>
      </SectionWrapper>

      {/* Answer block */}
      <SectionWrapper className="bg-band">
        <AnimateIn>
          <p className="mx-auto max-w-3xl text-center text-lg leading-relaxed text-ink-2">
            Rach Dev LLP protects your data with end-to-end encryption, a dedicated
            database per project, database-enforced access control, and
            audit-ready logging. Our architecture is designed to support GDPR,
            CCPA, HIPAA, and PCI obligations so you can deploy AI agents on
            sensitive data with confidence.
          </p>
        </AnimateIn>
      </SectionWrapper>

      {/* How we protect your data */}
      <SectionWrapper>
        <SectionHeader
          eyebrow="Protection"
          title="How we protect your data"
          subtitle="The controls that run underneath every project, by default."
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {protections.map((item, i) => {
            const Icon = item.icon;
            return (
              <AnimateIn key={item.title} delay={i * 0.06}>
                <Card hoverLift={false} className="h-full">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-accent/10 to-accent/10">
                    <Icon className="h-5 w-5 text-accent" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold text-ink">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">
                    {item.description}
                  </p>
                </Card>
              </AnimateIn>
            );
          })}
        </div>
      </SectionWrapper>

      {/* Compliance & standards */}
      <SectionWrapper band>
        <SectionHeader
          eyebrow="Compliance"
          title="Compliance & standards"
          subtitle="Where we stand today — stated honestly, including what's still in progress."
        />
        <div className="grid gap-6 sm:grid-cols-2">
          {compliance.map((item, i) => {
            const Icon = item.icon;
            return (
              <AnimateIn key={item.title} delay={i * 0.08}>
                <Card hoverLift={false} className="h-full">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-accent/10 to-accent/10">
                      <Icon className="h-5 w-5 text-accent" />
                    </div>
                    <Badge className="text-xs">{item.status}</Badge>
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold text-ink">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">
                    {item.description}
                  </p>
                </Card>
              </AnimateIn>
            );
          })}
        </div>
      </SectionWrapper>

      {/* FAQ */}
      <SectionWrapper id="faq">
        <SectionHeader
          eyebrow="FAQ"
          title="Security questions, answered"
          subtitle="The questions security and procurement teams ask us most."
        />
        <div className="mx-auto max-w-3xl">
          <Accordion items={faqs} />
        </div>
        <div className="mt-10 text-center">
          <Button href="/contact">Talk to our team &rarr;</Button>
        </div>
      </SectionWrapper>

      {/* CTA */}
      <CTABanner />

      {/* FAQPage JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((faq) => ({
              "@type": "Question",
              name: faq.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: faq.answer,
              },
            })),
          }),
        }}
      />
    </>
  );
}
