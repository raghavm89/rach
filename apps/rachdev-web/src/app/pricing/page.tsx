import type { Metadata } from "next";
import Image from "next/image";
import { SectionWrapper } from '@rach/ui/components/ui/SectionWrapper';
import { AnimateIn } from '@rach/ui/components/ui/AnimateIn';
import { SectionHeader } from '@rach/ui/components/ui/SectionHeader';
import { Accordion } from '@rach/ui/components/ui/Accordion';
import { PricingSection } from '@rach/ui/components/sections/PricingSection';
import { CTABanner } from '@rach/ui/components/sections/CTABanner';
import { pricingFAQs } from "@/data/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Transparent, predictable pricing for Rach Dev LLP. Backend infrastructure and AI agents bundled in one bill. Starter, Growth, and Scale plans with no hidden fees.",
};

export default function PricingPage() {
  return (
    <>
      {/* Hero */}
      <SectionWrapper>
        <SectionHeader
          eyebrow="Transparent Pricing"
          title="Simple pricing that scales with you"
          subtitle="Backend infrastructure and AI agents in one predictable bill. No per-seat charges, no hidden fees, no surprise invoices."
        />
        <AnimateIn>
          <div className="relative mx-auto aspect-[16/9] w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-band shadow-well-sm">
            <Image
              src="/illustrations/pages/pricing.png"
              alt="Three pricing plans side by side with the recommended plan highlighted"
              fill
              className="object-contain p-6"
            />
          </div>
        </AnimateIn>
      </SectionWrapper>

      {/* Pricing Cards */}
      <PricingSection />

      {/* FAQ */}
      <SectionWrapper id="faq">
        <SectionHeader
          eyebrow="FAQ"
          title="Frequently asked questions"
          subtitle="Everything you need to know about billing and what's included."
        />
        <div className="mx-auto max-w-3xl">
          <Accordion items={pricingFAQs} />
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
            mainEntity: pricingFAQs.map((faq) => ({
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
