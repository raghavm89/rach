import {
  ShoppingCart,
  HeartPulse,
  Building2,
  Scale,
  Landmark,
  GraduationCap,
  Hotel,
  AppWindow,
  Users,
  Briefcase,
} from "lucide-react";
import { AnimateIn } from '../ui/AnimateIn';
import { HomeSectionHead } from "./HomeSectionHead";

const INDUSTRIES = [
  { icon: ShoppingCart, name: "E-Commerce", desc: "Customer Support, Cart Recovery" },
  { icon: HeartPulse, name: "Healthcare", desc: "Appointment Scheduling, Patient Intake" },
  { icon: Building2, name: "Real Estate", desc: "Property Inquiry, Lead Qualification" },
  { icon: Scale, name: "Legal", desc: "Client Intake, Document Drafting" },
  { icon: Landmark, name: "Financial Services", desc: "KYC, Transaction Support" },
  { icon: GraduationCap, name: "Education", desc: "Tutoring, Student Support" },
  { icon: Hotel, name: "Hospitality", desc: "Reservations, Concierge" },
  { icon: AppWindow, name: "SaaS", desc: "Technical Support, Onboarding" },
  { icon: Users, name: "Recruitment", desc: "Candidate Screening, Scheduling" },
  { icon: Briefcase, name: "Professional Services", desc: "Proposals, Billing" },
];

export function Industries() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-site px-8">
        <AnimateIn>
          <HomeSectionHead
            eyebrow="Industries"
            title="Built for your industry"
            sub="Pre-built agent templates with industry-specific compliance, guardrails, and integrations — so you don't start from zero."
          />
        </AnimateIn>

        <div className="mt-[50px] grid grid-cols-2 gap-[18px] sm:grid-cols-3 min-[1000px]:grid-cols-5">
          {INDUSTRIES.map((ind, i) => {
            const Icon = ind.icon;
            return (
              <AnimateIn key={ind.name} delay={(i % 5) * 0.05}>
                <div className="group rounded-[14px] border border-line bg-surface p-5 transition-all duration-150 hover:-translate-y-[2px] hover:border-accent-line">
                  <div className="mb-[14px] grid h-[34px] w-[34px] place-items-center rounded-[9px] bg-row text-ink-2">
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
                  </div>
                  <h4 className="text-[15px] font-semibold">{ind.name}</h4>
                  <p className="mt-1 text-[12.5px] leading-[1.45] text-ink-3">{ind.desc}</p>
                </div>
              </AnimateIn>
            );
          })}
        </div>

        <div className="mt-[34px] text-center">
          <a
            href="/industries"
            className="inline-flex items-center gap-[7px] text-[15px] font-medium text-accent"
          >
            View all 15 industries &#8594;
          </a>
        </div>
      </div>
    </section>
  );
}
