"use client";

import Image from "next/image";
import { Database, Bot } from "lucide-react";
import { SectionWrapper } from '../ui/SectionWrapper';
import { SectionHeader } from '../ui/SectionHeader';
import { Badge } from '../ui/Badge';
import { AnimateIn } from '../ui/AnimateIn';

const platforms = [
  {
    icon: Database,
    label: "BACKEND AS A SERVICE",
    title: "Infrastructure that just works",
    description:
      "Managed PostgreSQL, authentication, object storage, and auto-generated APIs. Your data stays on our secure infrastructure — India and US regions available. Zero DevOps required.",
    chips: ["Database", "Auth", "Storage", "APIs", "Realtime", "Backups"],
    image: "/images/platform/infrastructure-isometric.webp",
  },
  {
    icon: Bot,
    label: "AI AGENT BUILDER",
    title: "Deploy intelligent agents in minutes",
    description:
      "Choose from production-tested templates across 15 industries. Customize through conversation. Deploy with one click onto the same infrastructure that powers your backend.",
    chips: ["Templates", "NLP Config", "Sandbox", "One-Click Deploy", "Human Escalation"],
    image: "/images/platform/ai-agent-hub.webp",
  },
];

export function PlatformOverview() {
  return (
    <SectionWrapper id="platform">
      <SectionHeader
        eyebrow="PLATFORM"
        title="Two Products. One Platform."
        subtitle="A complete backend-as-a-service suite and an AI agent builder — connected seamlessly so you can go from idea to production in hours, not months."
      />

      <div className="space-y-24">
        {platforms.map((platform, i) => {
          const isReversed = i % 2 === 1;
          return (
            <AnimateIn key={i} delay={i * 0.1}>
              <div
                className={`grid items-center gap-10 md:gap-16 md:grid-cols-2 ${
                  isReversed ? "" : ""
                }`}
              >
                {/* Image */}
                <div className={isReversed ? "md:order-2" : ""}>
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-neutral-200 bg-gradient-to-br from-slate-50 to-white shadow-sm">
                    <Image
                      src={platform.image}
                      alt={platform.title}
                      fill
                      className="object-contain p-6"
                    />
                  </div>
                </div>

                {/* Content */}
                <div className={isReversed ? "md:order-1" : ""}>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-blue/10">
                    <platform.icon size={24} className="text-primary-blue" />
                  </div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-text-muted">
                    {platform.label}
                  </p>
                  <h3 className="mb-4 font-display text-2xl font-bold text-text-primary md:text-3xl">
                    {platform.title}
                  </h3>
                  <p className="mb-6 text-base leading-relaxed text-text-secondary">
                    {platform.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {platform.chips.map((chip) => (
                      <Badge key={chip} variant="default" className="text-xs">
                        {chip}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </AnimateIn>
          );
        })}
      </div>
    </SectionWrapper>
  );
}
