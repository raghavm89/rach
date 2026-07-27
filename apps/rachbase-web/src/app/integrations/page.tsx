import type { Metadata } from "next";
import Image from "next/image";
import {
  Database,
  KeyRound,
  MessageSquare,
  Building2,
  ShoppingBag,
  CreditCard,
  Bot,
  GitBranch,
  Webhook,
  Plug,
  Settings2,
  Rocket,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionWrapper } from "@rach/ui/components/ui/SectionWrapper";
import { SectionHeader } from "@rach/ui/components/ui/SectionHeader";
import { AnimateIn } from "@rach/ui/components/ui/AnimateIn";
import { Card } from "@rach/ui/components/ui/Card";
import { Accordion } from "@rach/ui/components/ui/Accordion";
import { Button } from "@rach/ui/components/ui/Button";
import { CTABanner } from "@rach/ui/components/sections/CTABanner";

export const metadata: Metadata = {
  title: "Integrations",
  description:
    "Connect RachBase to the tools your business already runs on — databases, auth and SSO, messaging, CRM, commerce, payments, LLM providers, and developer tools. Anything else connects via auto-generated REST APIs and webhooks.",
};

interface IntegrationCategory {
  icon: LucideIcon;
  title: string;
  description: string;
  examples: string[];
}

const categories: IntegrationCategory[] = [
  {
    icon: Database,
    title: "Databases & Storage",
    description:
      "Your data layer is managed for you — and connects to the storage you already use.",
    examples: ["PostgreSQL", "pgvector", "S3-compatible storage"],
  },
  {
    icon: KeyRound,
    title: "Authentication & SSO",
    description:
      "Drop-in sign-in for your users and your team, including enterprise SSO.",
    examples: ["Google", "GitHub", "Apple", "Microsoft", "Magic links", "SAML SSO"],
  },
  {
    icon: MessageSquare,
    title: "Messaging & Chat",
    description:
      "Meet customers where they already are — deploy the same agent across channels.",
    examples: ["Slack", "Microsoft Teams", "WhatsApp", "Web chat widget", "Email"],
  },
  {
    icon: Building2,
    title: "CRM & Sales",
    description:
      "Keep your pipeline in sync so agents act on real customer context.",
    examples: ["Salesforce", "HubSpot", "Pipeline tools via API"],
  },
  {
    icon: ShoppingBag,
    title: "Commerce",
    description:
      "Read live inventory, orders, and customer history to power support and recovery.",
    examples: ["Shopify", "WooCommerce", "BigCommerce", "Custom storefronts"],
  },
  {
    icon: CreditCard,
    title: "Payments",
    description:
      "Process and reference payments without ever storing raw card data.",
    examples: ["Stripe", "PCI-compliant processors"],
  },
  {
    icon: Bot,
    title: "LLM Providers",
    description:
      "Route to the right model for the job, with configurable fallbacks.",
    examples: ["OpenAI", "Anthropic", "Configurable model routing"],
  },
  {
    icon: GitBranch,
    title: "Developer Tools",
    description:
      "Fit RachBase into the workflow your engineers already use.",
    examples: ["GitHub", "CI/CD pipelines", "Version control"],
  },
  {
    icon: Webhook,
    title: "Webhooks & REST API",
    description:
      "Connect anything else. Every project ships with auto-generated REST endpoints and outbound webhooks.",
    examples: ["Auto-generated REST API", "Outbound webhooks", "Custom integrations"],
  },
];

interface Step {
  icon: LucideIcon;
  title: string;
  description: string;
}

const steps: Step[] = [
  {
    icon: Plug,
    title: "Connect",
    description:
      "Authenticate the service once. Credentials are stored encrypted and scoped to least privilege.",
  },
  {
    icon: Settings2,
    title: "Configure",
    description:
      "Map the data and actions your agent can use. Pick a template and the common integrations come pre-wired.",
  },
  {
    icon: Rocket,
    title: "Deploy",
    description:
      "Ship the agent. It reads and writes through your connected tools in real time, with every action logged.",
  },
];

const faqs = [
  {
    question: "What if the tool I use isn't listed?",
    answer:
      "Every project ships with an auto-generated REST API and outbound webhooks, so you can connect virtually any third-party service or internal system. If you have a specific integration in mind, contact us and we'll point you to the fastest path.",
  },
  {
    question: "Do integrations work with the AI agents too?",
    answer:
      "Yes. Agents can read and write through your connected integrations in real time — checking live inventory, looking up CRM records, or sending a message in Slack — so responses are grounded in your actual data.",
  },
  {
    question: "How are integration credentials stored?",
    answer:
      "Credentials are encrypted at rest and scoped to the minimum permissions an integration needs. They are never exposed to client-side code or to the agent's model context.",
  },
  {
    question: "Can I switch LLM providers?",
    answer:
      "Yes. Model routing is configurable, so you can choose providers per use case and set fallbacks. You aren't locked into a single model vendor.",
  },
  {
    question: "Do you store payment card data?",
    answer:
      "No. Payment integrations are designed so raw card numbers never touch the platform — agents reference payments through PCI-compliant processors instead of storing card data.",
  },
];

export default function IntegrationsPage() {
  return (
    <>
      {/* Hero */}
      <SectionWrapper>
        <SectionHeader
          eyebrow="Integrations"
          title="Connect RachBase to your stack"
          subtitle="Your agents and backend are only as useful as the tools they can reach. RachBase plugs into the services you already run on — and connects to everything else through an open API."
        />
        <AnimateIn>
          <div className="relative mx-auto aspect-[16/9] w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-band shadow-well-sm">
            <Image
              src="/illustrations/pages/integrations-ecosystem.png"
              alt="A central RachBase platform node connected to surrounding third-party services"
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
            RachBase connects to the tools your business already uses — auth
            providers, messaging channels, CRMs, commerce platforms, payment
            processors, and LLM providers. Anything not natively supported
            connects through auto-generated REST APIs and outbound webhooks, so
            you&apos;re never blocked waiting on an integration.
          </p>
        </AnimateIn>
      </SectionWrapper>

      {/* Integration categories */}
      <SectionWrapper>
        <SectionHeader
          eyebrow="Connect your stack"
          title="Integrations by category"
          subtitle="Common services are pre-wired into templates. Everything else connects through the API."
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat, i) => {
            const Icon = cat.icon;
            return (
              <AnimateIn key={cat.title} delay={i * 0.05}>
                <Card hoverLift={false} className="h-full">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-accent/10 to-accent/10">
                    <Icon className="h-5 w-5 text-accent" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold text-ink">
                    {cat.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">
                    {cat.description}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {cat.examples.map((ex) => (
                      <span
                        key={ex}
                        className="rounded-full border border-line bg-band px-2.5 py-1 text-xs font-medium text-ink-2"
                      >
                        {ex}
                      </span>
                    ))}
                  </div>
                </Card>
              </AnimateIn>
            );
          })}
        </div>
      </SectionWrapper>

      {/* How integrations work */}
      <SectionWrapper band>
        <SectionHeader
          eyebrow="How it works"
          title="Three steps to a connected agent"
          subtitle="Connect once, configure what the agent can do, and ship."
        />
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <AnimateIn key={step.title} delay={i * 0.1}>
                <Card hoverLift={false} className="h-full">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-accent/10 to-accent/10">
                      <Icon className="h-5 w-5 text-accent" />
                    </div>
                    <span className="font-display text-sm font-semibold text-ink-3">
                      Step {i + 1}
                    </span>
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">
                    {step.description}
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
          title="Integration questions, answered"
          subtitle="What teams ask before wiring RachBase into their stack."
        />
        <div className="mx-auto max-w-3xl">
          <Accordion items={faqs} />
        </div>
        <div className="mt-10 text-center">
          <Button href="/contact">Ask about an integration &rarr;</Button>
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
