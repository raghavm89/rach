import type { Metadata } from "next";
import Image from "next/image";
import {
  Database,
  ShieldCheck,
  Zap,
  HardDrive,
  Radio,
  RotateCcw,
  Network,
  Lock,
  CloudUpload,
  Settings,
  Rocket,
  Check,
  X,
  Server,
  Globe,
  BarChart2,
  Activity,
  Copy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionWrapper } from "@rach/ui/components/ui/SectionWrapper";
import { SectionHeader } from "@rach/ui/components/ui/SectionHeader";
import { AnimateIn } from "@rach/ui/components/ui/AnimateIn";
import { FeatureDetailCard } from "@rach/ui/components/ui/FeatureDetailCard";
import { Card } from "@rach/ui/components/ui/Card";
import { CTABanner } from "@rach/ui/components/sections/CTABanner";
import { Hero } from "@rach/ui/components/home/Hero";
import { features } from "@/data/features";

export const metadata: Metadata = {
  title: "Backend as a Service",
  description:
    "Managed PostgreSQL, authentication, auto-generated APIs, object storage, realtime subscriptions, and automated backups. Dedicated infrastructure with no noisy neighbors.",
};

const iconMap: Record<string, LucideIcon> = {
  Database,
  ShieldCheck,
  Zap,
  HardDrive,
  Radio,
  RotateCcw,
  Network,
  Lock,
};

const steps = [
  {
    number: "01",
    icon: CloudUpload,
    title: "Provision",
    description:
      "Create a new project and get a dedicated PostgreSQL instance, auth system, and storage bucket provisioned in under 60 seconds.",
  },
  {
    number: "02",
    icon: Settings,
    title: "Configure",
    description:
      "Define your tables, set up row-level security policies, configure OAuth providers, and upload your schema — all from the dashboard.",
  },
  {
    number: "03",
    icon: Rocket,
    title: "Deploy",
    description:
      "Connect your frontend or agent to the auto-generated APIs. REST and GraphQL endpoints are live immediately with realtime subscriptions ready.",
  },
];

// ─── Services ────────────────────────────────────────────────────────────────

const coreServices = [
  {
    icon: Server,    bg: "bg-blue-50",    color: "text-primary-blue",
    name: "Virtual Machines",
    spec: "Dedicated VMs provisioned on enterprise-grade hardware with full resource isolation and no noisy neighbours.",
  },
  {
    icon: HardDrive, bg: "bg-blue-50",    color: "text-primary-blue",
    name: "Expandable Block Storage",
    spec: "Attach additional high-performance SSD storage to any VM on demand without downtime.",
  },
  {
    icon: Globe,     bg: "bg-emerald-50", color: "text-emerald-600",
    name: "Load Balancer",
    spec: "Layer 4 and Layer 7 load balancing for high-availability traffic distribution across your VM fleet.",
  },
  {
    icon: Globe,     bg: "bg-emerald-50", color: "text-emerald-600",
    name: "Public IP Addresses",
    spec: "Static IPv4 addresses for your VMs and services, with PTR records on request.",
  },
  {
    icon: Database,  bg: "bg-violet-50",  color: "text-violet-600",
    name: "Managed PostgreSQL",
    spec: "Fully managed PostgreSQL with WAL archival, automated daily backups, and on-demand point-in-time recovery.",
  },
  {
    icon: BarChart2, bg: "bg-amber-50",   color: "text-amber-600",
    name: "VM Resource Observability",
    spec: "24/7 real-time dashboards for CPU, RAM, disk, and network across your entire VM fleet.",
  },
  {
    icon: Activity,  bg: "bg-amber-50",   color: "text-amber-600",
    name: "Application Workload Monitoring",
    spec: "Endpoint-level observability with alerting, latency tracking, and uptime reporting.",
  },
  {
    icon: Copy,      bg: "bg-slate-50",   color: "text-slate-500",
    name: "VM Snapshots & DB Backups",
    spec: "Daily VM snapshots and on-demand Postgres backups with configurable retention periods.",
  },
];

const included = [
  "Regular Cloud security patching",
  "Regular Cloud CIS security audits",
  "Anti-DDoS protection",
  "On-demand VM cloning service",
];

// ─── Comparison ───────────────────────────────────────────────────────────────

const comparisonRows = [
  {
    feature: "Dedicated Infrastructure",
    rachdev: true,
    supabase: false,
    firebase: false,
    aws: true,
  },
  {
    feature: "Auto-Generated REST & GraphQL",
    rachdev: true,
    supabase: true,
    firebase: false,
    aws: false,
  },
  {
    feature: "Built-in Auth + RLS",
    rachdev: true,
    supabase: true,
    firebase: true,
    aws: false,
  },
  {
    feature: "Object Storage + CDN",
    rachdev: true,
    supabase: true,
    firebase: true,
    aws: true,
  },
  {
    feature: "Realtime Subscriptions",
    rachdev: true,
    supabase: true,
    firebase: true,
    aws: false,
  },
  {
    feature: "Automated Backups + PITR",
    rachdev: true,
    supabase: "Paid add-on",
    firebase: false,
    aws: true,
  },
  {
    feature: "Predictable Pricing",
    rachdev: true,
    supabase: true,
    firebase: false,
    aws: false,
  },
  {
    feature: "Dedicated Dev Support",
    rachdev: true,
    supabase: false,
    firebase: false,
    aws: "Paid add-on",
  },
];

function CellValue({ value }: { value: boolean | string }) {
  if (value === true)
    return <Check className="mx-auto h-5 w-5 text-ok" />;
  if (value === false)
    return <X className="mx-auto h-5 w-5 text-ink-3" />;
  return <span className="text-sm text-ink-2">{value}</span>;
}

export default function BaaSPage() {
  const baasFeatures = features.filter((f) => f.category === "baas");

  return (
    <>
      {/* Hero — backend-only variant of the shared home hero */}
      <Hero variant="backend" />

      {/* ARKA Microstacks partnership banner */}
      <SectionWrapper>
        <div
          className="flex items-center justify-center gap-5 rounded-2xl px-8 py-4 shadow-sm mx-auto max-w-2xl"
          style={{ background: 'linear-gradient(135deg, rgba(71,126,247,0.08) 0%, rgba(130,96,246,0.08) 100%)', border: '1px solid rgba(130,96,246,0.2)' }}
        >
          <Image
            src="/arka-microstacks.png"
            alt="Arka Microstacks"
            width={120}
            height={48}
            className="h-12 w-auto object-contain flex-shrink-0"
          />
          <div className="h-10 w-px flex-shrink-0" style={{ background: 'rgba(130,96,246,0.25)' }} />
          <p className="text-sm text-text-secondary leading-snug">
            Partnered with{' '}
            <strong className="font-semibold" style={{ color: 'var(--primary-purple)' }}>ARKA Microstacks</strong>
            {' '}for Managed Cloud Services
          </p>
        </div>
      </SectionWrapper>

      {/* Features Grid */}
      <SectionWrapper>
        <div className="grid gap-6 sm:grid-cols-2">
          {baasFeatures.map((feature, i) => {
            const Icon = iconMap[feature.icon] || Database;
            return (
              <AnimateIn key={feature.id} delay={i * 0.08}>
                <FeatureDetailCard
                  name={feature.name}
                  slug={feature.slug}
                  icon={Icon}
                  shortDescription={feature.shortDescription}
                  category="BaaS"
                  image={feature.image}
                />
              </AnimateIn>
            );
          })}
        </div>
      </SectionWrapper>

      {/* How It Works */}
      <SectionWrapper band>
        <SectionHeader
          eyebrow="How It Works"
          title="From zero to production in minutes"
          subtitle="Three steps between you and a fully managed backend."
        />
        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((step, i) => (
            <AnimateIn key={step.number} delay={i * 0.12}>
              <Card className="relative h-full text-center">
                <span className="font-mono text-4xl font-bold text-accent">
                  {step.number}
                </span>
                <div className="mx-auto mt-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-weak">
                  <step.icon className="h-6 w-6 text-accent" />
                </div>
                <h3 className="mt-4 font-display text-xl font-bold text-ink">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">
                  {step.description}
                </p>
              </Card>
            </AnimateIn>
          ))}
        </div>
      </SectionWrapper>

      {/* Services */}
      <SectionWrapper id="services">
        <SectionHeader
          eyebrow="SERVICES"
          title="Everything under one roof"
          subtitle="From raw compute to managed databases — every layer of your infrastructure, handled."
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {coreServices.map((s, i) => (
            <AnimateIn key={s.name} delay={i * 0.05}>
              <div className="flex flex-col h-full rounded-2xl border border-neutral-border bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${s.bg}`}>
                  <s.icon size={20} className={s.color} />
                </div>
                <h3 className="font-display text-sm font-semibold text-text-primary">{s.name}</h3>
                <p className="mt-2 text-xs text-text-muted leading-relaxed flex-1">{s.spec}</p>
              </div>
            </AnimateIn>
          ))}
        </div>
      </SectionWrapper>

      {/* Always included */}
      <SectionWrapper className="bg-bg-secondary">
        <SectionHeader
          eyebrow="ALWAYS INCLUDED"
          title="Security is not an add-on"
          subtitle="These services are bundled with every plan at no extra charge."
        />
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-8">
            <ul className="space-y-4">
              {included.map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500">
                    <Check size={13} strokeWidth={3} className="text-white" />
                  </span>
                  <span className="text-sm font-medium text-text-primary">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionWrapper>

      {/* Comparison Table */}
      <SectionWrapper>
        <SectionHeader
          eyebrow="COMPARISON"
          title="How Rach Dev LLP stacks up"
          subtitle="Dedicated infrastructure and bundled AI agents set us apart."
        />
        <AnimateIn>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th className="py-4 pr-4 text-left text-sm font-semibold text-ink">
                    Feature
                  </th>
                  <th className="px-4 py-4 text-center text-sm font-semibold text-accent">
                    Rach Dev LLP
                  </th>
                  <th className="px-4 py-4 text-center text-sm font-semibold text-ink">
                    Supabase
                  </th>
                  <th className="px-4 py-4 text-center text-sm font-semibold text-ink">
                    Firebase
                  </th>
                  <th className="px-4 py-4 text-center text-sm font-semibold text-ink">
                    AWS
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr
                    key={row.feature}
                    className="border-b border-line last:border-0"
                  >
                    <td className="py-4 pr-4 text-sm font-medium text-ink">
                      {row.feature}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <CellValue value={row.rachdev} />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <CellValue value={row.supabase} />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <CellValue value={row.firebase} />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <CellValue value={row.aws} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AnimateIn>
      </SectionWrapper>

      {/* CTA */}
      <CTABanner />
    </>
  );
}
