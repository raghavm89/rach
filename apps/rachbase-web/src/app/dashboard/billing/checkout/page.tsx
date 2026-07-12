'use client';

import React, { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Server, Database, Globe, HardDrive, BarChart2, Activity, Loader2, ShieldCheck,
  RefreshCw, CheckCircle2, Clock, AlertCircle, Lock, MapPin, Phone, ChevronRight, Pencil, Calendar,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { expansion, CustomOrderItem } from '@rach/ui/lib/api';
import { cn } from '@rach/ui/lib/utils';

// ── Razorpay ──────────────────────────────────────────────────────────────────
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: new (opts: Record<string, unknown>) => { open(): void };
  }
}
function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.getElementById('rzp-script')) { resolve(true); return; }
    const s = document.createElement('script');
    s.id = 'rzp-script';
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

// ── Catalog (mirrors billing/page.tsx) ────────────────────────────────────────

type ServiceId = 'vm' | 'disk' | 'lb' | 'ip' | 'db' | 'obs' | 'mon';

const SERVICES: { id: ServiceId; name: string; specs: string; price: number; unit: string; Icon: React.ElementType; iconBg: string; iconColor: string }[] = [
  { id: 'vm',   name: 'Virtual Machine',                  specs: '2 vCPUs · 8 GB RAM · 50 GB SSD',                    price: 100,  unit: 'per VM / mo',       Icon: Server,   iconBg: 'bg-blue-50',   iconColor: 'text-primary-blue'  },
  { id: 'disk', name: 'Additional Disk',                  specs: 'Expandable block storage',                           price: 0.15, unit: 'per GB / mo',       Icon: HardDrive,iconBg: 'bg-blue-50',   iconColor: 'text-primary-blue'  },
  { id: 'lb',   name: 'Load Balancer',                    specs: 'Layer 4 / Layer 7 traffic distribution',             price:  25,  unit: 'per LB / mo',       Icon: Globe,    iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  { id: 'ip',   name: 'Additional Public IP',             specs: 'Static IPv4 address',                                price:  10,  unit: 'per IP / mo',       Icon: Globe,    iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  { id: 'db',   name: 'Managed PostgreSQL',               specs: 'WAL archival · daily backups · point-in-time recovery', price: 200, unit: 'per DB / mo',    Icon: Database, iconBg: 'bg-violet-50',  iconColor: 'text-violet-600'  },
  { id: 'obs',  name: 'VM Resource Observability',        specs: '24/7 real-time CPU, RAM, disk & network metrics',    price:  25,  unit: 'per VM / mo',       Icon: BarChart2,iconBg: 'bg-amber-50',  iconColor: 'text-amber-600'   },
  { id: 'mon',  name: 'Application Workload Monitoring',  specs: '24/7 endpoint observability & alerting',             price:  25,  unit: 'per endpoint / mo', Icon: Activity, iconBg: 'bg-amber-50',  iconColor: 'text-amber-600'   },
];

const BUNDLES: { id: string; name: string; price: number; originalPrice: number; items: Partial<Record<ServiceId, number>> }[] = [
  { id: 'starter', name: 'Starter Bundle', price:  295, originalPrice:  325, items: { vm: 1, lb: 1, db: 1 } },
  { id: 'growth',  name: 'Growth Bundle',  price:  800, originalPrice:  880, items: { vm: 3, lb: 1, db: 2, ip: 3, obs: 3 } },
  { id: 'scale',   name: 'Scale Bundle',   price: 1270, originalPrice: 1400, items: { vm: 5, lb: 1, db: 3, ip: 5, obs: 5 } },
];

// Returns start date (today) and the next recurring charge date (same day next month)
// displayed in IST context — Razorpay fires at 12:00 AM IST each cycle.
function getBillingDates() {
  const now = new Date();
  const next = new Date(now);
  next.setMonth(next.getMonth() + 1);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  return { startLabel: fmt(now), nextLabel: fmt(next) };
}

function usd(dollars: number) {
  const isWhole = Number.isInteger(dollars);
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface CartLine { label: string; qty: number; unitPrice: number }

interface Cart {
  lines: CartLine[];
  items: CustomOrderItem[];
  description: string;
  totalDollars: number;
  totalCents: number;
  originalDollars?: number;   // retail total before bundle discount
  saving?: number;            // amount saved
}

function buildCart(params: URLSearchParams): Cart | null {
  const planId = params.get('plan');

  if (planId) {
    const bundle = BUNDLES.find((b) => b.id === planId);
    if (!bundle) return null;
    const lines: CartLine[] = (Object.entries(bundle.items) as [ServiceId, number][])
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const svc = SERVICES.find((s) => s.id === id)!;
        return { label: svc.name, qty, unitPrice: svc.price };
      });
    const items: CustomOrderItem[] = (Object.entries(bundle.items) as [ServiceId, number][])
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const svc = SERVICES.find((s) => s.id === id)!;
        return { id: svc.id, name: svc.name, qty };
      });
    return {
      lines,
      items,
      description: bundle.name,
      totalDollars: bundle.price,
      totalCents: bundle.price * 100,
      originalDollars: bundle.originalPrice,
      saving: bundle.originalPrice - bundle.price,
    };
  }

  // Custom services
  const lines: CartLine[] = [];
  const items: CustomOrderItem[] = [];
  for (const svc of SERVICES) {
    const qty = parseInt(params.get(svc.id) ?? '0', 10);
    if (qty > 0) {
      lines.push({ label: svc.name, qty, unitPrice: svc.price });
      items.push({ id: svc.id, name: svc.name, qty });
    }
  }
  if (!lines.length) return null;
  const totalDollars = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const description = lines.map((l) => `${l.qty}× ${l.label}`).join(', ');
  return { lines, items, description, totalDollars, totalCents: totalDollars * 100 };
}

// ── Dial codes ────────────────────────────────────────────────────────────────

const DIAL_CODES = [
  { code: '+91',  country: 'India',          flag: '🇮🇳' },
  { code: '+1',   country: 'United States',  flag: '🇺🇸' },
  { code: '+1',   country: 'Canada',         flag: '🇨🇦' },
  { code: '+44',  country: 'United Kingdom', flag: '🇬🇧' },
  { code: '+65',  country: 'Singapore',      flag: '🇸🇬' },
  { code: '+61',  country: 'Australia',      flag: '🇦🇺' },
  { code: '+49',  country: 'Germany',        flag: '🇩🇪' },
  { code: '+971', country: 'UAE',            flag: '🇦🇪' },
  { code: '+33',  country: 'France',         flag: '🇫🇷' },
  { code: '+81',  country: 'Japan',          flag: '🇯🇵' },
  { code: '+86',  country: 'China',          flag: '🇨🇳' },
  { code: '+55',  country: 'Brazil',         flag: '🇧🇷' },
  { code: '+27',  country: 'South Africa',   flag: '🇿🇦' },
  { code: '+966', country: 'Saudi Arabia',   flag: '🇸🇦' },
  { code: '+60',  country: 'Malaysia',       flag: '🇲🇾' },
  { code: '+62',  country: 'Indonesia',      flag: '🇮🇩' },
  { code: '+63',  country: 'Philippines',    flag: '🇵🇭' },
  { code: '+64',  country: 'New Zealand',    flag: '🇳🇿' },
  { code: '+82',  country: 'South Korea',    flag: '🇰🇷' },
  { code: '+39',  country: 'Italy',          flag: '🇮🇹' },
  { code: '+34',  country: 'Spain',          flag: '🇪🇸' },
  { code: '+31',  country: 'Netherlands',    flag: '🇳🇱' },
  { code: '+46',  country: 'Sweden',         flag: '🇸🇪' },
  { code: '+41',  country: 'Switzerland',    flag: '🇨🇭' },
  { code: '+7',   country: 'Russia',         flag: '🇷🇺' },
  { code: '+92',  country: 'Pakistan',       flag: '🇵🇰' },
  { code: '+880', country: 'Bangladesh',     flag: '🇧🇩' },
  { code: '+94',  country: 'Sri Lanka',      flag: '🇱🇰' },
  { code: '+977', country: 'Nepal',          flag: '🇳🇵' },
];

// Infer default dial code from billing country
function dialCodeForCountry(country: string) {
  return DIAL_CODES.find((d) => d.country === country) ?? DIAL_CODES[0];
}

// ── Phone field with dial code picker ────────────────────────────────────────

function PhoneField({
  value, onChange, country, inputCls,
}: {
  value: string;
  onChange: (full: string) => void;
  country: string;
  inputCls: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState(() => dialCodeForCountry(country));
  const [number, setNumber] = React.useState('');
  const ref = React.useRef<HTMLDivElement>(null);

  // Sync selected dial code when billing country changes
  React.useEffect(() => {
    setSelected(dialCodeForCountry(country));
  }, [country]);

  // Parse existing value (e.g. saved phone "+91 98765") into parts
  React.useEffect(() => {
    if (!value) return;
    const match = DIAL_CODES.find((d) => value.startsWith(d.code));
    if (match) {
      setSelected(match);
      setNumber(value.slice(match.code.length).trimStart());
    } else {
      setNumber(value);
    }
  // run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep parent in sync
  React.useEffect(() => {
    onChange(number ? `${selected.code} ${number}` : '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, number]);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div className="flex gap-0" ref={ref}>
      {/* Dial code button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 h-full rounded-l-lg border border-r-0 border-neutral-border bg-bg-secondary px-3 py-3 text-sm text-text-primary hover:bg-neutral-100 transition-colors whitespace-nowrap"
        >
          <span className="text-base leading-none">{selected.flag}</span>
          <span className="font-mono text-xs text-text-secondary">{selected.code}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" className="text-text-muted"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
        </button>

        {open && (
          <div className="absolute left-0 top-full z-50 mt-1 w-60 max-h-56 overflow-y-auto rounded-xl border border-neutral-border bg-white shadow-lg py-1">
            {DIAL_CODES.map((d, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setSelected(d); setOpen(false); }}
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-bg-secondary transition-colors text-left',
                  selected.country === d.country && selected.code === d.code ? 'bg-blue-50 text-primary-blue' : 'text-text-primary',
                )}
              >
                <span className="text-base shrink-0">{d.flag}</span>
                <span className="flex-1 truncate text-xs">{d.country}</span>
                <span className="font-mono text-xs text-text-muted shrink-0">{d.code}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Number input */}
      <input
        type="tel"
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        placeholder={
          selected.code === '+91'  ? '98765 43210' :
          selected.code === '+1'   ? '415 555 0100' :
          selected.code === '+44'  ? '7700 900000' :
          selected.code === '+65'  ? '9123 4567' :
          selected.code === '+61'  ? '412 345 678' :
          selected.code === '+49'  ? '151 12345678' :
          selected.code === '+971' ? '50 123 4567' :
          'Mobile number'
        }
        required
        className={cn(inputCls, 'rounded-l-none border-l-0')}
      />
    </div>
  );
}

// ── Billing info ──────────────────────────────────────────────────────────────

interface BillingInfo {
  name    : string;
  email   : string;
  phone   : string;
  company : string;
  gstin   : string;
  line1   : string;
  line2   : string;
  city    : string;
  state   : string;
  pincode : string;
  country : string;
}

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal',
  'Andaman & Nicobar Islands','Chandigarh','Dadra & Nagar Haveli and Daman & Diu',
  'Delhi','Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry',
];

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire',
  'New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio',
  'Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
  'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
  'Wisconsin','Wyoming','District of Columbia',
];

const STATES_BY_COUNTRY: Record<string, string[]> = {
  'India': INDIAN_STATES,
  'United States': US_STATES,
};

// ── Step screens ──────────────────────────────────────────────────────────────

type Step = 'billing' | 'review' | 'processing' | 'success' | 'error';

function CheckoutInner() {
  const { user, token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>('billing');
  const [errMsg, setErr] = useState('');
  const [billingErr, setBillingErr] = useState('');

  // Prefill from saved profile billing_address + business info
  const savedAddr = user?.billing_address;
  const [billing, setBilling] = useState<BillingInfo>({
    name   : user?.name         || '',
    email  : user?.email        || '',
    phone  : user?.phone_number || '',
    company: user?.business_name || '',
    gstin  : user?.gstin         || '',
    line1  : savedAddr?.line1   || '',
    line2  : savedAddr?.line2   || '',
    city   : savedAddr?.city    || '',
    state  : savedAddr?.state   || '',
    pincode: savedAddr?.pincode || '',
    country: savedAddr?.country || 'India',
  });

  // If no saved address, prefill country/city/state/pincode from IP geolocation
  useEffect(() => {
    if (savedAddr?.country) return; // already have saved address — skip
    let cancelled = false;
    fetch('https://ipapi.co/json/')
      .then((r) => r.json())
      .then((geo) => {
        if (cancelled) return;
        // Map ISO country name from ipapi to our dropdown labels
        const COUNTRY_MAP: Record<string, string> = {
          'IN': 'India',
          'US': 'United States',
          'GB': 'United Kingdom',
          'SG': 'Singapore',
          'AU': 'Australia',
          'CA': 'Canada',
          'DE': 'Germany',
          'AE': 'UAE',
        };
        const country = COUNTRY_MAP[geo.country_code] || geo.country_name || '';
        const city    = geo.city    || '';
        const region  = geo.region  || ''; // state/province name
        const pincode = geo.postal  || '';
        setBilling((prev) => ({
          ...prev,
          country: prev.country || country,
          city   : prev.city    || city,
          state  : prev.state   || region,
          pincode: prev.pincode || pincode,
        }));
      })
      .catch(() => {}); // fail silently — user can fill manually
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setField = (k: keyof BillingInfo) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.value;
    setBilling((prev) => ({
      ...prev,
      [k]: value,
      // Reset state whenever country changes
      ...(k === 'country' ? { state: '' } : {}),
    }));
  };

  const handleContinue = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setBillingErr('');
    const required: (keyof BillingInfo)[] = ['name', 'email', 'phone', 'line1', 'city', 'state', 'pincode', 'country'];
    const missing = required.find((k) => !billing[k].trim());
    if (missing) { setBillingErr('Please fill in all required fields.'); return; }
    if (billing.country === 'India' && billing.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(billing.gstin.toUpperCase())) {
      setBillingErr('Invalid GSTIN format.'); return;
    }
    setStep('review');
  }, [billing]);

  const cart = buildCart(searchParams);

  useEffect(() => {
    if (!cart) router.replace('/dashboard/billing');
  }, [cart, router]);

  const handleSubscribe = useCallback(async () => {
    if (!token || !cart) return;
    setStep('processing');
    setErr('');

    try {
      // Step 1: create plan + subscription on backend
      const orderData = await expansion.createSubscription(token, {
        items           : cart.items,
        description     : cart.description,
        total_cents     : cart.totalCents,
        currency        : 'USD',
        billing_country : billing.country,
      });

      if (!orderData.razorpay_key_id) {
        throw new Error('Payment gateway is not configured. Please add valid RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the backend .env and restart the server.');
      }

      const loaded = await loadRazorpay();
      if (!loaded) throw new Error('Failed to load Razorpay checkout. Please try again.');

      // Step 2: open Razorpay subscription checkout
      const payment = await new Promise<Record<string, string>>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key            : orderData.razorpay_key_id,
          subscription_id: orderData.subscription_id,
          name           : 'Rach Dev LLP',
          description    : cart.description,
          prefill        : { email: billing.email, name: billing.name, contact: billing.phone },
          theme          : { color: '#2563EB' },
          handler        : (resp: Record<string, string>) => resolve(resp),
          modal          : { ondismiss: () => { setStep('review'); reject(new Error('dismissed')); } },
        });
        rzp.open();
      });

      // Step 3: confirm on backend → create DB record
      await expansion.activateSubscription(token, {
        razorpay_subscription_id: payment.razorpay_subscription_id,
        razorpay_payment_id     : payment.razorpay_payment_id,
        razorpay_signature      : payment.razorpay_signature,
        razorpay_plan_id        : orderData.plan_id ?? undefined,
        items                   : cart.items,
        description             : cart.description,
        total_cents             : cart.totalCents,
        currency                : orderData.currency,
        billing_currency        : orderData.billing_currency,
        monthly_amount          : orderData.monthly_amount,
      });

      setStep('success');
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === 'dismissed') return; // user closed modal — stay on review
      setErr(msg || 'Something went wrong. Please try again.');
      setStep('error');
    }
  }, [token, cart, billing.email, billing.name, billing.phone, billing.country]);

  if (!cart) return null;

  // ── Success ─────────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="max-w-lg mx-auto py-16">
        <div className="rounded-2xl border border-neutral-border bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 size={32} className="text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-text-primary">Subscription Active!</h2>
          <p className="mt-2 text-sm text-text-muted">
            Your <strong>{cart.description}</strong> subscription is confirmed.
            Resources will be provisioned to your tenant within 24 hours.
          </p>

          <div className="mt-6 rounded-xl bg-bg-secondary p-4 text-left space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Plan</span>
              <span className="font-medium text-text-primary">{cart.description}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Billing</span>
              <span className="font-medium text-text-primary">Monthly · auto-renews</span>
            </div>
            <div className="flex justify-between text-sm border-t border-neutral-border pt-2">
              <span className="font-semibold text-text-primary">Total</span>
              <span className="font-bold text-text-primary font-mono">{usd(cart.totalDollars)}/mo</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Status</span>
              <span className="inline-flex items-center gap-1 text-amber-700 font-semibold text-xs">
                <Clock size={11} /> Pending provisioning
              </span>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Link
              href="/dashboard/orders"
              className="flex-1 rounded-lg border border-neutral-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-bg-secondary transition-colors text-center"
            >
              View Orders
            </Link>
            <Link
              href="/dashboard/vm-monitor"
              className="flex-1 rounded-lg bg-gradient-to-r from-primary-blue to-primary-purple px-4 py-2.5 text-sm font-semibold text-white text-center hover:opacity-90 transition-opacity"
            >
              VM Monitor
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Processing overlay ───────────────────────────────────────────────────────
  if (step === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 size={36} className="animate-spin text-primary-blue" />
        <p className="text-sm text-text-muted">Setting up your subscription…</p>
      </div>
    );
  }

  // ── Billing info step ────────────────────────────────────────────────────────
  const inputCls = 'w-full rounded-lg border border-neutral-border bg-white px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-primary-blue focus:ring-2 focus:ring-blue-500/20 transition-colors';
  const labelCls = 'block text-xs font-medium text-text-secondary mb-1';

  if (step === 'billing') {
    return (
      <div className="max-w-2xl space-y-6">
        <Link href="/dashboard/billing" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft size={14} /> Back to Plans
        </Link>

        {/* Progress */}
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-primary-blue">1. Billing Info</span>
          <ChevronRight size={13} className="text-text-muted" />
          <span className="text-text-muted">2. Review &amp; Pay</span>
        </div>

        <div>
          <h2 className="text-2xl font-bold font-display text-text-primary">Billing Information</h2>
          <p className="mt-1 text-sm text-text-muted">Used for your invoice and payment records.</p>
        </div>

        {billingErr && (
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertCircle size={15} className="shrink-0" /> {billingErr}
          </div>
        )}

        <form onSubmit={handleContinue} className="space-y-5">

          {/* Contact details */}
          <div className="rounded-2xl border border-neutral-border bg-white overflow-hidden">
            <div className="border-b border-neutral-border px-6 py-4 flex items-center gap-2">
              <Phone size={14} className="text-primary-blue" />
              <h3 className="text-sm font-semibold text-text-primary">Contact Details</h3>
            </div>
            <div className="p-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Full Name <span className="text-red-400">*</span></label>
                <input className={inputCls} value={billing.name} onChange={setField('name')} placeholder="Jane Smith" required />
              </div>
              <div>
                <label className={labelCls}>Email <span className="text-red-400">*</span></label>
                <input className={inputCls} type="email" value={billing.email} onChange={setField('email')} placeholder="jane@company.com" required />
              </div>
              <div>
                <label className={labelCls}>Phone <span className="text-red-400">*</span></label>
                <PhoneField
                  value={billing.phone}
                  onChange={(v) => setBilling((prev) => ({ ...prev, phone: v }))}
                  country={billing.country}
                  inputCls={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Company / Organisation <span className="text-xs text-text-muted font-normal">(optional)</span></label>
                <input className={inputCls} value={billing.company} onChange={setField('company')} placeholder="Acme Pvt Ltd" />
              </div>
              <div className="sm:col-span-2">
                {billing.country === 'India' && <>
                  <label className={labelCls}>GSTIN <span className="text-xs text-text-muted font-normal">(optional — for GST invoice)</span></label>
                  <input className={inputCls} value={billing.gstin} onChange={setField('gstin')} placeholder="22AAAAA0000A1Z5" maxLength={15} style={{ textTransform: 'uppercase' }} />
                </>}
              </div>
            </div>
          </div>

          {/* Billing address */}
          <div className="rounded-2xl border border-neutral-border bg-white overflow-hidden">
            <div className="border-b border-neutral-border px-6 py-4 flex items-center gap-2">
              <MapPin size={14} className="text-primary-blue" />
              <h3 className="text-sm font-semibold text-text-primary">Billing Address</h3>
            </div>
            <div className="p-6 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelCls}>Address Line 1 <span className="text-red-400">*</span></label>
                <input className={inputCls} value={billing.line1} onChange={setField('line1')} placeholder="Street address, building, flat no." required />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Address Line 2 <span className="text-xs text-text-muted font-normal">(optional)</span></label>
                <input className={inputCls} value={billing.line2} onChange={setField('line2')} placeholder="Area, landmark" />
              </div>
              <div>
                <label className={labelCls}>City <span className="text-red-400">*</span></label>
                <input className={inputCls} value={billing.city} onChange={setField('city')} placeholder="Mumbai" required />
              </div>
              <div>
                <label className={labelCls}>State / Province <span className="text-red-400">*</span></label>
                {STATES_BY_COUNTRY[billing.country] ? (
                  <select className={inputCls} value={billing.state} onChange={setField('state')} required>
                    <option value="">Select state</option>
                    {STATES_BY_COUNTRY[billing.country].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <input className={inputCls} value={billing.state} onChange={setField('state')} placeholder="State / Province / Region" required />
                )}
              </div>
              <div>
                <label className={labelCls}>
                  {billing.country === 'India' ? 'PIN Code' : 'ZIP / Postal Code'}
                  {' '}<span className="text-red-400">*</span>
                </label>
                <input
                  className={inputCls}
                  value={billing.pincode}
                  onChange={setField('pincode')}
                  placeholder={
                    billing.country === 'India'          ? '400001' :
                    billing.country === 'United States'  ? '10001'  :
                    billing.country === 'United Kingdom' ? 'SW1A 1AA' :
                    billing.country === 'Canada'         ? 'M5H 2N2' :
                    billing.country === 'Australia'      ? '2000'   :
                    billing.country === 'Singapore'      ? '018989' :
                    billing.country === 'Germany'        ? '10115'  :
                    billing.country === 'UAE'            ? '00000'  :
                    'Postal code'
                  }
                  maxLength={10}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Country <span className="text-red-400">*</span></label>
                <select className={inputCls} value={billing.country} onChange={setField('country')} required>
                  {['India','United States','United Kingdom','Singapore','Australia','Canada','Germany','UAE'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-blue to-primary-purple px-5 py-3.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Continue to Review <ChevronRight size={15} />
          </button>
        </form>
      </div>
    );
  }

  // ── Review / error ───────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl space-y-6">
      <Link
        href="/dashboard/billing"
        className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors"
      >
        <ArrowLeft size={14} /> Back to Plans
      </Link>

      {/* Progress */}
      <div className="flex items-center gap-2 text-xs">
        <button onClick={() => setStep('billing')} className="font-medium text-text-muted hover:text-primary-blue transition-colors">1. Billing Info</button>
        <ChevronRight size={13} className="text-text-muted" />
        <span className="font-semibold text-primary-blue">2. Review &amp; Pay</span>
      </div>

      <div>
        <h2 className="text-2xl font-bold font-display text-text-primary">Confirm Subscription</h2>
        <p className="mt-1 text-sm text-text-muted">Review your plan and complete payment to activate.</p>
      </div>

      {step === 'error' && errMsg && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
          <AlertCircle size={16} className="shrink-0" />
          {errMsg}
          <button onClick={() => setStep('review')} className="ml-auto text-xs underline">Try again</button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">

        {/* Left — order breakdown */}
        <div className="space-y-4">

          {/* Billing address summary */}
          <div className="rounded-2xl border border-neutral-border bg-white overflow-hidden">
            <div className="border-b border-neutral-border px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-primary-blue" />
                <h3 className="text-sm font-semibold text-text-primary">Billing Details</h3>
              </div>
              <button
                onClick={() => setStep('billing')}
                className="inline-flex items-center gap-1 text-xs text-primary-blue hover:underline"
              >
                <Pencil size={11} /> Edit
              </button>
            </div>
            <div className="px-6 py-4 grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div>
                <p className="text-xs text-text-muted mb-0.5">Name</p>
                <p className="font-medium text-text-primary">{billing.name}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted mb-0.5">Email</p>
                <p className="font-medium text-text-primary">{billing.email}</p>
              </div>
              {billing.phone && (
                <div>
                  <p className="text-xs text-text-muted mb-0.5">Phone</p>
                  <p className="font-medium text-text-primary">{billing.phone}</p>
                </div>
              )}
              {billing.company && (
                <div>
                  <p className="text-xs text-text-muted mb-0.5">Company</p>
                  <p className="font-medium text-text-primary">{billing.company}</p>
                </div>
              )}
              {billing.gstin && (
                <div>
                  <p className="text-xs text-text-muted mb-0.5">GSTIN</p>
                  <p className="font-medium text-text-primary font-mono text-xs">{billing.gstin.toUpperCase()}</p>
                </div>
              )}
              <div className="sm:col-span-2">
                <p className="text-xs text-text-muted mb-0.5">Address</p>
                <p className="font-medium text-text-primary">
                  {billing.line1}{billing.line2 ? `, ${billing.line2}` : ''}, {billing.city}, {billing.state} — {billing.pincode}, {billing.country}
                </p>
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="rounded-2xl border border-neutral-border bg-white overflow-hidden">
            <div className="border-b border-neutral-border px-6 py-4">
              <h3 className="text-sm font-semibold text-text-primary">Order Details</h3>
            </div>
            <div className="divide-y divide-neutral-border">
              {cart.lines.map((line) => {
                const svc = SERVICES.find((s) => s.name === line.label);
                return (
                  <div key={line.label} className="flex items-center gap-4 px-6 py-4">
                    {svc && (
                      <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl shrink-0', svc.iconBg)}>
                        <svc.Icon size={16} className={svc.iconColor} />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text-primary">{line.label}</p>
                      {svc && <p className="text-xs text-text-muted">{svc.specs}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold font-mono text-text-primary">
                        {usd(line.unitPrice * line.qty)}
                      </p>
                      {line.qty > 1 && (
                        <p className="text-xs text-text-muted">{line.qty} × {usd(line.unitPrice)}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {cart.saving && (
              <div className="flex items-center justify-between px-6 py-3 bg-emerald-50 border-t border-emerald-100">
                <span className="text-sm font-medium text-emerald-700">Bundle discount</span>
                <div className="text-right">
                  <span className="text-sm font-bold text-emerald-700">−{usd(cart.saving)}</span>
                  <span className="ml-2 text-xs text-emerald-600 line-through">{usd(cart.originalDollars!)}</span>
                </div>
              </div>
            )}
            <div className="border-t-2 border-neutral-border px-6 py-4 flex justify-between items-center">
              <span className="font-semibold text-text-primary">Monthly Total</span>
              <span className="text-2xl font-bold font-mono text-text-primary">{usd(cart.totalDollars)}<span className="text-sm font-normal text-text-muted">/mo</span></span>
            </div>
          </div>

          {/* How billing works */}
          <div className="rounded-2xl border border-neutral-border bg-white p-5 space-y-3">
            <h3 className="text-sm font-semibold text-text-primary mb-1">How billing works</h3>
            {[
              { icon: <RefreshCw size={14} />, text: 'Razorpay auto-debits your saved payment method at 12:00 AM IST on the same date each month.' },
              { icon: <ShieldCheck size={14} />, text: 'Cancel anytime from your Orders page. Your subscription stays active until the end of the current billing cycle.' },
            ].map((item) => (
              <div key={item.text} className="flex items-start gap-3 text-sm text-text-secondary">
                <span className="text-primary-blue mt-0.5 shrink-0">{item.icon}</span>
                {item.text}
              </div>
            ))}
          </div>
        </div>

        {/* Right — payment CTA */}
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-primary-blue/20 bg-gradient-to-br from-primary-blue/5 to-primary-purple/5 p-6">
            <h3 className="font-semibold text-text-primary mb-4">Payment Summary</h3>

            <div className="space-y-2 mb-5">
              {cart.lines.map((l) => (
                <div key={l.label} className="flex justify-between text-sm">
                  <span className="text-text-muted">{l.qty > 1 ? `${l.qty}× ` : ''}{l.label}</span>
                  <span className="font-medium font-mono">{usd(l.unitPrice * l.qty)}</span>
                </div>
              ))}
              {cart.saving && (
                <div className="flex justify-between text-sm font-semibold text-emerald-600 border-t border-neutral-border pt-2">
                  <span>Bundle discount</span>
                  <span>−{usd(cart.saving)}</span>
                </div>
              )}
              <div className={cn('border-t border-neutral-border pt-2 flex justify-between items-center', cart.saving && 'border-dashed')}>
                <div>
                  <p className="text-sm font-medium text-text-primary">Monthly</p>
                  <p className="text-xs text-text-muted">Recurring · auto-renews</p>
                </div>
                <span className="font-bold text-lg font-mono text-text-primary">
                  {usd(cart.totalDollars)}<span className="text-xs font-normal text-text-muted">/mo</span>
                </span>
              </div>
            </div>

            <button
              onClick={handleSubscribe}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-blue to-primary-purple px-5 py-4 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              <Lock size={14} />
              Subscribe — {usd(cart.totalDollars)}/mo
            </button>

            <p className="mt-3 text-center text-xs text-text-muted flex items-center justify-center gap-1">
              <ShieldCheck size={11} className="text-emerald-500" />
              Secured by Razorpay · 256-bit encryption
            </p>
          </div>

          {/* Billing schedule */}
          {(() => {
            const { startLabel, nextLabel } = getBillingDates();
            return (
              <div className="rounded-2xl border border-primary-blue/20 bg-gradient-to-br from-primary-blue/5 to-primary-purple/5 overflow-hidden">
                <div className="border-b border-primary-blue/15 px-5 py-3 flex items-center gap-2">
                  <Calendar size={13} className="text-primary-blue" />
                  <h3 className="text-sm font-semibold text-text-primary">Billing Schedule</h3>
                </div>
                <div className="px-5 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <Clock size={13} className="text-primary-blue shrink-0" />
                      Subscription starts
                    </div>
                    <span className="text-sm font-semibold text-text-primary">{startLabel}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <RefreshCw size={13} className="text-primary-blue shrink-0" />
                      Next charge
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-text-primary">{nextLabel}</p>
                      <p className="text-xs text-text-muted">at 12:00 AM IST</p>
                    </div>
                  </div>
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700 leading-relaxed">
                    <strong>Recurring payment:</strong> You will be auto-charged{' '}
                    <strong>{usd(cart.totalDollars)}/mo</strong> every month at 12:00 AM IST on the same date.
                    Cancel before <strong>{nextLabel}</strong> to avoid the next charge.
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="rounded-xl border border-neutral-border bg-white p-4 text-xs text-text-muted space-y-1">
            <p className="font-medium text-text-secondary">What happens next</p>
            <ol className="list-decimal list-inside space-y-1 ml-1">
              <li>Razorpay confirms your payment.</li>
              <li>Your order appears in <Link href="/dashboard/orders" className="text-primary-blue hover:underline">Orders</Link> as <em>Pending</em>.</li>
              <li>Our team provisions resources within 24 hours.</li>
              <li>Status changes to <em>Fulfilled</em> once live.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutInner />
    </Suspense>
  );
}
