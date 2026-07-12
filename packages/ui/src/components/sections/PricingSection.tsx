"use client";

import { AnimateIn } from '../ui/AnimateIn';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import {
  Server, HardDrive, Globe, Database, BarChart2, Activity, Copy, Check, Layers,
} from "lucide-react";

// ─── Data ────────────────────────────────────────────────────────────────────

const coreServices = [
  {
    icon: Server,
    bg: "bg-blue-50",
    color: "text-blue-600",
    name: "Virtual Machine",
    spec: "2 vCPUs · 8 GB RAM · 50 GB disk",
    price: "$100",
    unit: "per VM / month",
    accent: false,
  },
  {
    icon: HardDrive,
    bg: "bg-blue-50",
    color: "text-blue-600",
    name: "Additional Disk",
    spec: "Expandable block storage",
    price: "$0.15",
    unit: "per GB / month",
    accent: false,
  },
  {
    icon: Globe,
    bg: "bg-emerald-50",
    color: "text-emerald-600",
    name: "Load Balancer",
    spec: "Layer 4 / Layer 7 traffic distribution",
    price: "$25",
    unit: "per LB / month",
    accent: false,
  },
  {
    icon: Globe,
    bg: "bg-emerald-50",
    color: "text-emerald-600",
    name: "Additional Public IP",
    spec: "Static IPv4 address",
    price: "$10",
    unit: "per IP / month",
    accent: false,
  },
  {
    icon: Database,
    bg: "bg-violet-50",
    color: "text-violet-600",
    name: "Managed PostgreSQL",
    spec: "WAL archival · daily backups · on-demand point-in-time recovery",
    price: "$200",
    unit: "per DB instance / month",
    accent: true,
  },
  {
    icon: BarChart2,
    bg: "bg-amber-50",
    color: "text-amber-600",
    name: "VM Resource Observability",
    spec: "24/7 real-time CPU, RAM, disk & network metrics",
    price: "$25",
    unit: "per VM / month",
    accent: false,
  },
  {
    icon: Activity,
    bg: "bg-amber-50",
    color: "text-amber-600",
    name: "Application Workload Monitoring",
    spec: "24/7 endpoint observability & alerting",
    price: "$25",
    unit: "per endpoint / month",
    accent: false,
  },
];

const usageBased = [
  {
    icon: Database,
    bg: "bg-violet-50",
    color: "text-violet-600",
    name: "On-demand Postgres Backup",
    note: "Request ≥ 24 hrs in advance · 30-day retention",
    price: "$0.10 / GB",
  },
  {
    icon: Copy,
    bg: "bg-slate-50",
    color: "text-slate-500",
    name: "Daily VM Snapshot",
    note: "7-day retention · longer retention on request",
    price: "$0.10 / GB",
  },
];

const included = [
  "Regular Cloud security patching",
  "Regular Cloud CIS security audits",
  "Anti-DDoS protection",
  "On-demand VM cloning service",
];

const bundles = [
  {
    name: "Starter Bundle",
    price: 295,
    originalPrice: 325,
    badge: null,
    highlight: false,
    items: [
      { icon: Server,   color: "text-blue-600",    label: "1× Virtual Machine" },
      { icon: Globe,    color: "text-emerald-600",  label: "1× Load Balancer" },
      { icon: Database, color: "text-violet-600",   label: "1× Managed PostgreSQL" },
    ],
  },
  {
    name: "Growth Bundle",
    price: 800,
    originalPrice: 880,
    badge: "Most Popular",
    highlight: true,
    items: [
      { icon: Server,   color: "text-blue-600",    label: "3× Virtual Machines" },
      { icon: Globe,    color: "text-emerald-600",  label: "1× Load Balancer" },
      { icon: Database, color: "text-violet-600",   label: "2× Managed PostgreSQL" },
      { icon: Globe,    color: "text-emerald-600",  label: "3× Additional Public IP" },
      { icon: BarChart2,color: "text-amber-600",    label: "24/7 VM Observability (3 VMs)" },
    ],
  },
  {
    name: "Scale Bundle",
    price: 1270,
    originalPrice: 1400,
    badge: "Best Value",
    highlight: false,
    items: [
      { icon: Server,   color: "text-blue-600",    label: "5× Virtual Machines" },
      { icon: Globe,    color: "text-emerald-600",  label: "1× Load Balancer" },
      { icon: Database, color: "text-violet-600",   label: "3× Managed PostgreSQL" },
      { icon: Globe,    color: "text-emerald-600",  label: "5× Additional Public IP" },
      { icon: BarChart2,color: "text-amber-600",    label: "24/7 VM Observability (5 VMs)" },
    ],
  },
];

const footnotes = [
  "Daily DB backups run at pre-decided times with a 7-day retention period.",
  "On-demand Postgres backups require a request at least 24 hours in advance. Fixed 30-day retention.",
  "VM snapshot retention is 7 days by default. Contact the Cloud Infra/Ops team for higher retention.",
];

// ─── Component ────────────────────────────────────────────────────────────────

export function PricingSection() {
  return (
    <section className="py-10 lg:py-16">
      <div className="mx-auto max-w-[1200px] px-6 space-y-16">

        {/* Bundle Plans */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
            Bundle Plans
          </p>
          <p className="mb-8 text-sm text-[color:var(--text-secondary)]">
            Pre-configured packages at a discount. Save compared to buying individually.
          </p>
          <div className="grid gap-6 sm:grid-cols-3">
            {bundles.map((bundle, i) => (
              <AnimateIn key={bundle.name} delay={i * 0.08}>
                <div
                  className={[
                    "relative flex flex-col h-full rounded-2xl border-2 bg-white p-6",
                    "transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
                    bundle.highlight
                      ? "border-[color:var(--primary-purple)]/40"
                      : "border-[color:var(--neutral-border)]",
                  ].join(" ")}
                >
                  {/* Badge */}
                  {bundle.badge && (
                    <span className={[
                      "absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs font-bold whitespace-nowrap text-white",
                      bundle.badge === "Most Popular"
                        ? "bg-gradient-to-r from-[var(--primary-blue)] to-[var(--primary-purple)]"
                        : "bg-gradient-to-r from-amber-400 to-orange-500",
                    ].join(" ")}>
                      {bundle.badge}
                    </span>
                  )}

                  {/* Icon + name */}
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--primary-blue)]/10 to-[var(--primary-purple)]/10">
                    <Layers size={20} className="text-[color:var(--primary-blue)]" />
                  </div>
                  <h3 className="font-display text-base font-bold text-[color:var(--text-primary)]">
                    {bundle.name}
                  </h3>

                  {/* Included items */}
                  <ul className="mt-4 space-y-2 flex-1">
                    {bundle.items.map((item) => (
                      <li key={item.label} className="flex items-center gap-2 text-xs text-[color:var(--text-secondary)]">
                        <item.icon size={12} className={item.color} />
                        {item.label}
                      </li>
                    ))}
                  </ul>

                  {/* Price */}
                  <div className="mt-6 border-t border-[color:var(--neutral-border)] pt-4">
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-2xl font-bold text-[color:var(--text-primary)]">
                        ${bundle.price.toLocaleString()}
                      </span>
                      <span className="text-xs text-[color:var(--text-muted)]">/mo</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-[color:var(--text-muted)] line-through">
                        ${bundle.originalPrice.toLocaleString()}
                      </span>
                      <span className="text-xs font-semibold text-emerald-600">
                        Save ${(bundle.originalPrice - bundle.price).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>

        {/* Core services */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
            Core Services
          </p>
          <p className="mb-8 text-sm text-[color:var(--text-secondary)]">
            All prices in USD, billed monthly.
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {coreServices.map((s, i) => (
              <AnimateIn key={s.name} delay={i * 0.05}>
                <div
                  className={[
                    "relative flex flex-col h-full rounded-2xl border bg-white p-6",
                    "transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
                    s.accent
                      ? "border-[color:var(--primary-blue)]/30 before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:rounded-t-2xl before:bg-gradient-to-r before:from-[var(--primary-blue)] before:to-[var(--primary-purple)]"
                      : "border-[color:var(--neutral-border)]",
                  ].join(" ")}
                >
                  {s.accent && (
                    <span className="absolute right-4 top-4 rounded-full bg-gradient-to-r from-[var(--primary-blue)] to-[var(--primary-purple)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Popular
                    </span>
                  )}
                  <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${s.bg}`}>
                    <s.icon size={20} className={s.color} />
                  </div>
                  <h3 className="font-display text-sm font-semibold text-[color:var(--text-primary)]">
                    {s.name}
                  </h3>
                  <p className="mt-1 text-xs text-[color:var(--text-muted)] leading-relaxed flex-1">
                    {s.spec}
                  </p>
                  <div className="mt-5 border-t border-[color:var(--neutral-border)] pt-4">
                    <span className="font-display text-2xl font-bold text-[color:var(--text-primary)]">
                      {s.price}
                    </span>
                    <span className="ml-1.5 text-xs text-[color:var(--text-muted)]">{s.unit}</span>
                  </div>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>

        {/* Usage-based */}
        <AnimateIn>
          <div>
            <p className="mb-6 text-xs font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
              Usage-Based
            </p>
            <div className="grid gap-4 sm:grid-cols-2 max-w-3xl">
              {usageBased.map((item) => (
                <div
                  key={item.name}
                  className="flex items-start gap-4 rounded-2xl border border-[color:var(--neutral-border)] bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.bg}`}>
                    <item.icon size={18} className={item.color} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[color:var(--text-primary)]">{item.name}</p>
                    <p className="mt-0.5 text-xs text-[color:var(--text-muted)] leading-relaxed">{item.note}</p>
                    <p className="mt-3 font-display text-xl font-bold text-[color:var(--text-primary)]">
                      {item.price}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </AnimateIn>

        {/* Always included */}
        <AnimateIn>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-8">
            <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-emerald-700">
              Always Included · No Extra Charge
            </p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {included.map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500">
                    <Check size={13} strokeWidth={3} className="text-white" />
                  </span>
                  <span className="text-sm font-medium text-[color:var(--text-primary)]">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </AnimateIn>

        {/* Footnotes */}
        <ol className="space-y-1.5 list-decimal list-inside">
          {footnotes.map((note, i) => (
            <li key={i} className="text-xs text-[color:var(--text-muted)] leading-relaxed">{note}</li>
          ))}
        </ol>

        {/* Custom / Enterprise callout */}
        <AnimateIn>
          <Card hoverLift={false} gradientBorder className="text-center">
            <div className="py-6">
              <h3 className="font-display text-2xl font-bold text-[color:var(--text-primary)]">
                Need a custom plan?
              </h3>
              <p className="mx-auto mt-2 max-w-lg text-[color:var(--text-secondary)]">
                Custom VM counts, higher storage quotas, dedicated SLAs, and white-glove
                onboarding. Talk to us and we&apos;ll build the right package for your workload.
              </p>
              <div className="mt-6">
                <Button href="/contact">Contact Sales →</Button>
              </div>
            </div>
          </Card>
        </AnimateIn>

      </div>
    </section>
  );
}
