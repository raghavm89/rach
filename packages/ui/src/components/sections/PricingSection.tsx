"use client";

import Link from 'next/link';
import { AnimateIn } from '../ui/AnimateIn';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import {
  Server, HardDrive, Globe, Database, BarChart2, Activity, Copy, Check, Layers, Box,
} from "lucide-react";
import {
  SERVICES, BUNDLES, USAGE_BASED, INCLUDED, FOOTNOTES, formatCents,
} from '../../lib/catalog';

/**
 * Pricing is read from the shared catalog — the same catalog.json the server
 * prices orders from.
 *
 * This file previously hardcoded its own copy, one of four in the codebase, and
 * it had drifted: the Growth and Scale bundles advertised savings of $80 and
 * $130 when their contents were worth $830 and $1,300 against prices of $800
 * and $1,270 — a real saving of $30 in both cases. Savings are now derived from
 * the contents, so that cannot recur.
 */

// Presentation only — icons and colours keyed by catalog service id.
const SERVICE_STYLE: Record<string, { icon: React.ElementType; bg: string; color: string }> = {
  vm:   { icon: Server,    bg: "bg-blue-50",    color: "text-blue-600" },
  svc:  { icon: Box,       bg: "bg-blue-50",    color: "text-blue-600" },
  disk: { icon: HardDrive, bg: "bg-blue-50",    color: "text-blue-600" },
  lb:   { icon: Globe,     bg: "bg-emerald-50", color: "text-emerald-600" },
  ip:   { icon: Globe,     bg: "bg-emerald-50", color: "text-emerald-600" },
  db:   { icon: Database,  bg: "bg-violet-50",  color: "text-violet-600" },
  obs:  { icon: BarChart2, bg: "bg-amber-50",   color: "text-amber-600" },
  mon:  { icon: Activity,  bg: "bg-amber-50",   color: "text-amber-600" },
};

const USAGE_STYLE: Record<string, { icon: React.ElementType; bg: string; color: string }> = {
  pg_backup:   { icon: Database, bg: "bg-violet-50", color: "text-violet-600" },
  vm_snapshot: { icon: Copy,     bg: "bg-slate-50",  color: "text-slate-500" },
};

const coreServices = SERVICES.map((s) => {
  const style = SERVICE_STYLE[s.id] ?? { icon: Box, bg: "bg-blue-50", color: "text-blue-600" };
  return {
    ...style,
    id: s.id,
    name: s.name,
    spec: s.specs,
    price: formatCents(s.unit_price_cents),
    unit: s.unit,
    accent: Boolean(s.featured),
  };
});

const usageBased = USAGE_BASED.map((u) => ({
  ...(USAGE_STYLE[u.id] ?? { icon: Copy, bg: "bg-slate-50", color: "text-slate-500" }),
  name: u.name,
  note: u.note,
  price: `${formatCents(u.price_cents_per_gb)} / GB`,
}));

const included = INCLUDED;
const footnotes = FOOTNOTES;

const bundles = BUNDLES.map((b) => ({
  id: b.id,
  name: b.name,
  price: b.price_cents / 100,
  originalPrice: b.listPriceCents / 100,
  saving: b.savingCents / 100,
  badge: b.badge,
  highlight: b.highlight,
  items: b.lines.map((l) => {
    const style = SERVICE_STYLE[l.id] ?? { icon: Box, color: "text-blue-600" };
    return { icon: style.icon, color: style.color, label: `${l.qty}× ${l.name}` };
  }),
}));

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
                    {bundle.saving > 0 && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-[color:var(--text-muted)] line-through">
                          ${bundle.originalPrice.toLocaleString()}
                        </span>
                        <span className="text-xs font-semibold text-emerald-600">
                          Save ${bundle.saving.toLocaleString()}
                        </span>
                      </div>
                    )}

                    {/* The bundle cards previously had no CTA at all — the only
                        conversion path on /pricing was "Contact Sales". */}
                    <Link
                      href={`/dashboard/billing/checkout?bundle=${bundle.id}`}
                      className={[
                        "mt-4 flex w-full items-center justify-center rounded-lg px-4 py-2.5",
                        "text-sm font-semibold transition-opacity hover:opacity-90",
                        bundle.highlight
                          ? "bg-gradient-to-r from-[var(--primary-blue)] to-[var(--primary-purple)] text-white"
                          : "border border-[color:var(--neutral-border)] text-[color:var(--text-primary)] hover:bg-[color:var(--bg-secondary)]",
                      ].join(" ")}
                    >
                      Get started →
                    </Link>
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
