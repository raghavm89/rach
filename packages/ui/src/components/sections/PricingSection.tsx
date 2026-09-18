"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimateIn } from '../ui/AnimateIn';
import { useAuth } from '../../contexts/AuthContext';
import {
  Server, HardDrive, Globe, Database, BarChart2, Activity, Copy, Check, Box,
  FileText, LineChart, Boxes, Building2,
} from "lucide-react";
import {
  VISIBLE_SERVICES, USAGE_BASED, INCLUDED, FOOTNOTES, formatCents, PRO, COMPUTE_SIZES,
  proBaseCents, proContainerCents, computeDeltaCents, type BillingCurrency,
} from '../../lib/catalog';
import { geo } from '../../lib/api';

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
  logs: { icon: FileText,  bg: "bg-slate-50",   color: "text-slate-500" },
  analytics: { icon: LineChart, bg: "bg-emerald-50", color: "text-emerald-600" },
};

const USAGE_STYLE: Record<string, { icon: React.ElementType; bg: string; color: string }> = {
  pg_backup:   { icon: Database, bg: "bg-violet-50", color: "text-violet-600" },
  vm_snapshot: { icon: Copy,     bg: "bg-slate-50",  color: "text-slate-500" },
};

const coreServices = VISIBLE_SERVICES.map((s) => {
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

// Plans (Starter / Pro / Enterprise) — the shared tiers come from the catalog `pro.regions`
// block, so marketing can't drift from what's charged. Prices are GEO-NATIVE: `cur` picks
// the region (USD = International, INR = India, ex-GST). India adds 18% GST at checkout.
function buildPlans(cur: BillingCurrency) {
  const perContainer = formatCents(proContainerCents(cur), cur);
  const micro = formatCents(computeDeltaCents('micro', cur), cur);
  const small = formatCents(computeDeltaCents('small', cur), cur);
  const computeLine = `Compute upgrades: micro (+${micro}) · small (+${small})`;
  const gst = cur === 'INR' ? ' + GST' : '';
  return [
    {
      id: 'starter', name: PRO.tiers.starter.label, icon: Boxes,
      tagline: 'Launch a single service on shared, auto-scaling infrastructure.',
      price: formatCents(proBaseCents('starter', cur), cur), unit: `/mo${gst}`,
      priceNote: `Includes ${PRO.tiers.starter.base_includes_containers} container · +${perContainer}/container`,
      features: [
        `${PRO.tiers.starter.base_includes_containers} nano container included`,
        `${perContainer}/mo per additional container`,
        computeLine,
        'Deploy from a GitHub repo',
      ],
      cta: { label: 'Start with Starter →', href: '/dashboard/projects' },
    },
    {
      id: 'pro', name: PRO.tiers.pro.label, icon: Boxes,
      tagline: 'Run a full backend on shared, auto-scaling infrastructure.',
      price: formatCents(proBaseCents('pro', cur), cur), unit: `/mo${gst}`,
      priceNote: `Includes ${PRO.tiers.pro.base_includes_containers} containers · +${perContainer}/container`,
      features: [
        `${PRO.tiers.pro.base_includes_containers} nano containers included`,
        'Backend (Auth · Data · Storage · Functions): 3 containers, included',
        'Observability: metrics, query performance & logs',
        `${perContainer}/mo per additional container`,
        computeLine,
        'Deploy from a GitHub repo',
      ],
      cta: { label: 'Start with Pro →', href: '/dashboard/projects' },
    },
    {
      id: 'enterprise', name: 'Enterprise', icon: Building2,
      tagline: 'For large-scale applications running internet-scale workloads.',
      price: 'Custom', unit: '', priceNote: null as string | null,
      features: [
        'Designated support manager',
        'Uptime SLAs',
        'BYO Cloud supported',
        '24×7×365 premium enterprise support',
        'Private Slack channel',
        'Custom security questionnaires',
      ],
      cta: { label: 'Contact us →', href: '/contact' },
    },
  ];
}

// Explicit compute-size breakdown (per container, on top of the container fee).
function buildComputeRows(cur: BillingCurrency) {
  return COMPUTE_SIZES.map((size) => {
    const delta = computeDeltaCents(size, cur);
    return {
      size,
      specs: PRO.compute_sizes[size].specs,
      delta: delta === 0 ? 'Included' : `+${formatCents(delta, cur)}/mo`,
      isDefault: size === PRO.default_compute_size,
    };
  });
}

// Fallback region used only when IP geo can't resolve (loopback/private IP in dev):
// India timezone → INR, else USD. In production the IP country decides.
function fallbackRegion(): BillingCurrency {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    return tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta' ? 'INR' : 'USD';
  } catch { return 'USD'; }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PricingSection() {
  const { user, loading } = useAuth();
  // Region for plan pricing — auto-detected from the visitor's IP (India → INR, else USD).
  // Falls back to timezone only when IP geo can't resolve (dev/loopback). The server
  // re-resolves region from the billing address at pay, so this is display-only.
  const [cur, setCur] = useState<BillingCurrency>('USD');
  useEffect(() => {
    let alive = true;
    geo.country()
      .then((r) => { if (alive) setCur(r.country === 'IN' ? 'INR' : r.country ? 'USD' : fallbackRegion()); })
      .catch(() => { if (alive) setCur(fallbackRegion()); });
    return () => { alive = false; };
  }, []);
  const plans = buildPlans(cur);
  const COMPUTE_ROWS = buildComputeRows(cur);
  const isShared = (id: string) => id === 'starter' || id === 'pro';
  // Shared-tier CTAs are auth-aware: signed in → dashboard billing; signed out → sign in,
  // then back to billing. Enterprise uses its static href.
  const ctaHref = (plan: { id: string; cta: { href: string } }) =>
    isShared(plan.id) ? (user ? '/dashboard/billing' : '/login?next=/dashboard/billing') : plan.cta.href;

  return (
    <section className="py-10 lg:py-16">
      <div className="mx-auto max-w-[1200px] px-6 space-y-16">

        {/* Plans */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
            Plans
          </p>
          <p className="mb-8 text-sm text-[color:var(--text-secondary)]">
            Start on Starter or Pro and pay per container, or talk to us for Enterprise.
            {cur === 'INR' && <span className="text-[color:var(--text-muted)]"> Prices in ₹ (exclusive of GST).</span>}
          </p>
          <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-3">
            {plans.map((plan, i) => (
              <AnimateIn key={plan.id} delay={i * 0.08}>
                <div
                  className={[
                    "relative flex flex-col h-full rounded-2xl border-2 bg-white p-6",
                    "transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
                    "border-[color:var(--neutral-border)]",
                  ].join(" ")}
                >
                  {/* Icon + name + tagline */}
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--primary-blue)]/10 to-[var(--primary-purple)]/10">
                    <plan.icon size={20} className="text-[color:var(--primary-blue)]" />
                  </div>
                  <h3 className="font-display text-base font-bold text-[color:var(--text-primary)]">
                    {plan.name}
                  </h3>
                  <p className="mt-1 text-xs text-[color:var(--text-muted)] leading-relaxed">
                    {plan.tagline}
                  </p>

                  {/* Price */}
                  <div className="mt-5">
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-2xl font-bold text-[color:var(--text-primary)]">
                        {plan.price}
                      </span>
                      {plan.unit && <span className="text-xs text-[color:var(--text-muted)]">{plan.unit}</span>}
                    </div>
                    {plan.priceNote && (
                      <p className="mt-1 text-xs text-[color:var(--text-muted)]">{plan.priceNote}</p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="mt-5 space-y-2.5 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-[color:var(--text-secondary)]">
                        <Check size={13} strokeWidth={3} className="mt-0.5 shrink-0 text-emerald-500" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* CTA — the Pro link waits for auth to resolve so it never points
                       at the wrong place during hydration. */}
                  {isShared(plan.id) && loading ? (
                    <span
                      aria-disabled="true"
                      className="mt-6 flex w-full cursor-default items-center justify-center rounded-lg border border-[color:var(--neutral-border)] px-4 py-2.5 text-sm font-semibold text-[color:var(--text-muted)] opacity-70"
                    >
                      {plan.cta.label}
                    </span>
                  ) : (
                    <Link
                      href={ctaHref(plan)}
                      className={[
                        "mt-6 flex w-full items-center justify-center rounded-lg px-4 py-2.5",
                        "text-sm font-semibold transition-colors",
                        "border border-[color:var(--neutral-border)] text-[color:var(--text-primary)] hover:bg-[color:var(--bg-secondary)]",
                      ].join(" ")}
                    >
                      {plan.cta.label}
                    </Link>
                  )}
                </div>
              </AnimateIn>
            ))}
          </div>

          {/* Compute sizes — per container, on top of the container fee */}
          <div className="mx-auto mt-6 max-w-4xl">
            <p className="mb-3 text-xs font-medium text-[color:var(--text-muted)]">
              Compute sizes — chosen per container, on top of the container fee:
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {COMPUTE_ROWS.map((c) => (
                <div key={c.size} className="rounded-xl border border-[color:var(--neutral-border)] bg-white p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="font-display text-sm font-bold capitalize text-[color:var(--text-primary)]">
                      {c.size}{c.isDefault && <span className="ml-1.5 text-[10px] font-medium uppercase tracking-wide text-[color:var(--text-muted)]">default</span>}
                    </span>
                    <span className="text-xs font-semibold text-[color:var(--primary-blue)]">{c.delta}</span>
                  </div>
                  <p className="mt-1 text-xs text-[color:var(--text-muted)]">{c.specs}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Core services */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
            Individual Services
          </p>
          <p className="mb-8 text-sm text-[color:var(--text-secondary)]">
            À la carte resources — dedicated VMs and add-ons, no plan required. All prices in USD, billed monthly.
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

      </div>
    </section>
  );
}
