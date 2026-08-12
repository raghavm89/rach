import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutTemplate,
  MessageSquare,
  FlaskConical,
  Rocket,
  UserCheck,
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
import type { LucideIcon } from "lucide-react";
import { SectionWrapper } from "@rach/ui/components/ui/SectionWrapper";
import { SectionHeader } from "@rach/ui/components/ui/SectionHeader";
import { AnimateIn } from "@rach/ui/components/ui/AnimateIn";
import { Card } from "@rach/ui/components/ui/Card";
import { FeatureDetailCard } from "@rach/ui/components/ui/FeatureDetailCard";
import { IndustryCard } from "@rach/ui/components/ui/IndustryCard";
import { CTABanner } from "@rach/ui/components/sections/CTABanner";
import { Hero } from "@rach/ui/components/home/Hero";
import { features } from "@/data/features";
import { industries } from "@/data/industries";

export const metadata: Metadata = {
  title: "AI Agent Builder",
  description:
    "Deploy intelligent AI agents in minutes. 60 production-tested templates across 15 industries. Configure via natural language, test in a sandbox, and deploy with one click.",
};

const agentIconMap: Record<string, LucideIcon> = {
  LayoutTemplate,
  MessageSquare,
  FlaskConical,
  Rocket,
  UserCheck,
};

const industryIconMap: Record<string, LucideIcon> = {
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

const workflow = [
  {
    number: "01",
    title: "Choose a Template",
    description:
      "Browse 60 production-tested templates organized across 15 industries. Each one includes a tuned system prompt, conversation flows, guardrails, and integration scaffolding.",
  },
  {
    number: "02",
    title: "Customize via Chat",
    description:
      "Describe your agent's behavior in plain English. Adjust the tone, add business rules, set escalation triggers — no flowcharts or code required.",
  },
  {
    number: "03",
    title: "Test in Sandbox",
    description:
      "Interact with your agent in a production-identical sandbox. Trace every decision, share preview links with stakeholders, and replay edge cases.",
  },
  {
    number: "04",
    title: "Deploy with One Click",
    description:
      "Your sandbox runs on production infrastructure. Going live is flipping a switch — zero downtime, instant rollback, and automatic scaling.",
  },
];

export default function AgentBuilderPage() {
  const agentFeatures = features.filter((f) => f.category === "agents");
  const displayedIndustries = industries.slice(0, 6);

  return (
    <>
      {/* Hero — agent-only variant of the shared home hero */}
      <Hero variant="agent" />

      {/* Showcase — what you can do yourself at rachdev.com */}
      <SectionWrapper>
        <SectionHeader
          eyebrow="Build it yourself"
          title="Design your agent team, connect your tools"
          subtitle="No engineers required. Assemble a multi-agent team on a visual canvas, then plug in the channels and tools it uses — all from your own workspace."
        />
        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <AnimateIn>
            <figure className="overflow-hidden rounded-2xl border border-ink/10 bg-ink shadow-lg ring-1 ring-black/5">
              <Image
                src="/images/showcase/team-canvas.png"
                alt="Agent team canvas — a conductor routing a website channel to a specialist and human handoff"
                width={2316}
                height={1240}
                className="h-auto w-full"
              />
              <figcaption className="border-t border-ink/10 bg-page px-5 py-3 text-sm text-ink-2">
                <span className="font-semibold text-ink">Visual team canvas.</span> Drag in a conductor, specialists, tools, and human handoff — connect them into a flow.
              </figcaption>
            </figure>
          </AnimateIn>
          <AnimateIn delay={0.1}>
            <figure className="overflow-hidden rounded-2xl border border-ink/10 bg-ink shadow-lg ring-1 ring-black/5">
              <Image
                src="/images/showcase/connections.png"
                alt="Connections — channels (Website Widget, Slack, WhatsApp) and tools (Razorpay, Stripe, Shopify, Perplexity, Email, Knowledge Base, HTTP)"
                width={2072}
                height={1472}
                className="h-auto w-full"
              />
              <figcaption className="border-t border-ink/10 bg-page px-5 py-3 text-sm text-ink-2">
                <span className="font-semibold text-ink">Your channels &amp; tools.</span> Connect Slack, WhatsApp, Razorpay, Stripe, Shopify, and more — credentials encrypted at rest.
              </figcaption>
            </figure>
          </AnimateIn>
        </div>
      </SectionWrapper>

      {/* Workflow */}
      <SectionWrapper>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {workflow.map((step, i) => (
            <AnimateIn key={step.number} delay={i * 0.1}>
              <Card className="h-full">
                <span className="font-mono text-4xl font-bold text-accent">
                  {step.number}
                </span>
                <h3 className="mt-4 font-display text-lg font-bold text-ink">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">
                  {step.description}
                </p>
              </Card>
            </AnimateIn>
          ))}
        </div>
      </SectionWrapper>

      {/* Agent Features Grid */}
      <SectionWrapper band>
        <SectionHeader
          eyebrow="Capabilities"
          title="Everything your agents need"
          subtitle="From templates to testing to deployment — the full agent lifecycle in one platform."
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {agentFeatures.map((feature, i) => {
            const Icon = agentIconMap[feature.icon] || LayoutTemplate;
            return (
              <AnimateIn key={feature.id} delay={i * 0.08}>
                <FeatureDetailCard
                  name={feature.name}
                  slug={feature.slug}
                  icon={Icon}
                  shortDescription={feature.shortDescription}
                  category="Agents"
                  image={feature.image}
                />
              </AnimateIn>
            );
          })}
        </div>
      </SectionWrapper>

      {/* Industries */}
      <SectionWrapper>
        <SectionHeader
          eyebrow="INDUSTRIES"
          title="Built for your industry"
          subtitle="Pre-built templates with industry-specific compliance, guardrails, and integrations."
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {displayedIndustries.map((industry, i) => {
            const Icon = industryIconMap[industry.icon] || Briefcase;
            return (
              <AnimateIn key={industry.id} delay={i * 0.08}>
                <IndustryCard
                  name={industry.name}
                  slug={industry.slug}
                  icon={Icon}
                  description={industry.description}
                  templateCount={industry.templateSlugs.length}
                  image={industry.image}
                />
              </AnimateIn>
            );
          })}
        </div>
        <div className="mt-10 text-center">
          <Link
            href="/industries"
            className="text-sm font-semibold text-accent transition-colors hover:underline"
          >
            View all 15 industries &rarr;
          </Link>
        </div>
      </SectionWrapper>

      {/* CTA */}
      <CTABanner />
    </>
  );
}
