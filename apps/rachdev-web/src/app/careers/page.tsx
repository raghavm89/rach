import type { Metadata } from "next";
import { Hammer, Shield, Users } from "lucide-react";
import { SectionWrapper } from '@rach/ui/components/ui/SectionWrapper';
import { SectionHeader } from '@rach/ui/components/ui/SectionHeader';
import { AnimateIn } from '@rach/ui/components/ui/AnimateIn';
import { Card } from '@rach/ui/components/ui/Card';
import { Button } from '@rach/ui/components/ui/Button';
import { ValueCard } from '@rach/ui/components/ui/ValueCard';
import { CTABanner } from '@rach/ui/components/sections/CTABanner';

export const metadata: Metadata = {
  title: "Careers",
  description:
    "Join the Rach Dev LLP team. We're building the future of backend infrastructure and AI agents.",
};

export default function CareersPage() {
  return (
    <>
      {/* Hero */}
      <SectionWrapper>
        <SectionHeader
          eyebrow="CAREERS"
          title="Join the team"
          subtitle="We're building the future of backend infrastructure and AI agents."
        />
        <AnimateIn>
          <div className="mx-auto max-w-2xl">
            <Card hoverLift={false} className="text-center">
              <h3 className="font-display text-xl font-bold text-ink">
                No open positions right now
              </h3>
              <p className="mt-4 text-ink-2 leading-relaxed">
                We&apos;re a small, focused team. But we&apos;re always
                interested in hearing from talented engineers, designers, and
                operators who are passionate about developer tools and AI.
              </p>
              <p className="mt-4 text-ink-2 leading-relaxed">
                If that sounds like you, drop us a line.
              </p>
              <div className="mt-6">
                <Button href="/contact">Get in Touch &rarr;</Button>
              </div>
            </Card>
          </div>
        </AnimateIn>
      </SectionWrapper>

      {/* Values */}
      <SectionWrapper className="bg-band">
        <SectionHeader
          eyebrow="OUR VALUES"
          title="What we believe"
        />
        <div className="grid gap-8 md:grid-cols-3">
          <AnimateIn delay={0}>
            <ValueCard
              icon={Hammer}
              title="Builder-First"
              description="Everything we build is for people who want to ship, not tinker with infrastructure."
            />
          </AnimateIn>
          <AnimateIn delay={0.1}>
            <ValueCard
              icon={Shield}
              title="Honest by Default"
              description="Transparent pricing. No bait-and-switch. If something won't work for you, we'll tell you."
            />
          </AnimateIn>
          <AnimateIn delay={0.2}>
            <ValueCard
              icon={Users}
              title="Human Backup"
              description="AI is powerful, but it's not enough. Real developers are always available when you need them."
            />
          </AnimateIn>
        </div>
      </SectionWrapper>

      {/* CTA */}
      <CTABanner />
    </>
  );
}
