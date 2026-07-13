'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Database, Shield, Zap, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface AuthFeature {
  icon: LucideIcon;
  title: string;
  desc: string;
}

export interface AuthSplitLayoutProps {
  children: React.ReactNode;
  /** Right-panel branding — each brand passes its own; defaults to the combined set. */
  eyebrow?: string;
  title?: React.ReactNode;
  subtitle?: string;
  features?: AuthFeature[];
  logoSrc?: string;
  logoAlt?: string;
  logo?: React.ReactNode;
  trustText?: string;
  quote?: string;
  quoteAuthor?: string;
}

const DEFAULT_FEATURES: AuthFeature[] = [
  { icon: Database, title: 'Managed PostgreSQL', desc: 'Dedicated databases with automated backups, PITR, and zero noisy neighbours.' },
  { icon: Zap, title: 'Deploy in under 90 seconds', desc: 'From signup to a live backend with auth, APIs, and storage — no DevOps required.' },
  { icon: Shield, title: 'Enterprise-grade security', desc: 'Anti-DDoS, CIS audits, and security patching included in every plan.' },
  { icon: Users, title: 'AI Agents built-in', desc: '60+ agent templates across 15 industries. Deploy your first agent in minutes.' },
];

const DEFAULT_TITLE = (
  <>
    Backend + AI Agents.<br />
    <span className="text-cyan-300">One Platform.</span>
  </>
);

export function AuthSplitLayout({
  children,
  eyebrow = 'Rach Dev LLP',
  title = DEFAULT_TITLE,
  subtitle = 'Production-ready infrastructure and AI agent builder. Deploy in under 90 seconds — no DevOps, no complexity.',
  features = DEFAULT_FEATURES,
  logoSrc = '/brand/rach-dev-logo-side.svg',
  logoAlt = 'Rach Dev LLP',
  logo,
  trustText = 'Trusted by 10+ businesses',
  quote = 'From zero to a live backend in minutes. The dashboard, the support, the pricing — everything just works.',
  quoteAuthor = '— Rach Dev LLP Customer',
}: AuthSplitLayoutProps) {
  return (
    <div className="flex min-h-screen">

      {/* ── Left panel — form ───────────────────────────────────────────── */}
      <div className="flex w-full flex-col items-center justify-center bg-white px-6 py-12 lg:w-1/2 lg:px-12 xl:px-20">
        {/* Logo */}
        <div className="mb-8 w-full max-w-md">
          <Link href="/" className="inline-flex items-center" aria-label={`${logoAlt} home`}>
            {logo ?? <Image src={logoSrc} alt={logoAlt} width={160} height={32} className="h-8 w-auto" />}
          </Link>
        </div>

        {/* Form content */}
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>

      {/* ── Right panel — branding ──────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 xl:p-16"
        style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 40%, #7c3aed 100%)' }}
      >
        {/* Top — headline */}
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-200 mb-4">
            {eyebrow}
          </p>
          <h2 className="text-4xl font-bold font-display text-white leading-tight xl:text-5xl">
            {title}
          </h2>
          <p className="mt-4 text-lg text-blue-100 leading-relaxed max-w-md">
            {subtitle}
          </p>
        </div>

        {/* Middle — feature list */}
        <div className="space-y-5 my-10">
          {features.map((f) => (
            <div key={f.title} className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
                <f.icon size={18} className="text-cyan-300" />
              </div>
              <div>
                <p className="font-semibold text-white text-sm">{f.title}</p>
                <p className="mt-0.5 text-sm text-blue-200 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom — trust badge */}
        <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex -space-x-2">
              {['E', 'R', 'A'].map((l) => (
                <div key={l} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white/30 bg-gradient-to-br from-blue-400 to-purple-500 text-xs font-bold text-white">
                  {l}
                </div>
              ))}
            </div>
            <p className="text-sm text-blue-100">{trustText}</p>
          </div>
          <p className="text-sm text-white/80 italic leading-relaxed">
            &ldquo;{quote}&rdquo;
          </p>
          <p className="mt-2 text-xs text-blue-300 font-medium">{quoteAuthor}</p>
        </div>
      </div>

    </div>
  );
}
