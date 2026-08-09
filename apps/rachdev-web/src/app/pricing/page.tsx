import type { Metadata } from "next";
import { Bot, Blocks, ShieldCheck, Users, Activity, Server, Lock, Plug, ArrowRight } from "lucide-react";
import { SectionWrapper } from '@rach/ui/components/ui/SectionWrapper';
import { AnimateIn } from '@rach/ui/components/ui/AnimateIn';
import { SectionHeader } from '@rach/ui/components/ui/SectionHeader';
import { Accordion } from '@rach/ui/components/ui/Accordion';
import { Card } from '@rach/ui/components/ui/Card';
import { Button } from '@rach/ui/components/ui/Button';
import { ValueCard } from '@rach/ui/components/ui/ValueCard';
import { pricingFAQs } from "@/data/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Pricing tailored to your AI agent deployment — cloud or on-prem. Every engagement is scoped to your solution, so we quote a personalized price. Talk to us to get started.",
};

// Engagement shapes — described, never priced.
const SHAPES = [
  { icon: Bot, title: "Single agent", body: "Deploy one focused agent for a specific job — support, screening, documentation. Scoped and quoted to your volume." },
  { icon: Blocks, title: "Industry solution", body: "A full workspace of agents for your vertical (HR, Healthcare, and more), configured to your process and data." },
  { icon: ShieldCheck, title: "Enterprise · on-prem", body: "Run entirely inside your environment with data residency, SSO, and SLAs. Scoped with our team." },
];

const FACTORS = [
  { icon: Bot, title: "Agents & seats", description: "How many agents you deploy and how many people work with them." },
  { icon: Activity, title: "Volume & usage", description: "Expected conversation and processing volume across your agents." },
  { icon: Server, title: "Deployment", description: "Our managed cloud, your own cloud, or fully on-premises." },
  { icon: Lock, title: "Data residency & compliance", description: "Where your data lives and the controls your industry requires." },
  { icon: Plug, title: "Integrations", description: "Connecting agents to your ATS, HRIS, records, and other systems." },
  { icon: Users, title: "Support & SLA", description: "The level of onboarding, support, and uptime commitments you need." },
];

export default function PricingPage() {
  return (
    <>
      {/* Hero */}
      <SectionWrapper>
        <SectionHeader
          eyebrow="Pricing"
          title="Pricing built around your solution"
          subtitle="We partner with teams to deploy AI agents that fit their workspace, volume, and where they run — cloud or on-prem. Pricing is scoped to your solution, not a one-size-fits-all plan. Tell us what you're building and we'll put together a personalized quote."
        />
        <AnimateIn>
          <div className="flex justify-center gap-3">
            <Button href="/contact">Talk to us <ArrowRight className="ml-1.5 inline h-4 w-4" /></Button>
            <Button href="/demo" variant="secondary">See a demo</Button>
          </div>
        </AnimateIn>
      </SectionWrapper>

      {/* Engagement shapes */}
      <SectionWrapper>
        <SectionHeader
          eyebrow="How we work with you"
          title="From a single agent to an enterprise solution"
          subtitle="Every engagement is scoped and quoted with you — there's no fixed price list, because no two deployments are the same."
        />
        <div className="grid gap-6 md:grid-cols-3">
          {SHAPES.map((s) => (
            <Card key={s.title}>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent-weak">
                <s.icon className="h-5 w-5 text-accent" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-ink">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{s.body}</p>
              <p className="mt-4 inline-flex items-center rounded-full bg-accent-weak px-3 py-1 text-xs font-semibold text-accent">
                Custom pricing — talk to us
              </p>
            </Card>
          ))}
        </div>
      </SectionWrapper>

      {/* What shapes your quote */}
      <SectionWrapper>
        <SectionHeader
          eyebrow="What shapes your quote"
          title="We price for what you actually deploy"
          subtitle="A few factors shape every proposal. We walk through them together so the quote reflects your real footprint."
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FACTORS.map((f) => (
            <ValueCard key={f.title} icon={f.icon} title={f.title} description={f.description} />
          ))}
        </div>
      </SectionWrapper>

      {/* Contact CTA */}
      <SectionWrapper>
        <AnimateIn>
          <Card className="mx-auto max-w-3xl text-center">
            <h2 className="font-display text-2xl font-bold text-ink">Tell us about your use case</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-ink-2">
              Share what you want your agents to do and where you want them to run. We&apos;ll scope the solution,
              show you what we&apos;d deploy, and come back with a quote tailored to your organisation.
            </p>
            <div className="mt-6 flex justify-center">
              <Button href="/contact">Contact us <ArrowRight className="ml-1.5 inline h-4 w-4" /></Button>
            </div>
          </Card>
        </AnimateIn>
      </SectionWrapper>

      {/* FAQ */}
      <SectionWrapper id="faq">
        <SectionHeader
          eyebrow="FAQ"
          title="How pricing works"
          subtitle="The short version: we scope with you, then quote. Here's what people usually ask."
        />
        <div className="mx-auto max-w-3xl">
          <Accordion items={pricingFAQs} />
        </div>
      </SectionWrapper>

      {/* FAQPage JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: pricingFAQs.map((faq) => ({
              "@type": "Question",
              name: faq.question,
              acceptedAnswer: { "@type": "Answer", text: faq.answer },
            })),
          }),
        }}
      />
    </>
  );
}
