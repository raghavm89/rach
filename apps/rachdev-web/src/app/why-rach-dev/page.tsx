import type { Metadata } from "next";
import Image from "next/image";
import { Server, Bot, Headphones } from "lucide-react";
import { SectionWrapper } from '@rach/ui/components/ui/SectionWrapper';
import { SectionHeader } from '@rach/ui/components/ui/SectionHeader';
import { AnimateIn } from '@rach/ui/components/ui/AnimateIn';
import { Button } from '@rach/ui/components/ui/Button';
import { CTABanner } from '@rach/ui/components/sections/CTABanner';

export const metadata: Metadata = {
  title: "Why Rach Dev",
  description:
    "See how Rach Dev compares to Supabase, Firebase, AWS, and building yourself. Dedicated infrastructure, AI agents, and real developer support.",
};

const comparisonRows = [
  { feature: "Dedicated Infrastructure", rachdev: "Yes", supabase: "Shared", firebase: "Shared", aws: "Complex", diy: "You manage" },
  { feature: "Auto-Generated APIs", rachdev: "Yes", supabase: "Yes", firebase: "Limited", aws: "Manual", diy: "Manual" },
  { feature: "AI Agent Builder", rachdev: "Built-in", supabase: "No", firebase: "No", aws: "No", diy: "Build yourself" },
  { feature: "Agent Templates", rachdev: "60 ready", supabase: "No", firebase: "No", aws: "No", diy: "No" },
  { feature: "Human Escalation", rachdev: "Built-in", supabase: "No", firebase: "No", aws: "No", diy: "Build yourself" },
  { feature: "Developer Support", rachdev: "Included", supabase: "Paid add-on", firebase: "Community", aws: "Paid support", diy: "N/A" },
  { feature: "Migration Help", rachdev: "White-glove", supabase: "Self-serve", firebase: "Self-serve", aws: "Complex", diy: "N/A" },
  { feature: "Pricing Model", rachdev: "Predictable", supabase: "Usage-based", firebase: "Usage-based", aws: "Complex", diy: "Variable" },
];

function isPositive(value: string): boolean {
  return ["Yes", "Built-in", "60 ready", "Included", "White-glove", "Predictable"].includes(value);
}

function isNegative(value: string): boolean {
  return value === "No";
}

const differentiators = [
  {
    icon: Server,
    title: "Your infrastructure, our problem",
    description:
      "Every Rach Dev project runs on dedicated infrastructure. No noisy neighbors, no shared connection pools, no surprise throttling because another tenant spiked. Your database, your compute, fully managed by us so you never think about it.",
    image: "/illustrations/rach-illus-infrastructure.png",
  },
  {
    icon: Bot,
    title: "Agents that actually work",
    description:
      "Our 60 agent templates are not demos. They are battle-tested across real businesses with built-in guardrails, structured outputs, and human escalation paths. Test every decision in the live sandbox before deploying to production.",
    image: "/illustrations/rach-illus-reliability.png",
  },
  {
    icon: Headphones,
    title: "Real developers, not just docs",
    description:
      "When you need help, you talk to engineers who have shipped production code — not a chatbot trained on our documentation. We handle custom integrations, migrations, and architecture reviews. Always available, always human.",
    image: "/illustrations/rach-illus-dev-support.png",
  },
];

export default function WhyRachDevPage() {
  return (
    <>
      {/* Hero */}
      <SectionWrapper>
        <SectionHeader
          eyebrow="Why Rach Dev"
          title="The platform you wish you had"
          subtitle="Compare Rach Dev with the alternatives. See why founders choose us."
        />
      </SectionWrapper>

      {/* Comparison Table */}
      <SectionWrapper className="pt-0">
        <AnimateIn>
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-well-sm">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-5 py-4 font-semibold text-ink">Feature</th>
                  <th className="bg-accent-weak px-5 py-4 font-semibold text-accent">Rach Dev</th>
                  <th className="px-5 py-4 font-semibold text-ink-2">Supabase</th>
                  <th className="px-5 py-4 font-semibold text-ink-2">Firebase</th>
                  <th className="px-5 py-4 font-semibold text-ink-2">AWS</th>
                  <th className="px-5 py-4 font-semibold text-ink-2">DIY</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, i) => (
                  <tr key={row.feature} className={i < comparisonRows.length - 1 ? "border-b border-line" : ""}>
                    <td className="px-5 py-4 font-medium text-ink">{row.feature}</td>
                    <td className="bg-accent-weak px-5 py-4 font-medium text-accent">
                      {isPositive(row.rachdev) && <span className="mr-1.5 text-ok">&#10003;</span>}
                      {row.rachdev}
                    </td>
                    {[row.supabase, row.firebase, row.aws, row.diy].map((val, k) => (
                      <td key={k} className="px-5 py-4 text-ink-2">
                        {isNegative(val) ? <span className="text-ink-3">&#10005; No</span> : val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AnimateIn>
      </SectionWrapper>

      {/* Differentiators */}
      <SectionWrapper band>
        {differentiators.map((block, i) => {
          const Icon = block.icon;
          const isEven = i % 2 === 0;
          return (
            <AnimateIn key={block.title} delay={i * 0.1} direction={isEven ? "left" : "right"}>
              <div className="grid items-center gap-8 py-10 md:grid-cols-2">
                <div className={!isEven ? "md:order-2" : ""}>
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-weak">
                    <Icon className="h-8 w-8 text-accent" strokeWidth={1.8} />
                  </div>
                  <h3 className="font-display text-xl font-bold tracking-[-0.015em] text-ink md:text-2xl">
                    {block.title}
                  </h3>
                  <p className="mt-3 max-w-xl leading-relaxed text-ink-2">{block.description}</p>
                </div>
                <div
                  className={`relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-well-sm ${
                    !isEven ? "md:order-1" : ""
                  }`}
                >
                  <Image src={block.image} alt={block.title} fill className="object-contain p-6" />
                </div>
              </div>
            </AnimateIn>
          );
        })}
      </SectionWrapper>

      {/* Explore links */}
      <SectionWrapper>
        <SectionHeader title="See the details" subtitle="Dive deeper into the platform." />
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Button href="/features">Explore Our Features &rarr;</Button>
          <Button variant="secondary" href="/pricing">
            See Pricing &rarr;
          </Button>
        </div>
      </SectionWrapper>

      {/* CTA */}
      <CTABanner />
    </>
  );
}
