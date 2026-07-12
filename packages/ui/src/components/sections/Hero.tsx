"use client";

import Link from "next/link";
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { StartBuildingButton } from '../ui/StartBuildingButton';
import { GradientText } from '../ui/GradientText';
import { AnimateIn } from '../ui/AnimateIn';
import { DashboardMockup } from '../mockups/DashboardMockup';
import { ChatMockup } from '../mockups/ChatMockup';
import { MetricsMockup } from '../mockups/MetricsMockup';

const stats = [
  { value: "10+", label: "Businesses Powered" },
  { value: "99.9%", label: "Uptime" },
  { value: "< 90s", label: "Setup" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 pb-20 lg:pt-36 lg:pb-28 dot-pattern">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left Column */}
          <AnimateIn>
            <div>
              <Badge className="mb-6">
                <span className="mr-1">&#10022;</span>
                Backend + AI Agents — One Platform
              </Badge>

              <h1 className="font-display text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">
                Your Backend, <GradientText>Managed.</GradientText>
                <br />
                Your Agents, <GradientText>Deployed.</GradientText>
              </h1>

              <p className="mt-6 max-w-lg text-lg leading-relaxed text-text-secondary">
                Rach Dev LLP gives you production-ready backend infrastructure and an AI
                agent builder that turns your ideas into deployed, working agents —
                with a single click. No DevOps. No complexity. Just build.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <StartBuildingButton variant="primary" size="md" />
                <Button variant="secondary" href="/demo">
                  &#9654; Watch Demo
                </Button>
              </div>

              {/* Stats */}
              <div className="mt-10 flex flex-wrap items-center gap-8">
                {stats.map((stat, i) => (
                  <div key={i} className="flex items-center gap-3">
                    {i > 0 && (
                      <div className="hidden h-8 w-px bg-neutral-border sm:block" />
                    )}
                    <div>
                      <p className="font-mono text-xl font-bold text-text-primary">
                        {stat.value}
                      </p>
                      <p className="text-xs text-text-muted">{stat.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </AnimateIn>

          {/* Right Column — Floating Mockups */}
          <AnimateIn delay={0.3} direction="right">
            <div className="relative mx-auto h-[400px] w-full max-w-[500px] lg:h-[480px]">
              <DashboardMockup className="absolute top-0 left-0 rotate-2" />
              <Link
                href="/demo"
                title="Try the interactive demo"
                className="absolute right-0 bottom-8 -rotate-1 hidden cursor-pointer transition-transform hover:-translate-y-1 hover:rotate-0 md:block"
              >
                <ChatMockup />
              </Link>
              <MetricsMockup className="absolute top-1/3 right-1/4 rotate-1 hidden md:block" />
            </div>
          </AnimateIn>
        </div>
      </div>

      {/* Subtle glow */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[800px] -translate-x-1/2 opacity-30"
        style={{ background: 'radial-gradient(ellipse at center, #2563eb 0%, transparent 70%)' }}
      />
    </section>
  );
}