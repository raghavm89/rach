"use client";

import {
  Database,
  ShieldCheck,
  Code2,
  Sparkles,
  FlaskConical,
  Rocket,
} from "lucide-react";
import { SectionWrapper } from '../ui/SectionWrapper';
import { SectionHeader } from '../ui/SectionHeader';
import { Card } from '../ui/Card';
import { AnimateIn } from '../ui/AnimateIn';

const features = [
  {
    icon: Database,
    title: "Managed PostgreSQL",
    description:
      "Dedicated database per project with pgvector for AI-ready search. Automated backups, point-in-time recovery, and connection pooling included.",
  },
  {
    icon: ShieldCheck,
    title: "Authentication",
    description:
      "Email, OAuth, and magic link auth out of the box. Row-level security, JWT tokens, and multi-tenant user management — no Auth0 bills.",
  },
  {
    icon: Code2,
    title: "Auto-Generated APIs",
    description:
      "Create a table, get REST and GraphQL endpoints instantly. Filtering, pagination, and realtime subscriptions built in.",
  },
  {
    icon: Sparkles,
    title: "AI Agent Templates",
    description:
      "15 industries, 60 production-tested agent templates. Customer support, lead qualification, scheduling, and more — ready to customize and deploy.",
  },
  {
    icon: FlaskConical,
    title: "Sandbox & Testing",
    description:
      "Test your agents in a live sandbox with decision tracing. See exactly what your agent is thinking. Share preview links with stakeholders.",
  },
  {
    icon: Rocket,
    title: "One-Click Deploy",
    description:
      "Your sandbox runs on production infrastructure. Going live is flipping a switch — zero migration, zero config, zero downtime.",
  },
];

export function FeaturesGrid() {
  return (
    <SectionWrapper id="features" dotPattern>
      <SectionHeader
        eyebrow="FEATURES"
        title="Everything you need to ship"
        subtitle="From database to deployment, every piece of your stack — managed, monitored, and ready to scale."
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, i) => (
          <AnimateIn key={i} delay={i * 0.1}>
            <Card className="h-full p-6">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-primary-blue/10 to-primary-purple/10">
                <feature.icon size={22} className="text-primary-blue" />
              </div>
              <h3 className="mb-2 font-display text-lg font-bold text-text-primary">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-text-secondary">
                {feature.description}
              </p>
            </Card>
          </AnimateIn>
        ))}
      </div>
    </SectionWrapper>
  );
}
