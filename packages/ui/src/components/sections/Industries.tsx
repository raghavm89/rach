"use client";

import {
  ShoppingCart,
  Heart,
  Building2,
  Scale,
  DollarSign,
  GraduationCap,
  Hotel,
  Monitor,
  Users,
  Briefcase,
} from "lucide-react";
import { SectionWrapper } from '../ui/SectionWrapper';
import { SectionHeader } from '../ui/SectionHeader';
import { AnimateIn } from '../ui/AnimateIn';
import { cn } from '../../lib/utils';

const industries = [
  { icon: ShoppingCart, name: "E-Commerce", agents: "Customer Support, Cart Recovery" },
  { icon: Heart, name: "Healthcare", agents: "Appointment Scheduling, Patient Intake" },
  { icon: Building2, name: "Real Estate", agents: "Property Inquiry, Lead Qualification" },
  { icon: Scale, name: "Legal", agents: "Client Intake, Document Drafting" },
  { icon: DollarSign, name: "Financial Services", agents: "KYC, Transaction Support" },
  { icon: GraduationCap, name: "Education", agents: "Tutoring, Student Support" },
  { icon: Hotel, name: "Hospitality", agents: "Reservations, Concierge" },
  { icon: Monitor, name: "SaaS", agents: "Technical Support, Onboarding" },
  { icon: Users, name: "Recruitment", agents: "Candidate Screening, Onboarding" },
  { icon: Briefcase, name: "Professional Services", agents: "Proposals, Billing" },
];

export function Industries() {
  return (
    <SectionWrapper id="industries">
      <SectionHeader
        eyebrow="INDUSTRIES"
        title="Built for your industry"
        subtitle="Pre-built agent templates with industry-specific compliance, guardrails, and integrations — so you don't start from zero."
      />

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {industries.map((industry, i) => (
          <AnimateIn key={i} delay={i * 0.05}>
            <div
              className={cn(
                "group cursor-default rounded-xl border border-neutral-border bg-white p-5 transition-all duration-300",
                "hover:-translate-y-1 hover:border-primary-blue/30 hover:shadow-md"
              )}
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-bg-secondary transition-colors group-hover:bg-primary-blue/10">
                <industry.icon
                  size={20}
                  className="text-text-muted transition-colors group-hover:text-primary-blue"
                />
              </div>
              <h3 className="mb-1 text-sm font-bold text-text-primary">
                {industry.name}
              </h3>
              <p className="text-xs text-text-muted">{industry.agents}</p>
            </div>
          </AnimateIn>
        ))}
      </div>

      <div className="mt-8 text-center">
        <a
          href="/industries"
          className="text-sm font-semibold text-primary-blue transition-colors hover:text-primary-purple"
        >
          View All 15 Industries &rarr;
        </a>
      </div>
    </SectionWrapper>
  );
}
