import type { Metadata } from "next";
import Image from "next/image";
import { Hammer, Shield, Users } from "lucide-react";
import { SectionWrapper } from '@rach/ui/components/ui/SectionWrapper';
import { SectionHeader } from '@rach/ui/components/ui/SectionHeader';
import { AnimateIn } from '@rach/ui/components/ui/AnimateIn';
import { TeamCard } from '@rach/ui/components/ui/TeamCard';
import { StatBlock } from '@rach/ui/components/ui/StatBlock';
import { ValueCard } from '@rach/ui/components/ui/ValueCard';
import { CTABanner } from '@rach/ui/components/sections/CTABanner';
import { team } from "@/data/team";

export const metadata: Metadata = {
  title: "About",
  description:
    "Meet the team behind Rach Dev LLP. We started as a development agency building backends and AI integrations for clients — then built the platform we wished existed.",
};

export default function AboutPage() {
  return (
    <>
      {/* Hero + Story */}
      <SectionWrapper>
        <SectionHeader
          eyebrow="Our Story"
          title="We've been in your shoes"
          subtitle="We started as a development agency building backends and AI integrations for clients. After solving the same problems dozens of times, we built the platform we wished existed."
        />
        <div className="mx-auto max-w-4xl">
          <AnimateIn>
            <div className="relative mx-auto mb-10 aspect-[16/9] w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-band shadow-well-sm">
              <Image
                src="/illustrations/pages/about-journey.png"
                alt="Rach Dev LLP — from a development agency to one unified platform"
                fill
                className="object-contain p-6"
              />
            </div>
          </AnimateIn>
          <AnimateIn delay={0.1}>
            <div className="space-y-6 text-lg leading-relaxed text-ink-2">
              <p>
                We started as a development agency building backends, deploying
                databases, and wiring up AI integrations for clients across
                industries. Every project started the same way: provision a
                database, set up authentication, write API endpoints, configure
                backups, and then spend weeks on the actual business logic the
                client was paying for.
              </p>
              <p>
                After the tenth time setting up the same PostgreSQL instance,
                the same auth flows, and the same deployment pipeline, we asked
                ourselves: why does this infrastructure work need to be repeated
                for every single project?
              </p>
              <p>
                When AI agents entered the picture, the problem compounded.
                Clients wanted chatbots, support agents, and lead qualification
                bots — but building each one from scratch meant weeks of prompt
                engineering, testing, and deployment work. We saw the same
                patterns across industries: the e-commerce support agent looks
                similar whether you sell shoes or software.
              </p>
              <p>
                So we built Rach Dev LLP — the platform that bundles managed
                backend infrastructure with a production-ready AI agent builder.
                One platform, one bill, and the ability to go from zero to
                deployed in minutes instead of months. Everything we learned
                from building for dozens of clients is baked into the templates,
                the guardrails, and the defaults.
              </p>
            </div>
          </AnimateIn>
        </div>
      </SectionWrapper>

      {/* Team */}
      <SectionWrapper band>
        <SectionHeader
          eyebrow="The Team"
          title="Meet the team"
          subtitle="Builders across infrastructure and AI who got tired of solving the same problems from scratch — so we built the agent platform we wished existed, and put a decade of hands-on agent experience behind it."
        />
        <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((member, i) => (
            <AnimateIn key={member.name} delay={i * 0.15}>
              <TeamCard
                name={member.name}
                role={member.role}
                bio={member.bio}
                image={member.image}
              />
            </AnimateIn>
          ))}
        </div>
      </SectionWrapper>

      {/* Stats */}
      <SectionWrapper dark>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
          <AnimateIn delay={0}>
            <StatBlock value="4+" label="Years Experience" />
          </AnimateIn>
          <AnimateIn delay={0.1}>
            <StatBlock value="10+" label="Businesses Powered" />
          </AnimateIn>
          <AnimateIn delay={0.2}>
            <StatBlock value="15" label="Industries Covered" />
          </AnimateIn>
          <AnimateIn delay={0.3}>
            <StatBlock value="60" label="Agent Templates" />
          </AnimateIn>
          <AnimateIn delay={0.4}>
            <StatBlock value="99.9%" label="Uptime Target" />
          </AnimateIn>
        </div>
      </SectionWrapper>

      {/* Values */}
      <SectionWrapper>
        <SectionHeader
          eyebrow="OUR VALUES"
          title="What we believe"
          subtitle="The principles that guide every product decision, support interaction, and line of code."
        />
        <div className="grid gap-8 md:grid-cols-3">
          <AnimateIn delay={0}>
            <ValueCard
              icon={Hammer}
              title="Builder-First"
              description="We build for developers and operators who ship. Every feature is designed to reduce time-to-production, not to pad a feature comparison chart. If it doesn't help you ship faster, we don't build it."
            />
          </AnimateIn>
          <AnimateIn delay={0.1}>
            <ValueCard
              icon={Shield}
              title="Honest by Default"
              description="Transparent pricing, honest documentation, and no marketing superlatives that overpromise. When something isn't ready, we say so. When there's a better tool for a specific job, we'll tell you."
            />
          </AnimateIn>
          <AnimateIn delay={0.2}>
            <ValueCard
              icon={Users}
              title="Human Backup"
              description="AI agents are powerful, but they have limits. Every agent deployment includes clear escalation paths to humans. We believe AI should augment people, not replace the safety net of human judgment."
            />
          </AnimateIn>
        </div>
      </SectionWrapper>

      {/* CTA */}
      <CTABanner />
    </>
  );
}
