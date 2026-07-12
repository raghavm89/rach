import type { Metadata } from "next";
import Image from "next/image";
import { Mail, MapPin, Calendar } from "lucide-react";
import { SectionWrapper } from '@rach/ui/components/ui/SectionWrapper';
import { SectionHeader } from '@rach/ui/components/ui/SectionHeader';
import { AnimateIn } from '@rach/ui/components/ui/AnimateIn';
import { Card } from '@rach/ui/components/ui/Card';
import { Button } from '@rach/ui/components/ui/Button';
import { ContactForm } from '@rach/ui/components/forms/ContactForm';
import { CTABanner } from '@rach/ui/components/sections/CTABanner';

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with the Rach Dev LLP team. Whether you have a pricing question, need migration help, or want to discuss a custom deployment — we respond within 24 hours.",
};

export default function ContactPage() {
  return (
    <>
      {/* Hero */}
      <SectionWrapper>
        <SectionHeader
          eyebrow="GET IN TOUCH"
          title="Let's talk about what you're building"
          subtitle="Whether you have a pricing question, need migration help, or want to explore a custom deployment — we're here to help."
        />
        <AnimateIn>
          <div className="relative mx-auto aspect-[16/9] w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-band shadow-well-sm">
            <Image
              src="/illustrations/pages/contact-support.png"
              alt="A chat window, an email envelope, and a support specialist with a headset connected together"
              fill
              className="object-contain p-6"
            />
          </div>
        </AnimateIn>
      </SectionWrapper>

      {/* Form + Sidebar */}
      <SectionWrapper>
        <div className="grid gap-12 lg:grid-cols-5">
          {/* Contact Form */}
          <div className="lg:col-span-3">
            <AnimateIn>
              <ContactForm />
            </AnimateIn>
          </div>

          {/* Contact Info Sidebar */}
          <div className="lg:col-span-2">
            <AnimateIn delay={0.15}>
              <Card hoverLift={false} className="space-y-8">
                {/* Email */}
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent/10 to-accent/10">
                    <Mail className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      Email
                    </p>
                    <a
                      href="mailto:social@rachdev.com"
                      className="text-sm text-ink-2 transition-colors hover:text-accent"
                    >
                      social@rachdev.com
                    </a>
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent/10 to-accent/10">
                    <MapPin className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      Location
                    </p>
                    <p className="text-sm text-ink-2">
                      Noida, India
                    </p>
                  </div>
                </div>

                {/* Calendar */}
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent/10 to-accent/10">
                    <Calendar className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      Book a Call
                    </p>
                    <p className="text-sm text-ink-2">
                      Schedule a 30-minute intro call with our team.
                    </p>
                  </div>
                </div>

                {/* Divider */}
                <hr className="border-line" />

                {/* Social links */}
                <div>
                  <p className="mb-3 text-sm font-semibold text-ink">
                    Follow Us
                  </p>
                  <div className="flex gap-4">
                    <a
                      href="https://twitter.com/rachdev"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-ink-2 transition-colors hover:text-accent"
                    >
                      Twitter / X
                    </a>
                    <a
                      href="https://github.com/rachdev"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-ink-2 transition-colors hover:text-accent"
                    >
                      GitHub
                    </a>
                    <a
                      href="https://linkedin.com/company/rachdev"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-ink-2 transition-colors hover:text-accent"
                    >
                      LinkedIn
                    </a>
                  </div>
                </div>
              </Card>
            </AnimateIn>
          </div>
        </div>
      </SectionWrapper>

      {/* Quick Links */}
      <SectionWrapper className="bg-band">
        <AnimateIn>
          <div className="text-center">
            <p className="mb-6 text-lg font-medium text-ink">
              Before reaching out, you might find your answer here:
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button variant="secondary" href="/pricing#faq">
                Pricing FAQ &rarr;
              </Button>
              <Button variant="secondary" href="/docs">
                Documentation &rarr;
              </Button>
              <Button variant="secondary" href="#">
                Status Page &rarr;
              </Button>
            </div>
          </div>
        </AnimateIn>
      </SectionWrapper>

      {/* CTA */}
      <CTABanner />
    </>
  );
}
