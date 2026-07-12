import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { SectionWrapper } from '@rach/ui/components/ui/SectionWrapper';
import { SectionHeader } from '@rach/ui/components/ui/SectionHeader';
import { Card } from '@rach/ui/components/ui/Card';
import { AnimateIn } from '@rach/ui/components/ui/AnimateIn';
import { Button } from '@rach/ui/components/ui/Button';
import { GradientText } from '@rach/ui/components/ui/GradientText';
import { CTABanner } from '@rach/ui/components/sections/CTABanner';
import { StatusPill } from "@/components/industry-demo/StatusPill";
import { industryRegistry } from "@/lib/industries";
import { ICONS } from "@/lib/industries/icons";

const BASE = "https://rach.dev";
const DESCRIPTION =
  "Live, interactive demos of Rach.Dev agent teams — one per industry. Watch a team of AI agents run a real workflow end to end on your existing systems, with a human in the loop on every decision. Starting with healthcare; more industries rolling out.";

export const metadata: Metadata = {
  title: "AI Agents by Industry",
  description: DESCRIPTION,
  alternates: { canonical: `${BASE}/agents` },
  openGraph: {
    title: "AI Agents by Industry | Rach Dev LLP",
    description: DESCRIPTION,
    url: `${BASE}/agents`,
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "AI Agents by Industry", description: DESCRIPTION },
};

export default function AgentsIndexPage() {
  const demos = Object.values(industryRegistry);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: BASE },
        { "@type": "ListItem", position: 2, name: "AI Agents", item: `${BASE}/agents` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Rach.Dev AI agent demos by industry",
      itemListElement: demos.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: `${c.vertical} AI Agents`,
        url: `${BASE}/agents/${c.slug}`,
      })),
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <SectionWrapper>
        <SectionHeader
          eyebrow="Agent demos"
          title="AI agent teams, by industry"
          subtitle="Each demo is a real, interactive agent team running an end-to-end workflow on the systems you already use — with a human in the loop on every decision and a full audit trail. Pick a vertical and watch it run."
        />

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {demos.map((c, i) => {
            const Icon = ICONS[c.icon ?? "orchestrator"];
            const blurb = c.tagline ?? c.subhead;
            return (
              <AnimateIn key={c.slug} delay={(i % 3) * 0.06}>
                <Link href={`/agents/${c.slug}`} className="group block h-full">
                  <Card className="flex h-full flex-col">
                    <StatusPill tone="live" dot className="absolute right-4 top-4">
                      Live demo
                    </StatusPill>
                    <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-accent-weak">
                      <Icon className="h-6 w-6 text-accent" strokeWidth={1.8} />
                    </div>
                    <h3 className="font-display text-xl font-bold text-ink transition-colors group-hover:text-accent">
                      {c.vertical}
                    </h3>
                    <p className="mt-2 flex-1 text-[14px] leading-relaxed text-ink-2">{blurb}</p>
                    <div className="mt-4 flex items-center gap-1.5 text-[12.5px] text-ink-3">
                      <Check className="h-3.5 w-3.5 text-ok" strokeWidth={2.4} />
                      {c.agents.length} specialist agents · 1 orchestrator ({c.orchestratorName})
                    </div>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-semibold text-accent">
                      Explore the demo
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Card>
                </Link>
              </AnimateIn>
            );
          })}
        </div>
      </SectionWrapper>

      {/* More coming */}
      <SectionWrapper band>
        <AnimateIn>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">
              More industries <GradientText>on the way</GradientText>
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-ink-2">
              We&rsquo;re rolling agent teams out across the industries we serve. Don&rsquo;t see yours yet? Explore
              the full set of industries and the templates behind them — or tell us where to point an agent team
              next.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Button variant="secondary" size="md" href="/industries">
                Browse all industries
              </Button>
              <Button variant="ghost" size="md" href="/contact">
                Request your industry
              </Button>
            </div>
          </div>
        </AnimateIn>
      </SectionWrapper>

      <CTABanner
        title="See an agent team run your workflow"
        subtitle="Book a pilot and we&rsquo;ll stand one up on your existing systems."
      />
    </>
  );
}
