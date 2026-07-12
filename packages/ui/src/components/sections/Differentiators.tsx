"use client";

import Image from "next/image";
import { Server, MessageSquareWarning, HeadsetIcon } from "lucide-react";
import { SectionWrapper } from '../ui/SectionWrapper';
import { SectionHeader } from '../ui/SectionHeader';
import { AnimateIn } from '../ui/AnimateIn';

const blocks = [
  {
    icon: Server,
    title: "Your infrastructure, our problem",
    description:
      "Every project runs on dedicated infrastructure — your own database, your own storage, your own namespace. No shared resources, no noisy neighbors. Data stays in your chosen region (US or India). We handle backups, scaling, monitoring, and security. You handle your product.",
    image: "/images/features/dedicated-infrastructure.webp",
  },
  {
    icon: MessageSquareWarning,
    title: "Agents that actually work in production",
    description:
      "We don't generate agents from scratch and hope they work. Our templates are battle-tested with built-in guardrails, compliance checks, and human escalation paths. When the AI doesn't know, it says so — and routes to a real person. That's how you build trust with your customers.",
    image: "/images/features/human-escalation.webp",
  },
  {
    icon: HeadsetIcon,
    title: "Stuck? Our developers have your back",
    description:
      "Unlike every other platform that leaves you alone after signup, Rach Dev LLP has a team of engineers ready to help. Need a custom integration? Want an agent template modified? Database migration from AWS or Supabase? We'll do it for you. Platform meets agency — the best of both worlds.",
    image: "/images/about/team-collaboration.webp",
  },
];

export function Differentiators() {
  return (
    <SectionWrapper id="why" className="bg-bg-secondary">
      <SectionHeader
        eyebrow="WHY RACH.DEV"
        title="Why Rach Dev LLP"
        subtitle="We're not just another platform. We're the team you wish you had."
      />

      <div className="space-y-20">
        {blocks.map((block, i) => (
          <AnimateIn key={i}>
            <div
              className={`grid items-center gap-12 md:grid-cols-2 ${
                i % 2 === 1 ? "md:direction-rtl" : ""
              }`}
            >
              <div className={i % 2 === 1 ? "md:order-2" : ""}>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-blue/10">
                  <block.icon size={24} className="text-primary-blue" />
                </div>
                <h3 className="mb-4 font-display text-2xl font-bold text-text-primary">
                  {block.title}
                </h3>
                <p className="text-base leading-relaxed text-text-secondary">
                  {block.description}
                </p>
              </div>
              <div className={`relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-neutral-200 bg-gradient-to-br from-slate-50 to-white shadow-sm ${i % 2 === 1 ? "md:order-1" : ""}`}>
                <Image
                  src={block.image}
                  alt={block.title}
                  fill
                  className="object-contain p-6"
                />
              </div>
            </div>
          </AnimateIn>
        ))}
      </div>
    </SectionWrapper>
  );
}
