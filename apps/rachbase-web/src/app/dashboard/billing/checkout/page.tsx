'use client';

import React, { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Server, Database, Globe, HardDrive, BarChart2, Activity, Loader2, ShieldCheck,
  RefreshCw, CheckCircle2, Clock, AlertCircle, Lock, MapPin, Phone, ChevronRight, Pencil, Calendar,
  FileText, LineChart,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { useCart } from '@rach/ui/contexts/CartContext';
import { expansion, invoices as invoicesApi, site, projects, CustomOrderItem, type TaxQuote } from '@rach/ui/lib/api';
import { SERVICES as CATALOG_SERVICES, BUNDLES as CATALOG_BUNDLES, PRO } from '@rach/ui/lib/catalog';
import { TaxSummary } from '@rach/ui/components/billing/TaxSummary';
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

type ServiceId = string;

/**
 * Catalog comes from the shared module, which reads the same catalog.json the
 * server prices from. Prices below are DISPLAY ONLY — the server re-prices the
 * cart from `bundle_id` / `items` and ignores any total this page computes.
 */
const SERVICE_ICONS: Record<string, { Icon: React.ElementType; iconBg: string; iconColor: string }> = {
  vm:   { Icon: Server,    iconBg: 'bg-blue-50',    iconColor: 'text-primary-blue' },
  svc:  { Icon: Server,    iconBg: 'bg-blue-50',    iconColor: 'text-primary-blue' },
  disk: { Icon: HardDrive, iconBg: 'bg-blue-50',    iconColor: 'text-primary-blue' },
  lb:   { Icon: Globe,     iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  ip:   { Icon: Globe,     iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  db:   { Icon: Database,  iconBg: 'bg-violet-50',  iconColor: 'text-violet-600' },
  obs:  { Icon: BarChart2, iconBg: 'bg-amber-50',   iconColor: 'text-amber-600' },
  mon:  { Icon: Activity,  iconBg: 'bg-amber-50',   iconColor: 'text-amber-600' },
  logs: { Icon: FileText,  iconBg: 'bg-surface-hover',   iconColor: 'text-slate-500' },
  analytics: { Icon: LineChart, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
};

const SERVICES = CATALOG_SERVICES.map((s) => ({
  id: s.id as ServiceId,
  name: s.name,
  specs: s.specs,
  /** Dollars, for display. Cents are authoritative — see `priceCents`. */
  price: s.unit_price_cents / 100,
  priceCents: s.unit_price_cents,
  unit: s.unit,
  ...(SERVICE_ICONS[s.id] ?? { Icon: Server, iconBg: 'bg-blue-50', iconColor: 'text-primary-blue' }),
}));

const BUNDLES = CATALOG_BUNDLES.map((b) => ({
  id: b.id,
  name: b.name,
  price: b.price_cents / 100,
  priceCents: b.price_cents,
  /** Derived from contents, not stored — see packages/ui/src/lib/catalog.ts */
  originalPrice: b.listPriceCents / 100,
  saving: b.savingCents / 100,
  items: b.items as Partial<Record<ServiceId, number>>,
}));

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

function fmtMoney(amount: number, currency = 'USD') {
  const isWhole = Number.isInteger(amount);
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency', currency,
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface CartLine { label: string; qty: number; unitPrice: number }

interface Cart {
  lines: CartLine[];
  items: CustomOrderItem[];
  description: string;
  /** Display only — the server prices the order from `bundleId` / `items`. */
  totalDollars: number;
  totalCents: number;
  /** Present for a bundle: the server re-derives the price from this id. */
  bundleId?: string;
  originalDollars?: number;   // retail total before bundle discount
  saving?: number;            // amount saved
  /** Display currency (Pro can be INR). Defaults to USD. */
  currency?: string;
  /** Pro carts only: the canonical USD amount (minor units), for reactive currency conversion. */
  usdMinor?: number;
  /** Present for a Pro product: base subscription, a container, or a BaaS backend resize. */
  pro?: { kind: 'base' | 'container' | 'baas'; tier?: 'starter' | 'pro'; serviceId?: number; projectId?: number; size?: string };
}

function buildCart(params: URLSearchParams): Cart | null {
  // Pro products (`?pro=base` / `?pro=container`) — amount + currency are quoted server-
  // side and passed in for DISPLAY; the server re-prices at pay, so a tampered amount
  // cannot change the charge.
  const pro = params.get('pro');
  // Pro/BaaS amounts are GEO-NATIVE: the amount + currency were quoted server-side (from the
  // tenant's billing region) and are shown as-is. The server re-prices at pay, so a tampered
  // amount can't change the charge; GST (India) is added by the server tax quote at review.
  if (pro === 'baas') {
    const amountMinor = parseInt(params.get('amount') ?? '0', 10);
    const currency = (params.get('currency') ?? 'USD').toUpperCase();
    const size = params.get('size') ?? 'nano';
    const name = params.get('name') ?? '';
    const label = `Backend compute upgrade${name ? `: ${name}` : ''} (${size})`;
    return {
      lines: [{ label, qty: 1, unitPrice: amountMinor / 100 }],
      items: [],
      description: label,
      totalDollars: amountMinor / 100,
      totalCents: amountMinor,
      currency,
      pro: { kind: 'baas', projectId: Number(params.get('project')) || undefined, size },
    };
  }
  if (pro === 'base' || pro === 'container') {
    const amountMinor = parseInt(params.get('amount') ?? '0', 10);
    const currency = (params.get('currency') ?? 'USD').toUpperCase();
    const size = params.get('size') ?? 'nano';
    const name = params.get('name') ?? '';
    const tier = (params.get('tier') === 'pro' ? 'pro' : 'starter') as 'starter' | 'pro';
    const tierLabel = PRO.tiers[tier]?.label ?? 'Starter';
    const label = pro === 'base' ? `RachBase ${tierLabel} — monthly base` : `Container: ${name || 'service'} (${size})`;
    return {
      lines: [{ label, qty: 1, unitPrice: amountMinor / 100 }],
      items: [],
      description: label,
      totalDollars: amountMinor / 100,
      totalCents: amountMinor,
      currency,
      pro: { kind: pro, tier, serviceId: Number(params.get('service')) || undefined, projectId: Number(params.get('project')) || undefined, size },
    };
  }

  // `?bundle=` is what the pricing page links with; `?plan=` is the older
  // dashboard link. Accept both.
  const planId = params.get('bundle') ?? params.get('plan');

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
      bundleId: bundle.id,
      totalDollars: bundle.price,
      totalCents: bundle.priceCents,
      originalDollars: bundle.originalPrice,
      saving: bundle.saving,
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

  // Sum in integer cents. Summing dollars and multiplying by 100 produced
  // non-integer amounts (7 GB of disk at $0.15 → 104.99999999999999 cents),
  // which then went to Razorpay as an order amount.
  const totalCents = SERVICES.reduce((sum, svc) => {
    const qty = parseInt(params.get(svc.id) ?? '0', 10);
    return qty > 0 ? sum + svc.priceCents * qty : sum;
  }, 0);

  const description = lines.map((l) => `${l.qty}× ${l.label}`).join(', ');
  return { lines, items, description, totalDollars: totalCents / 100, totalCents };
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

// Format the national number for display. US/Canada (+1) uses (XXX) XXX-XXXX; other
// countries are left as typed.
function formatNationalNumber(input: string, dialCode: string): string {
  if (dialCode !== '+1') return input;
  const d = input.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
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

  // Re-apply the national format whenever the dial code changes (e.g. → +1 US).
  React.useEffect(() => {
    setNumber((n) => formatNationalNumber(n, selected.code));
  }, [selected.code]);

  // Parse existing value (e.g. saved phone "+91 98765") into parts
  React.useEffect(() => {
    if (!value) return;
    const match = DIAL_CODES.find((d) => value.startsWith(d.code));
    if (match) {
      setSelected(match);
      setNumber(formatNationalNumber(value.slice(match.code.length).trimStart(), match.code));
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
          className="flex items-center gap-1.5 h-full rounded-l-lg border border-r-0 border-neutral-border bg-bg-secondary px-3 py-3 text-sm text-text-primary hover:bg-surface-hover transition-colors whitespace-nowrap"
        >
          <span className="text-base leading-none">{selected.flag}</span>
          <span className="font-mono text-xs text-text-secondary">{selected.code}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" className="text-text-muted"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
        </button>

        {open && (
          <div className="absolute left-0 top-full z-50 mt-1 w-60 max-h-56 overflow-y-auto rounded-xl border border-neutral-border bg-surface-card shadow-lg py-1">
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
        onChange={(e) => setNumber(formatNationalNumber(e.target.value, selected.code))}
        placeholder={
          selected.code === '+91'  ? '98765 43210' :
          selected.code === '+1'   ? '(415) 555-0100' :
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
  const { user, token, updateUser } = useAuth();
  const { clear: clearCart } = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();
  // ISO country from GeoIP (where the user physically is) — gates the GSTIN field.

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

  // GeoIP is a PREFILL convenience only — it no longer gates anything (the GSTIN field and
  // all tax/currency decisions key on the BILLING country the customer confirms). Skip the
  // lookup entirely when a saved billing address already provides the prefill.
  useEffect(() => {
    let cancelled = false;
    if (savedAddr?.country) return () => { cancelled = true; }; // saved address wins — no lookup needed
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

  const rawCart = buildCart(searchParams);

  // Pro/BaaS carts are geo-native (amount already in the tenant's region currency), so they
  // are shown as-is — GST for India is added by the server tax quote at review. Legacy carts
  // that still carry a USD-pegged `usdMinor` follow the typed billing address for display.
  const cart: Cart | null = (() => {
    if (!rawCart || !rawCart.pro || rawCart.usdMinor == null) return rawCart;
    const displayCurrency = billing.country === 'India' ? 'INR' : 'USD';
    const minor = displayCurrency === 'INR' ? rawCart.usdMinor * PRO.inr_per_usd : rawCart.usdMinor;
    return {
      ...rawCart,
      currency: displayCurrency,
      totalCents: minor,
      totalDollars: minor / 100,
      lines: rawCart.lines.map((l) => ({ ...l, unitPrice: minor / 100 })),
    };
  })();

  // Currency-aware money formatter (Pro India carts are INR; everything else USD).
  const money = (amount: number) => fmtMoney(amount, cart?.currency ?? 'USD');

  // "Back" returns where the user came from: a container checkout came from its service
  // page; everything else came from the Plans page.
  const back = (cart?.pro?.kind === 'container' && cart.pro.projectId && cart.pro.serviceId)
    ? { href: `/dashboard/projects/${cart.pro.projectId}/services/${cart.pro.serviceId}`, label: 'Back to service' }
    : (cart?.pro?.kind === 'baas' && cart.pro.projectId)
    ? { href: `/dashboard/projects/${cart.pro.projectId}`, label: 'Back to project' }
    : { href: '/dashboard/billing', label: 'Back to Plans' };

  useEffect(() => {
    if (!cart) router.replace('/dashboard/billing');
  }, [cart, router]);

  // ── Server-side tax quote ───────────────────────────────────────────────────
  // The client never computes tax. We send the priced lines and the billing
  // address; the server decides the treatment (GST intra/inter-state, zero-rated
  // export, US sales tax where registered) and returns the authoritative total.
  const [taxQuote, setTaxQuote] = useState<TaxQuote | null>(null);
  const [taxLoading, setTaxLoading] = useState(false);

  // Amount the customer actually pays: tax-inclusive when the server quote is
  // in (e.g. +18% GST), else the pre-tax subtotal while it loads.
  const totalWithTax = taxQuote ? taxQuote.total_minor / 100 : (cart?.totalDollars ?? 0);

  const cartKey = cart ? `${cart.description}|${cart.totalCents}` : '';

  useEffect(() => {
    if (!token || !cart || step !== 'review') return;

    let cancelled = false;
    setTaxLoading(true);

    (async () => {
      try {
        const quote = await invoicesApi.quote(token, {
          currency: cart.currency ?? 'USD',
          lines: cart.lines.map((l) => ({
            description: l.label,
            quantity: l.qty,
            // buildCart works in dollars for display; convert once, here, using
            // a string round-trip so 0.15 doesn't become 15.000000000000002.
            unit_price_minor: Math.round(Number(l.unitPrice.toFixed(2)) * 100),
          })),
          billing: {
            country: billing.country,
            state:   billing.state,
            city:    billing.city,
            pincode: billing.pincode,
            gstin:   billing.gstin,
            name:    billing.name,
            email:   billing.email,
            phone:   billing.phone,
          },
        });
        if (!cancelled) setTaxQuote(quote);
      } catch {
        // Non-fatal: checkout proceeds and the server recomputes tax at
        // issuance anyway. We just can't preview it.
        if (!cancelled) setTaxQuote(null);
      } finally {
        if (!cancelled) setTaxLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [token, cartKey, step, billing.country, billing.state, billing.city, billing.pincode, billing.gstin]);

  const handleSubscribe = useCallback(async () => {
    if (!token || !cart) return;
    setStep('processing');
    setErr('');

    // ── Pro products (base subscription / container) go through the site API. A
    //    resize / free / already-active case completes with no Razorpay modal. ──
    if (cart.pro) {
      try {
        const p = cart.pro;

        // Send the typed billing details WITH the checkout call — the server persists them
        // onto the profile before pricing, so currency + GST resolve from what the customer
        // just entered (an Indian buyer pays GST with or without a GSTIN; previously this
        // form was collected but never saved, and a new Indian user priced as tax-free RoW).
        const billingPayload = {
          line1: billing.line1, line2: billing.line2, city: billing.city, state: billing.state,
          pincode: billing.pincode, country: billing.country, company: billing.company, gstin: billing.gstin,
        };

        // ── BaaS backend compute resize: a one-time DELTA order, then baasVerifyCompute. ──
        if (p.kind === 'baas') {
          const co = await projects.baasSetCompute(token, p.projectId!, p.size ?? 'nano', billingPayload);
          if (co.unchanged || co.resized) { setStep('success'); return; } // free / downsize — applied
          if (co.resize_checkout) {
            const orderId = co.order_id;
            const keyId = co.razorpay_key_id;
            if (!orderId) throw new Error('Could not start the upgrade payment.');
            if (!(await loadRazorpay())) throw new Error('Failed to load Razorpay checkout. Please try again.');
            const payment = await new Promise<Record<string, string>>((resolve, reject) => {
              const rzp = new window.Razorpay({
                key: keyId, order_id: orderId, name: 'Rach Dev LLP', description: cart.description,
                prefill: { email: billing.email, name: billing.name, contact: billing.phone },
                theme: { color: '#2563EB' },
                handler: (resp: Record<string, string>) => resolve(resp),
                modal: { ondismiss: () => { setStep('review'); reject(new Error('dismissed')); } },
              });
              rzp.open();
            });
            await projects.baasVerifyCompute(token, p.projectId!, {
              razorpay_order_id: payment.razorpay_order_id,
              razorpay_payment_id: payment.razorpay_payment_id,
              razorpay_signature: payment.razorpay_signature,
            });
            setStep('success');
            return;
          }
          setStep('success');
          return;
        }

        const co = p.kind === 'base'
          ? await site.subscribePro(token, p.tier ?? 'starter', billingPayload)
          : await projects.checkoutContainer(token, p.projectId!, p.serviceId!, (p.size ?? 'nano') as 'nano' | 'micro' | 'small', billingPayload);

        // Trust the SERVER's plan, not the cart's requested tier — `already` used to flip the
        // local user to the requested tier while the backend kept the old one (audit H4).
        if (p.kind === 'base' && (('already' in co && co.already) || ('upgraded' in co && (co as { upgraded?: boolean }).upgraded))) {
          updateUser({ plan: (co.plan as 'starter' | 'pro' | undefined) ?? p.tier ?? 'starter' });
          setStep('success');
          return;
        }
        if (p.kind === 'container' && (('resized' in co && co.resized) || ('free' in co && co.free))) { setStep('success'); return; }

        // UPSIZE: a one-time DELTA payment via a Razorpay ORDER (not a subscription), then
        // verifyResize applies the bigger size. Gated on the payment completing.
        if (p.kind === 'container' && 'resize_checkout' in co && co.resize_checkout) {
          const orderId = co.order_id;
          const keyId = co.razorpay_key_id;
          if (!orderId) throw new Error('Could not start the upgrade payment.');
          if (!(await loadRazorpay())) throw new Error('Failed to load Razorpay checkout. Please try again.');
          const payment = await new Promise<Record<string, string>>((resolve, reject) => {
            const rzp = new window.Razorpay({
              key: keyId, order_id: orderId, name: 'Rach Dev LLP', description: cart.description,
              prefill: { email: billing.email, name: billing.name, contact: billing.phone },
              theme: { color: '#2563EB' },
              handler: (resp: Record<string, string>) => resolve(resp),
              modal: { ondismiss: () => { setStep('review'); reject(new Error('dismissed')); } },
            });
            rzp.open();
          });
          await projects.verifyResize(token, p.projectId!, p.serviceId!, {
            razorpay_order_id: payment.razorpay_order_id,
            razorpay_payment_id: payment.razorpay_payment_id,
            razorpay_signature: payment.razorpay_signature,
          });
          setStep('success');
          return;
        }

        const subscriptionId = 'subscription_id' in co ? co.subscription_id : undefined;
        const keyId = 'razorpay_key_id' in co ? co.razorpay_key_id : undefined;
        if (!subscriptionId) throw new Error('Could not start the subscription.');
        if (!(await loadRazorpay())) throw new Error('Failed to load Razorpay checkout. Please try again.');

        const payment = await new Promise<Record<string, string>>((resolve, reject) => {
          const rzp = new window.Razorpay({
            key: keyId, subscription_id: subscriptionId, name: 'Rach Dev LLP', description: cart.description,
            prefill: { email: billing.email, name: billing.name, contact: billing.phone },
            theme: { color: '#2563EB' },
            handler: (resp: Record<string, string>) => resolve(resp),
            modal: { ondismiss: () => { setStep('review'); reject(new Error('dismissed')); } },
          });
          rzp.open();
        });

        if (p.kind === 'base') { await site.verifyProSubscription(token, payment as { razorpay_subscription_id: string; razorpay_payment_id: string; razorpay_signature: string }); updateUser({ plan: p.tier ?? 'starter' }); }
        else await projects.verifyContainer(token, p.projectId!, p.serviceId!, payment as { razorpay_subscription_id: string; razorpay_payment_id: string; razorpay_signature: string });
        setStep('success');
      } catch (err) {
        const msg = (err as Error).message;
        if (msg === 'dismissed') return;
        setErr(msg || 'Something went wrong. Please try again.');
        setStep('error');
      }
      return;
    }

    try {
      // Step 1: create plan + subscription on backend
      // Cart IDENTITY only — no prices. The server prices from the catalog and
      // ignores any amount sent here, so a tampered total cannot change what
      // Razorpay charges.
      const orderData = await expansion.createSubscription(token, {
        bundle_id       : cart.bundleId,
        items           : cart.items,
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
        // Cart identity again — the server re-prices rather than trusting
        // amounts round-tripped through the browser.
        bundle_id               : cart.bundleId,
        items                   : cart.items,
        billing_country         : billing.country,
      });

      // Order placed — empty the persistent cart so it doesn't linger.
      clearCart();
      setStep('success');
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === 'dismissed') return; // user closed modal — stay on review
      setErr(msg || 'Something went wrong. Please try again.');
      setStep('error');
    }
  }, [token, cart, billing.email, billing.name, billing.phone, billing.country, billing.line1, billing.line2, billing.city, billing.state, billing.pincode, billing.company, billing.gstin, clearCart, updateUser]);

  if (!cart) return null;

  // ── Success ─────────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="max-w-lg mx-auto py-16">
        <div className="rounded-2xl border border-neutral-border bg-surface-card p-10 text-center shadow-sm">
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
              <span className="font-bold text-text-primary font-mono">{money(totalWithTax)}/mo</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Status</span>
              <span className="inline-flex items-center gap-1 text-amber-700 font-semibold text-xs">
                <Clock size={11} /> Pending provisioning
              </span>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            {cart.pro ? (
              <>
                <Link href="/dashboard/billing"
                  className="flex-1 rounded-lg border border-neutral-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-bg-secondary transition-colors text-center">
                  Billing
                </Link>
                <Link
                  href={cart.pro.kind === 'container' && cart.pro.projectId && cart.pro.serviceId
                    ? `/dashboard/projects/${cart.pro.projectId}/services/${cart.pro.serviceId}`
                    : '/dashboard/projects'}
                  className="flex-1 rounded-lg bg-gradient-to-r from-primary-blue to-primary-purple px-4 py-2.5 text-sm font-semibold text-white text-center hover:opacity-90 transition-opacity">
                  {cart.pro.kind === 'container' ? 'Back to container' : 'Deploy a container'}
                </Link>
              </>
            ) : (
              <>
                <Link href="/dashboard/orders"
                  className="flex-1 rounded-lg border border-neutral-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-bg-secondary transition-colors text-center">
                  View Orders
                </Link>
                <Link href="/dashboard/vm-monitor"
                  className="flex-1 rounded-lg bg-gradient-to-r from-primary-blue to-primary-purple px-4 py-2.5 text-sm font-semibold text-white text-center hover:opacity-90 transition-opacity">
                  VM Monitor
                </Link>
              </>
            )}
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
  const inputCls = 'w-full rounded-lg border border-neutral-border bg-surface-card px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-primary-blue focus:ring-2 focus:ring-blue-500/20 transition-colors';
  const labelCls = 'block text-xs font-medium text-text-secondary mb-1';

  if (step === 'billing') {
    return (
      <div className="max-w-2xl space-y-6">
        <Link href={back.href} className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft size={14} /> {back.label}
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
          <div className="rounded-2xl border border-neutral-border bg-surface-card overflow-hidden">
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
                {/* Gate on the BILLING country, not GeoIP: an Indian business checking out from
                    abroad must still be able to enter its GSTIN, and a traveller in India with a
                    foreign billing address shouldn't see it. GSTIN is optional either way — GST
                    is charged for an India billing address regardless. */}
                {billing.country === 'India' && <>
                  <label className={labelCls}>GSTIN <span className="text-xs text-text-muted font-normal">(optional — GST applies either way; add it to claim input credit)</span></label>
                  <input className={inputCls} value={billing.gstin} onChange={setField('gstin')} placeholder="22AAAAA0000A1Z5" maxLength={15} style={{ textTransform: 'uppercase' }} />
                </>}
              </div>
            </div>
          </div>

          {/* Billing address */}
          <div className="rounded-2xl border border-neutral-border bg-surface-card overflow-hidden">
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
        href={back.href}
        className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors"
      >
        <ArrowLeft size={14} /> {back.label}
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
          <div className="rounded-2xl border border-neutral-border bg-surface-card overflow-hidden">
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
          <div className="rounded-2xl border border-neutral-border bg-surface-card overflow-hidden">
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
                        {money(line.unitPrice * line.qty)}
                      </p>
                      {line.qty > 1 && (
                        <p className="text-xs text-text-muted">{line.qty} × {money(line.unitPrice)}</p>
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
                  <span className="text-sm font-bold text-emerald-700">−{money(cart.saving)}</span>
                  <span className="ml-2 text-xs text-emerald-600 line-through">{money(cart.originalDollars!)}</span>
                </div>
              </div>
            )}
            <div className="border-t-2 border-neutral-border px-6 py-4 flex justify-between items-center">
              <span className="font-semibold text-text-primary">Monthly Total</span>
              <span className="text-2xl font-bold font-mono text-text-primary">{money(totalWithTax)}<span className="text-sm font-normal text-text-muted">/mo</span></span>
            </div>
          </div>

          {/* How billing works */}
          <div className="rounded-2xl border border-neutral-border bg-surface-card p-5 space-y-3">
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
                  <span className="font-medium font-mono">{money(l.unitPrice * l.qty)}</span>
                </div>
              ))}
              {cart.saving && (
                <div className="flex justify-between text-sm font-semibold text-emerald-600 border-t border-neutral-border pt-2">
                  <span>Bundle discount</span>
                  <span>−{money(cart.saving)}</span>
                </div>
              )}

              {/* Tax comes from the server, not from this component. */}
              <div className={cn('border-t border-neutral-border pt-3', cart.saving && 'border-dashed')}>
                <TaxSummary
                  quote={taxQuote}
                  loading={taxLoading}
                  currency={cart.currency ?? 'USD'} // fallback while the quote loads/fails — an INR cart must never render "$500.00" (audit H4)
                  fallbackSubtotalMinor={cart.totalCents}
                />
                <p className="mt-2 text-xs text-text-muted">Recurring · auto-renews monthly</p>
              </div>
            </div>

            <button
              onClick={handleSubscribe}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-blue to-primary-purple px-5 py-4 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              <Lock size={14} />
              Subscribe — {money(totalWithTax)}/mo
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
                    <strong>{money(totalWithTax)}/mo</strong> every month at 12:00 AM IST on the same date.
                    Cancel before <strong>{nextLabel}</strong> to avoid the next charge.
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="rounded-xl border border-neutral-border bg-surface-card p-4 text-xs text-text-muted space-y-1">
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
