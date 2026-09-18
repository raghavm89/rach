'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Server, Database, Globe, CheckCircle2, AlertCircle,
  ArrowLeft, ShieldCheck, Zap, History, Plus, Minus, Layers, Package,
  HardDrive, BarChart2, Activity, Boxes, Building2,
  Check, X as XIcon, CreditCard, Calendar, ChevronRight,
  Clock, RefreshCw, Coins, Bot, Receipt, FileText, LineChart,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { useCart } from '@rach/ui/contexts/CartContext';
import { expansion, ExpansionRequest, agent, invoices as invoicesApi, site, type TaxQuote } from '@rach/ui/lib/api';
import { TaxSummary } from '@rach/ui/components/billing/TaxSummary';
import { VISIBLE_SERVICES as CATALOG_SERVICES, BUNDLES as CATALOG_BUNDLES, PRO, formatCents, proBaseCents, proContainerCents, computeDeltaCents, type BillingCurrency } from '@rach/ui/lib/catalog';
import { InvoiceList } from '@rach/ui/components/billing/InvoiceList';
import { cn } from '@rach/ui/lib/utils';

// -- Razorpay types -----------------------------------------------------------

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  handler: (response: RazorpayResponse) => void | Promise<void>;
}

type RazorpayWindow = Window & {
  Razorpay?: new (options: RazorpayOptions) => void;
};

// -- Catalog ------------------------------------------------------------------

// Ids come from the shared catalog; adding a service there must not require
// editing a union here.
type ServiceId = string;

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

/**
 * Catalog from the shared module — the same catalog.json the server prices
 * from. This file used to carry its own copy (one of four), which had drifted
 * from the server's prices.
 *
 * Display only: the server re-prices every cart and ignores client totals.
 */
const SERVICES = CATALOG_SERVICES.map((s) => ({
  id: s.id as ServiceId,
  name: s.name,
  specs: s.specs,
  price: s.unit_price_cents / 100,
  priceCents: s.unit_price_cents,
  unit: s.unit,
  ...(SERVICE_ICONS[s.id] ?? { Icon: Server, iconBg: 'bg-blue-50', iconColor: 'text-primary-blue' }),
}));

const EMPTY_QTY: Record<ServiceId, number> = Object.fromEntries(
  CATALOG_SERVICES.map((s) => [s.id, 0]),
) as Record<ServiceId, number>;

interface BundleDef {
  id: string;
  name: string;
  tagline: string;
  bestFor: string;
  price: number;
  priceCents: number;
  originalPrice: number;
  saving: number;
  items: Partial<Record<ServiceId, number>>;
}

const BUNDLES: BundleDef[] = CATALOG_BUNDLES.map((b) => ({
  id: b.id,
  name: b.name,
  tagline: b.tagline,
  bestFor: b.best_for,
  price: b.price_cents / 100,
  priceCents: b.price_cents,
  // Derived from contents. The stored values were inflated by $50 (Growth) and
  // $100 (Scale), overstating savings as $80/$130 when the real figure is $30.
  originalPrice: b.listPriceCents / 100,
  saving: b.savingCents / 100,
  items: b.items as Partial<Record<ServiceId, number>>,
}));

// -- Helpers ------------------------------------------------------------------

function usd(dollars: number) {
  const isWhole = Number.isInteger(dollars);
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

function serviceLabel(id: ServiceId, qty: number) {
  const s = SERVICES.find((x) => x.id === id)!;
  return `${qty}x ${s.name}`;
}

// -- Order Detail Modal -------------------------------------------------------

function OrderDetailModal({ request: r, onClose }: { request: ExpansionRequest; onClose: () => void }) {
  const STATUS_STYLE: Record<string, { dot: string; badge: string; label: string }> = {
    pending  : { dot: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700 border-amber-200',       label: 'Pending' },
    fulfilled: { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Fulfilled' },
    cancelled: { dot: 'bg-neutral-400', badge: 'bg-surface-hover text-text-muted border-neutral-border', label: 'Cancelled' },
  };
  const s = STATUS_STYLE[r.status] ?? STATUS_STYLE.pending;

  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })
      : null;

  // Currency-aware, defaulting to USD like the Orders page's copy of this modal — the
  // "fix currency symbol" commit fixed only that copy; this one still rendered a USD
  // order with null currency as ₹ (go-live audit H5). TODO: extract ONE shared modal.
  const modalCur = r.currency ?? 'USD';
  const amountDisplay =
    r.amount_paid > 0
      ? new Intl.NumberFormat(modalCur === 'INR' ? 'en-IN' : 'en-US', {
          style: 'currency',
          currency: modalCur,
        }).format(r.amount_paid / 100)
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-lg rounded-2xl bg-surface-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-neutral-border">
          <div>
            <h3 className="font-bold text-text-primary">Order #{r.id}</h3>
            <p className="text-xs text-text-muted mt-0.5">Placed {fmt(r.requested_at)}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-bg-secondary transition-colors">
            <XIcon size={16} className="text-text-muted" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* Status */}
          <div className="flex items-center gap-3">
            <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold', s.badge)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
              {s.label}
            </span>
            {r.status === 'pending' && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                <RefreshCw size={11} className="animate-spin" />
                Provisioning in progress
              </span>
            )}
          </div>

          {/* What was ordered */}
          <div className="rounded-xl border border-neutral-border p-4">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">What you ordered</p>
            <p className="text-sm font-medium text-text-primary">
              {r.custom_description ?? r.package_name ?? 'Custom resource order'}
            </p>
            {r.vm_count != null && r.vm_count > 0 && (
              <p className="text-xs text-text-muted mt-1 flex items-center gap-1">
                <Server size={11} />
                {r.vm_count} VM{r.vm_count !== 1 ? 's' : ''} included
              </p>
            )}
            {r.notes && (
              <p className="text-xs text-text-muted mt-2 italic">{r.notes}</p>
            )}
          </div>

          {/* Payment */}
          {(amountDisplay || r.razorpay_payment_id || r.razorpay_order_id) && (
            <div className="rounded-xl border border-neutral-border p-4 space-y-3">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Payment</p>
              {amountDisplay && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-text-secondary">
                    <CreditCard size={14} className="text-text-muted" />
                    Amount paid
                  </span>
                  <span className="text-sm font-bold font-mono text-text-primary">{amountDisplay}</span>
                </div>
              )}
              {r.razorpay_payment_id && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs text-text-muted shrink-0">Payment ID</span>
                  <code className="text-xs bg-bg-secondary rounded px-2 py-0.5 font-mono text-text-secondary truncate">
                    {r.razorpay_payment_id}
                  </code>
                </div>
              )}
              {r.razorpay_order_id && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs text-text-muted shrink-0">Order ID</span>
                  <code className="text-xs bg-bg-secondary rounded px-2 py-0.5 font-mono text-text-secondary truncate">
                    {r.razorpay_order_id}
                  </code>
                </div>
              )}
            </div>
          )}

          {/* Subscription */}
          {(r.razorpay_subscription_id || r.subscription_status || r.next_charge_at) && (
            <div className="rounded-xl border border-neutral-border p-4 space-y-3">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Subscription</p>
              {r.subscription_status && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Status</span>
                  <span className="text-xs font-semibold capitalize text-text-primary">{r.subscription_status}</span>
                </div>
              )}
              {r.razorpay_subscription_id && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs text-text-muted shrink-0">Subscription ID</span>
                  <code className="text-xs bg-bg-secondary rounded px-2 py-0.5 font-mono text-text-secondary truncate">
                    {r.razorpay_subscription_id}
                  </code>
                </div>
              )}
              {r.next_charge_at && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-text-muted">
                    <Calendar size={11} />
                    Next charge
                  </span>
                  <span className="text-xs text-text-primary">{fmt(r.next_charge_at)}</span>
                </div>
              )}
            </div>
          )}

          {/* Timeline */}
          <div className="rounded-xl border border-neutral-border p-4 space-y-3">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Timeline</p>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <Clock size={13} className="text-text-muted shrink-0" />
                <div className="flex-1 flex items-center justify-between gap-4">
                  <span className="text-xs text-text-muted">Requested</span>
                  <span className="text-xs text-text-primary">{fmt(r.requested_at)}</span>
                </div>
              </div>
              {r.fulfilled_at && (
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                  <div className="flex-1 flex items-center justify-between gap-4">
                    <span className="text-xs text-text-muted">Fulfilled</span>
                    <span className="text-xs text-text-primary">{fmt(r.fulfilled_at)}</span>
                  </div>
                </div>
              )}
              {r.status === 'pending' && (
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 h-3 w-3 rounded-full border-2 border-amber-400 shrink-0" />
                  <p className="text-xs text-amber-600">
                    Provisioning typically completes within 24 hours of payment.
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-border bg-bg-secondary flex items-center justify-between">
          <p className="text-xs text-text-muted">Need help? Contact support.</p>
          <button
            onClick={onClose}
            className="rounded-lg border border-neutral-border bg-surface-card px-4 py-2 text-xs font-semibold text-text-primary hover:bg-bg-secondary transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// -- Order History ------------------------------------------------------------

function OrderHistory({ token }: { token: string }) {
  const [requests, setRequests] = useState<ExpansionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ExpansionRequest | null>(null);

  useEffect(() => {
    expansion.myRequests(token)
      .then((d) => setRequests(d.requests))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading || !requests.length) return null;

  const STATUS_BADGE: Record<string, string> = {
    pending  : 'bg-amber-50 text-amber-700',
    fulfilled: 'bg-emerald-50 text-emerald-700',
    cancelled: 'bg-surface-hover text-text-muted',
  };

  return (
    <>
      {selected && <OrderDetailModal request={selected} onClose={() => setSelected(null)} />}

      <div className="rounded-xl border border-neutral-border bg-surface-card overflow-hidden">
        <div className="border-b border-neutral-border px-6 py-4 flex items-center gap-2">
          <History size={16} className="text-text-muted" />
          <h3 className="text-sm font-semibold text-text-primary">Order History</h3>
        </div>
        <div className="divide-y divide-neutral-border">
          {requests.map((r) => (
            <div key={r.id} className="flex items-center gap-4 px-6 py-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">
                  {r.custom_description ?? r.package_name ?? 'Order'}
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  {new Date(r.requested_at).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'short', day: 'numeric',
                  })}
                </p>
              </div>
              <span className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize',
                STATUS_BADGE[r.status] ?? STATUS_BADGE.pending,
              )}>
                {r.status}
              </span>
              <button
                onClick={() => setSelected(r)}
                className="flex items-center gap-1 rounded-lg border border-neutral-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-all shrink-0"
              >
                View details <ChevronRight size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// -- Main page ----------------------------------------------------------------

type Tab = 'custom' | 'bundles' | 'credits' | 'usage' | 'invoices';

// -- Agent Credit Packs --------------------------------------------------------

const CREDIT_PACKS = [
  { id: 'starter', label: 'Starter', price_usd: 5,  credits: 150,  bonus: null },
  { id: 'plus',    label: 'Plus',    price_usd: 10, credits: 400,  bonus: '+33%' },
  { id: 'pro',     label: 'Pro',     price_usd: 25, credits: 1500, bonus: '+100%' },
  { id: 'max',     label: 'Max',     price_usd: 50, credits: 3500, bonus: '+133%' },
];

function BillingPageInner() {
  const { user, token } = useAuth();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [proRouting, setProRouting] = useState<null | 'starter' | 'pro'>(null);
  // Billing region for display (server is authoritative). Resolved from a no-side-effect
  // quote so India tenants see native ₹ plan prices, not USD.
  const [billingCurrency, setBillingCurrency] = useState<BillingCurrency>('USD');
  useEffect(() => {
    if (!token) return;
    let alive = true;
    site.proQuote(token, 'starter')
      .then((q) => { if (alive && (q.currency === 'INR' || q.currency === 'USD')) setBillingCurrency(q.currency); })
      .catch(() => { /* keep USD default */ });
    return () => { alive = false; };
  }, [token]);

  // Subscribe to a tier → price it server-side (no side effects), then hand off to the
  // shared checkout page (review + GST/tax + Razorpay) with the tier, amount + currency.
  async function startProCheckout(tier: 'starter' | 'pro') {
    if (!token) return;
    setProRouting(tier);
    try {
      const q = await site.proQuote(token, tier);
      const qs = new URLSearchParams({ pro: 'base', tier, amount: String(q.amount), currency: q.currency });
      router.push(`/dashboard/billing/checkout?${qs.toString()}`);
    } catch { setProRouting(null); }
  }

  const [tab, setTab]                       = useState<Tab>(() => {
    const t = searchParams.get('tab');
    const valid: Tab[] = ['custom', 'bundles', 'credits', 'usage', 'invoices'];
    return (valid as string[]).includes(t ?? '') ? (t as Tab) : 'bundles';
  });
  const [quantities, setQuantities]         = useState<Record<ServiceId, number>>(EMPTY_QTY);
  const [selectedBundle, setSelectedBundle] = useState<BundleDef | null>(null);

  // Cancel Pro (unsubscribe): stops shared containers + cancels active subscriptions.
  const [unsubscribing, setUnsubscribing] = useState(false);
  const [unsubNotice, setUnsubNotice] = useState<string | null>(null);
  async function handleCancelPro() {
    if (!token) return;
    if (!window.confirm('Cancel your Pro plan? This stops all your shared containers and cancels active subscriptions. This cannot be undone.')) return;
    setUnsubscribing(true);
    setUnsubNotice(null);
    try {
      const r = await site.unsubscribe(token);
      setUnsubNotice(`${r.message} (${r.stopped_containers} container(s) stopped, ${r.cancelled_subscriptions} subscription(s) cancelled)`);
    } catch (e) {
      setUnsubNotice((e as Error).message);
    } finally {
      setUnsubscribing(false);
    }
  }

  // Persistent cart — restores the user's picked services (across devices) and
  // keeps the order summary populated.
  const { items: cartItems, setItems: setCartItems, loading: cartLoading } = useCart();
  const cartSeeded = useRef(false);

  // Seed the quantity controls + bundle selection from the saved cart once it
  // has loaded.
  useEffect(() => {
    if (cartLoading || cartSeeded.current) return;
    cartSeeded.current = true;
    if (!cartItems.length) return;

    const svcQty: Record<string, number> = {};
    let bundleItem: (typeof cartItems)[number] | null = null;
    for (const it of cartItems) {
      if (it.kind === 'bundle') bundleItem = it;
      else svcQty[it.id] = it.qty;
    }

    if (Object.keys(svcQty).length) setQuantities({ ...EMPTY_QTY, ...svcQty });
    if (bundleItem) {
      const b = BUNDLES.find((x) => x.id === bundleItem!.id);
      if (b) {
        setSelectedBundle(b);
        // A bundle-only cart should land on the Bundles tab.
        if (!Object.keys(svcQty).length) setTab('bundles');
      }
    }
  }, [cartLoading, cartItems]);

  // Mirror service quantities + bundle selection back into the cart
  // (debounced-saved by the provider). Runs only after the initial seed so it
  // can't wipe a still-loading cart.
  useEffect(() => {
    if (!cartSeeded.current) return;
    const items = SERVICES
      .filter((s) => quantities[s.id] > 0)
      .map((s) => ({ id: s.id, qty: quantities[s.id], kind: 'service' as 'service' | 'bundle' }));
    if (selectedBundle) items.push({ id: selectedBundle.id, qty: 1, kind: 'bundle' as const });
    setCartItems(items);
  }, [quantities, selectedBundle, setCartItems]);

  // Agent credits state
  const [selectedPack, setSelectedPack]     = useState<string | null>(searchParams.get('pack'));
  const [creditBalance, setCreditBalance]   = useState<number | null>(null);
  const [creditPurchasing, setCreditPurchasing] = useState(false);
  const [creditSuccess, setCreditSuccess]   = useState(false);
  const [creditQuote, setCreditQuote]       = useState<TaxQuote | null>(null);
  const [creditQuoteLoading, setCreditQuoteLoading] = useState(false);

  // Server-side tax quote for the selected credit pack (adds GST for India via
  // the saved billing address — same engine as the checkout page).
  useEffect(() => {
    if (!token || !selectedPack) { setCreditQuote(null); return; }
    const pack = CREDIT_PACKS.find((p) => p.id === selectedPack);
    if (!pack) return;
    let cancelled = false;
    setCreditQuoteLoading(true);
    invoicesApi.quote(token, {
      lines: [{ description: `${pack.label} credit pack — ${pack.credits} credits`, quantity: 1, unit_price_minor: pack.price_usd * 100 }],
      currency: 'USD',
    })
      .then((q) => { if (!cancelled) setCreditQuote(q); })
      .catch(() => { if (!cancelled) setCreditQuote(null); })
      .finally(() => { if (!cancelled) setCreditQuoteLoading(false); });
    return () => { cancelled = true; };
  }, [token, selectedPack]);

  // Usage state
  const [usageSummary, setUsageSummary]     = useState<{ balance: number; total_purchased: number; total_used: number; total_tokens: number } | null>(null);
  const [creditHistory, setCreditHistory]   = useState<{ id: number; type: string; amount: number; description: string; created_at: string; user_name?: string | null }[]>([]);
  const [sessionUsage, setSessionUsage]     = useState<{ id: number; title: string; message_count: number; total_tokens: number; total_credits: number; updated_at: string }[]>([]);
  const [usageLoading, setUsageLoading]     = useState(false);

  const canPurchase = user?.role === 'tenant_admin' || user?.role === 'tenant_user';
  const isTenantAdmin = user?.role === 'tenant_admin';

  // Load credit balance on mount
  useEffect(() => {
    if (!token) return;
    agent.getCredits(token).then((d) => setCreditBalance(d.balance)).catch(() => {});
  }, [token]);

  // Load usage data when usage tab active
  useEffect(() => {
    if (tab !== 'usage' || !token) return;
    setUsageLoading(true);
    Promise.all([
      agent.getUsageSummary(token),
      agent.getCreditHistory(token),
      agent.getSessionUsage(token),
    ]).then(([summary, history, sessions]) => {
      setUsageSummary(summary);
      setCreditHistory(history.transactions);
      setSessionUsage(sessions.sessions);
    }).catch(() => {}).finally(() => setUsageLoading(false));
  }, [tab, token]);

  // Handle credit purchase via Razorpay.
  // Two failure modes used to be silent (go-live audit H6): a checkout-script load failure
  // hung the button forever (no onerror), and a verify failure after Razorpay had COLLECTED
  // THE MONEY was swallowed — paid, no credits, no message. Both now surface to the customer.
  const [creditError, setCreditError] = useState<string | null>(null);
  const handleCreditPurchase = async () => {
    if (!token || !selectedPack) return;
    setCreditPurchasing(true);
    setCreditError(null);
    try {
      const orderData = await agent.purchaseCredits(token, selectedPack);
      await new Promise<void>((resolve, reject) => {
        if ((window as unknown as RazorpayWindow).Razorpay) { resolve(); return; }
        const s = document.createElement('script');
        s.src = 'https://checkout.razorpay.com/v1/checkout.js';
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Could not load the Razorpay checkout (a network issue or ad-blocker?). You have not been charged — please try again.'));
        document.head.appendChild(s);
      });
      const pack = CREDIT_PACKS.find((p) => p.id === selectedPack)!;
      const RazorpayClass = (window as unknown as RazorpayWindow).Razorpay!;
      new RazorpayClass({
        key:         orderData.razorpay_key_id,
        order_id:    orderData.order_id,
        amount:      orderData.amount,
        currency:    orderData.currency,
        name:        'RachBase Agent Credits',
        description: `${pack.label} — ${pack.credits} credits`,
        handler: async (response: RazorpayResponse) => {
          try {
            const result = await agent.verifyPurchase(token, {
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
              pack_id:             selectedPack,
            });
            setCreditBalance(result.balance);
            setCreditSuccess(true);
          } catch {
            // Money has moved; the credits will be applied once verification goes through.
            setCreditError(
              `Payment received, but we couldn't confirm your credits yet. They usually appear within a few minutes — ` +
              `if not, contact support quoting payment id ${response.razorpay_payment_id}. You have NOT been charged twice.`,
            );
          }
        },
      }).open();
    } catch (err) {
      console.error(err);
      setCreditError((err as Error).message || 'Could not start the purchase. Please try again.');
    } finally {
      setCreditPurchasing(false);
    }
  };

  // Bundle and individual services are mutually exclusive — the server prices a
  // bundle OR a set of services, not both in one subscription. Adding a service
  // clears any selected bundle, and picking a bundle clears the service cart.
  const adjustQty = (id: ServiceId, delta: number) => {
    // `?? 0` guards against a service id that isn't in state yet (e.g. a newly
    // added catalog item) — otherwise `undefined + delta` yields NaN.
    setQuantities((p) => ({ ...p, [id]: Math.max(0, (p[id] ?? 0) + delta) }));
    if (delta > 0 && selectedBundle) setSelectedBundle(null);
  };

  const customTotal = SERVICES.reduce((s, svc) => s + svc.price * (quantities[svc.id] ?? 0), 0);


  // The Order Summary reflects the persistent cart on every plan tab (not just
  // the active tab), so switching tabs never blanks a non-empty cart.
  const hasSelection = selectedBundle ? true : customTotal > 0;

  const orderTotal = selectedBundle ? selectedBundle.price : customTotal;

  const lineItems: { label: string; price: number }[] = selectedBundle
    ? (Object.entries(selectedBundle.items) as [ServiceId, number][])
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => ({
          label: serviceLabel(id, qty),
          price: SERVICES.find((s) => s.id === id)!.price * qty,
        }))
    : SERVICES.filter((s) => quantities[s.id] > 0).map((s) => ({
        label: serviceLabel(s.id, quantities[s.id]),
        price: s.price * quantities[s.id],
      }));

  const goToCheckout = () => {
    if (!hasSelection) return;
    const params = new URLSearchParams();
    if (selectedBundle) {
      params.set('plan', selectedBundle.id);
    } else {
      SERVICES.forEach((s) => { if (quantities[s.id] > 0) params.set(s.id, String(quantities[s.id])); });
    }
    router.push(`/dashboard/billing/checkout?${params.toString()}`);
  };

  return (
    <div className="max-w-5xl space-y-8">

      {/* Back */}
      <Link
        href="/dashboard/vm-monitor"
        className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors"
      >
        <ArrowLeft size={14} /> Back to VM Monitor
      </Link>

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold font-display text-text-primary">Choose Your Plan</h2>
        <p className="mt-1 text-sm text-text-muted">
          Pick individual services or save with a bundle. Resources provisioned within 24 hours.
        </p>
      </div>

      {/* Trust pills */}
      <div className="flex flex-wrap gap-3">
        {[
          { icon: <ShieldCheck size={13} />, label: 'Secure payment' },
          { icon: <Zap size={13} />,         label: 'Provisioned within 24h' },
          { icon: <Server size={13} />,      label: 'Enterprise-grade hardware' },
        ].map((b) => (
          <div key={b.label} className="flex items-center gap-1.5 text-xs text-text-muted bg-bg-secondary rounded-full px-3 py-1.5">
            <span className="text-primary-blue">{b.icon}</span>
            {b.label}
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex rounded-xl border border-neutral-border bg-bg-secondary p-1 w-fit flex-wrap gap-0.5">
        {([
          { id: 'bundles' as Tab, label: 'Plans',               icon: <Layers size={14} /> },
          { id: 'custom'  as Tab, label: 'Individual Services', icon: <Package size={14} /> },
          { id: 'credits' as Tab, label: 'Agent Credits',       icon: <Coins size={14} /> },
          { id: 'invoices' as Tab, label: 'Invoices',           icon: <Receipt size={14} /> },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); }}
            className={cn(
              'flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition-all duration-200',
              tab === t.id
                ? 'bg-surface-card text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary',
            )}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ---- Plans + Individual Services ---- */}
      {tab !== 'credits' && tab !== 'usage' && (
        <div className={cn('grid gap-6', tab === 'custom' && 'lg:grid-cols-[1fr_320px]')}>

          <div className="space-y-4">

            {tab === 'bundles' && (() => {
              const cur = billingCurrency;
              const micro = formatCents(computeDeltaCents('micro', cur), cur);
              const small = formatCents(computeDeltaCents('small', cur), cur);
              const perContainer = formatCents(proContainerCents(cur), cur);
              const sharedTiers = [
                {
                  id: 'starter' as const, label: PRO.tiers.starter.label, icon: <Boxes size={16} />,
                  tagline: 'Launch a single service on shared infrastructure.',
                  base: proBaseCents('starter', cur), incl: PRO.tiers.starter.base_includes_containers,
                  features: [
                    `${PRO.tiers.starter.base_includes_containers} nano container included`,
                    `+${perContainer}/mo per additional container`,
                    `Compute upgrades: micro (+${micro}) · small (+${small})`,
                    'Deploy from a GitHub repo',
                  ],
                },
                {
                  id: 'pro' as const, label: PRO.tiers.pro.label, icon: <Boxes size={16} />,
                  tagline: 'Run a full backend on shared infrastructure.',
                  base: proBaseCents('pro', cur), incl: PRO.tiers.pro.base_includes_containers,
                  features: [
                    `${PRO.tiers.pro.base_includes_containers} nano containers included`,
                    'Backend (Auth · Data · Storage · Functions): 3 containers, included',
                    'Observability: metrics, query performance & logs',
                    `+${perContainer}/mo per additional container`,
                    `Compute upgrades: micro (+${micro}) · small (+${small})`,
                    'Deploy from a GitHub repo',
                  ],
                },
              ];
              const enterpriseFeatures = [
                'Designated support manager',
                'Uptime SLAs',
                'BYO Cloud supported',
                '24×7×365 premium enterprise support',
                'Private Slack channel',
                'Custom security questionnaires',
              ];
              return (
                <div className="grid gap-4 sm:grid-cols-3 max-w-4xl">
                  {sharedTiers.map((t) => (
                    <div key={t.id} className="relative flex flex-col rounded-2xl border-2 border-neutral-border bg-surface-card p-5">
                      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-bg-secondary text-text-muted">{t.icon}</div>
                      <h3 className="font-bold text-text-primary leading-tight">{t.label}</h3>
                      <p className="text-xs text-text-muted mt-0.5 mb-3">{t.tagline}</p>
                      <div className="mb-3">
                        <span className="text-xl font-bold font-mono text-text-primary">{formatCents(t.base, billingCurrency)}</span>
                        <span className="text-xs text-text-muted"> /mo</span>
                        <p className="text-xs text-text-muted mt-0.5">Includes {t.incl} container{t.incl > 1 ? 's' : ''} · +{perContainer}/container</p>
                      </div>
                      <ul className="space-y-2 mb-4 flex-1">
                        {t.features.map((f) => (
                          <li key={f} className="flex items-start gap-2 text-xs text-text-secondary"><Check size={12} className="mt-0.5 shrink-0 text-emerald-500" />{f}</li>
                        ))}
                      </ul>
                      {user?.plan === t.id ? (
                        <div className="mt-auto space-y-2">
                          <div className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-700">
                            <Check size={14} /> Current plan
                          </div>
                          <Link href="/dashboard/projects" className="block text-center text-xs font-medium text-primary-blue hover:underline">
                            Deploy a container →
                          </Link>
                        </div>
                      ) : (
                        <button onClick={() => startProCheckout(t.id)} disabled={proRouting !== null}
                          className="mt-auto flex w-full items-center justify-center rounded-xl bg-primary-blue py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                          {proRouting === t.id ? 'Loading…' : `Choose ${t.label}`}
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Enterprise — contact us */}
                  <div className="relative flex flex-col rounded-2xl border-2 border-neutral-border bg-surface-card p-5">
                    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-bg-secondary text-text-muted"><Building2 size={16} /></div>
                    <h3 className="font-bold text-text-primary leading-tight">Enterprise</h3>
                    <p className="text-xs text-text-muted mt-0.5 mb-3">For large-scale applications running internet-scale workloads.</p>
                    <div className="mb-3"><span className="text-xl font-bold font-mono text-text-primary">Custom</span></div>
                    <ul className="space-y-2 mb-4 flex-1">
                      {enterpriseFeatures.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-xs text-text-secondary"><Check size={12} className="mt-0.5 shrink-0 text-emerald-500" />{f}</li>
                      ))}
                    </ul>
                    <Link href="/contact" className="mt-auto flex w-full items-center justify-center rounded-xl border border-neutral-border py-2.5 text-sm font-semibold text-text-primary hover:bg-bg-secondary">
                      Contact us →
                    </Link>
                  </div>
                </div>
              );
            })()}

            {tab === 'custom' && (
              <div className="space-y-3">
                {SERVICES.map((svc) => {
                  const qty = quantities[svc.id] ?? 0;
                  return (
                    <div
                      key={svc.id}
                      className={cn(
                        'flex items-center gap-4 rounded-2xl border-2 bg-surface-card px-6 py-5 transition-all duration-200',
                        qty > 0 ? 'border-primary-blue shadow-sm' : 'border-neutral-border hover:border-primary-blue/30',
                      )}
                    >
                      <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl shrink-0', svc.iconBg)}>
                        <svc.Icon size={20} className={svc.iconColor} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-text-primary">{svc.name}</p>
                        <p className="text-xs text-text-muted mt-0.5">{svc.specs}</p>
                      </div>
                      <div className="text-right shrink-0 hidden sm:block">
                        <p className="font-bold font-mono text-text-primary">{usd(svc.price)}</p>
                        <p className="text-xs text-text-muted">{svc.unit}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => adjustQty(svc.id, -1)}
                          disabled={qty === 0}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-border text-text-secondary hover:bg-bg-secondary hover:border-primary-blue/40 disabled:opacity-30 transition-all"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-8 text-center text-sm font-bold font-mono text-text-primary">{qty}</span>
                        <button
                          onClick={() => adjustQty(svc.id, +1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-border text-text-secondary hover:bg-bg-secondary hover:border-primary-blue/40 transition-all"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      <div className="w-20 text-right shrink-0">
                        {qty > 0
                          ? <p className="font-semibold font-mono text-primary-blue">{usd(svc.price * qty)}</p>
                          : <p className="text-xs text-text-muted">-</p>
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right - order summary (Individual Services only) */}
          {tab === 'custom' && (
          <div className="space-y-4">
            <div className={cn(
              'rounded-2xl border-2 p-6 transition-all duration-300',
              hasSelection
                ? 'border-primary-blue/20 bg-gradient-to-br from-primary-blue/5 to-primary-purple/5'
                : 'border-neutral-border bg-surface-card',
            )}>
              <h3 className="font-semibold text-text-primary mb-4">Order Summary</h3>

              {!hasSelection ? (
                <p className="text-sm text-text-muted text-center py-6">
                  Add services using the + button.
                </p>
              ) : (
                <>
                  <div className="space-y-2 mb-4">
                    {lineItems.map((li) => (
                      <div key={li.label} className="flex justify-between text-sm">
                        <span className="text-text-secondary">{li.label}</span>
                        <span className="font-medium text-text-primary font-mono">{usd(li.price)}</span>
                      </div>
                    ))}
                    {selectedBundle && (
                      <div className="flex justify-between text-xs text-emerald-600 font-semibold">
                        <span>Bundle saving</span>
                        <span>-{usd(selectedBundle.originalPrice - selectedBundle.price)}</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-neutral-border pt-3 flex justify-between items-baseline mb-5">
                    <span className="font-semibold text-text-primary">Total</span>
                    <div className="text-right">
                      <span className="text-2xl font-bold font-mono text-text-primary">{usd(orderTotal)}</span>
                      <span className="text-xs text-text-muted ml-1">/mo</span>
                    </div>
                  </div>

                  {!canPurchase && (
                    <p className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700">
                      <AlertCircle size={12} className="shrink-0" />
                      Only Tenant Admins and Tenant Users can purchase.
                    </p>
                  )}

                  <button
                    onClick={goToCheckout}
                    disabled={!canPurchase}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-blue to-primary-purple px-5 py-3.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    Subscribe - {usd(orderTotal)}/mo
                  </button>

                  <p className="mt-3 text-center text-xs text-text-muted">
                    Resources provisioned within 24 hours of payment.
                  </p>
                </>
              )}
            </div>

          </div>
          )}
        </div>
      )}

      {token && tab !== 'credits' && tab !== 'usage' && <OrderHistory token={token} />}

      {/* ---- Agent Credits ---- */}
      {tab === 'invoices' && (
        <div className="mx-auto max-w-4xl">
          <div className="mb-5">
            <h3 className="text-lg font-bold font-display text-text-primary">Invoices</h3>
            <p className="mt-1 text-sm text-text-muted">
              Issued automatically when a payment is completed. Each PDF is a tax
              invoice showing the tax treatment applied to that sale.
            </p>
          </div>
          {token && <InvoiceList token={token} />}

          {(user?.plan === 'pro' || user?.plan === 'starter') && (
            <div className="mt-8 rounded-xl border border-red-200 bg-red-50/50 p-4">
              <h4 className="text-sm font-semibold text-text-primary">Cancel plan</h4>
              <p className="mt-1 text-xs text-text-muted">
                Stops all your shared containers and cancels active subscriptions. Your projects and settings stay,
                but running containers are taken offline. This can&apos;t be undone.
              </p>
              {unsubNotice && <p className="mt-2 rounded-lg bg-surface-card px-3 py-2 text-xs text-text-secondary">{unsubNotice}</p>}
              <button onClick={handleCancelPro} disabled={unsubscribing}
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
                {unsubscribing ? 'Cancelling…' : 'Cancel plan'}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'credits' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {/* Balance banner */}
            <div className="flex items-center gap-4 rounded-xl border border-primary-blue/20 bg-primary-blue/5 px-5 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-blue/10">
                <Coins size={18} className="text-primary-blue" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Current balance: <span className="text-primary-blue">{creditBalance ?? '—'} credits</span>
                </p>
                <p className="text-xs text-text-muted">Shared across all team members · Never expires</p>
              </div>
            </div>

            {/* Pack cards */}
            <div className="grid gap-4 sm:grid-cols-2">
              {CREDIT_PACKS.map((pack) => {
                const isSelected = selectedPack === pack.id;
                return (
                  <button
                    key={pack.id}
                    onClick={() => { setSelectedPack(isSelected ? null : pack.id); setCreditSuccess(false); }}
                    className={cn(
                      'relative text-left rounded-2xl border-2 p-5 transition-all duration-200',
                      isSelected
                        ? 'border-primary-blue bg-primary-blue/5 shadow-md'
                        : 'border-neutral-border hover:border-primary-blue/40 bg-surface-card'
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl',
                        isSelected ? 'bg-gradient-to-br from-primary-blue to-primary-purple text-white' : 'bg-bg-secondary text-text-muted'
                      )}>
                        <Bot size={16} />
                      </div>
                      {isSelected && <CheckCircle2 size={18} className="text-primary-blue" />}
                    </div>
                    <h3 className="font-bold text-text-primary">{pack.label}</h3>
                    <p className="text-2xl font-bold font-mono mt-1">
                      {pack.credits.toLocaleString()}
                      <span className="text-sm font-normal text-text-muted ml-1">credits</span>
                    </p>
                    {pack.bonus && (
                      <span className="mt-1 inline-block text-xs font-semibold text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">
                        {pack.bonus} bonus
                      </span>
                    )}
                    <div className="mt-3 pt-3 border-t border-neutral-border flex items-baseline justify-between">
                      <span className="text-xl font-bold font-mono text-text-primary">${pack.price_usd}</span>
                      <span className="text-xs text-text-muted">one-time</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Order Summary */}
            <div className={cn(
              'rounded-2xl border-2 p-6 transition-all duration-300',
              selectedPack ? 'border-primary-blue/20 bg-primary-blue/5' : 'border-neutral-border bg-surface-card'
            )}>
              <h3 className="font-semibold text-text-primary mb-4">Order Summary</h3>
              {!selectedPack ? (
                <p className="text-sm text-text-muted text-center py-6">Select a credit pack to continue.</p>
              ) : creditSuccess ? (
                <div className="text-center py-6 space-y-2">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-500" />
                  <p className="font-semibold text-text-primary">Credits added!</p>
                  <p className="text-xs text-text-muted">New balance: {creditBalance} credits</p>
                </div>
              ) : (
                <>
                  {(() => {
                    const pack = CREDIT_PACKS.find((p) => p.id === selectedPack)!;
                    return (
                      <>
                        {/* Line items */}
                        <div className="space-y-2 mb-4">
                          <div className="flex justify-between text-sm">
                            <span className="text-text-secondary">{pack.label} pack</span>
                            <span className="font-medium font-mono">{pack.credits.toLocaleString()} credits</span>
                          </div>
                          {pack.bonus && (
                            <div className="flex justify-between text-xs text-emerald-600">
                              <span>Bonus</span><span>{pack.bonus}</span>
                            </div>
                          )}
                        </div>

                        {/* Tax breakdown from the server (adds GST for India) */}
                        <div className="border-t border-neutral-border pt-3 mb-4">
                          <TaxSummary quote={creditQuote} loading={creditQuoteLoading} fallbackSubtotalMinor={pack.price_usd * 100} />
                        </div>

                        {/* Billing info from profile */}
                        <div className="rounded-xl border border-neutral-border bg-surface-card p-4 mb-4 space-y-2">
                          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Billing Info</p>
                          <div className="flex justify-between text-sm">
                            <span className="text-text-muted">Name</span>
                            <span className="text-text-primary font-medium">{user?.name || '—'}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-text-muted">Email</span>
                            <span className="text-text-primary font-medium truncate ml-4">{user?.email || '—'}</span>
                          </div>
                          {user?.billing_address ? (
                            <div className="flex justify-between text-sm">
                              <span className="text-text-muted">Address</span>
                              <span className="text-text-primary font-medium text-right ml-4">
                                {user.billing_address.city}, {user.billing_address.state}
                              </span>
                            </div>
                          ) : null}
                          <Link
                            href="/dashboard/profile"
                            className="inline-flex items-center gap-1 text-xs text-primary-blue hover:underline mt-1"
                          >
                            <ChevronRight size={11} /> Edit in profile
                          </Link>
                        </div>

                        {!isTenantAdmin && (
                          <p className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700">
                            <AlertCircle size={12} className="shrink-0" /> Only Tenant Admins can purchase.
                          </p>
                        )}
                        <button
                          onClick={handleCreditPurchase}
                          disabled={!isTenantAdmin || creditPurchasing}
                          className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-blue to-primary-purple px-5 py-3.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                          {creditPurchasing ? <RefreshCw size={14} className="animate-spin" /> : <CreditCard size={14} />}
                          Review &amp; Pay ${pack.price_usd}
                        </button>
                        {creditError && (
                          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{creditError}</p>
                        )}
                        <p className="mt-3 text-center text-xs text-text-muted">One-time · Credits never expire · Shared across team</p>
                      </>
                    );
                  })()}
                </>
              )}
            </div>

            {/* Credits bundle info */}
            <div className="rounded-xl border border-neutral-border bg-surface-card p-5 space-y-3">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">About Agent Credits</p>
              {[
                { label: 'Model',          value: 'Claude Haiku 4.5' },
                { label: 'Rate',           value: '1,000 tokens = 1 credit' },
                { label: 'Avg message',    value: '~2–5 credits' },
                { label: 'Shared across',  value: 'All team members' },
                { label: 'Expiry',         value: 'Never expire' },
                { label: 'Payment',        value: 'One-time, no subscription' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">{item.label}</span>
                  <span className="text-xs font-medium text-text-primary">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- Usage ---- */}
      {tab === 'usage' && (
        <div className="space-y-6">
          {usageLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-border border-t-primary-blue" />
            </div>
          ) : (
            <>
              {/* Summary cards */}
              {usageSummary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Current Balance', value: `${usageSummary.balance} cr`, icon: <Coins size={16} />, accent: true },
                    { label: 'Total Purchased', value: `${usageSummary.total_purchased} cr`, icon: <CreditCard size={16} />, accent: false },
                    { label: 'Total Used',       value: `${usageSummary.total_used} cr`, icon: <Activity size={16} />, accent: false },
                    { label: 'Total Tokens',     value: usageSummary.total_tokens.toLocaleString(), icon: <Bot size={16} />, accent: false },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-neutral-border bg-surface-card p-5">
                      <div className={cn('mb-3 flex h-8 w-8 items-center justify-center rounded-lg',
                        stat.accent ? 'bg-gradient-to-br from-primary-blue to-primary-purple text-white' : 'bg-bg-secondary text-text-muted'
                      )}>
                        {stat.icon}
                      </div>
                      <p className="text-2xl font-bold font-mono text-text-primary">{stat.value}</p>
                      <p className="mt-0.5 text-xs text-text-muted">{stat.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Per-session usage */}
              {sessionUsage.length > 0 && (
                <div className="rounded-xl border border-neutral-border bg-surface-card overflow-hidden">
                  <div className="border-b border-neutral-border px-6 py-4 flex items-center gap-2">
                    <Bot size={15} className="text-text-muted" />
                    <h3 className="text-sm font-semibold text-text-primary">Agent Session Usage</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-neutral-border bg-bg-secondary">
                          {['Session', 'Messages', 'Tokens', 'Credits Used', 'Last Active'].map((h) => (
                            <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-border">
                        {sessionUsage.map((s) => (
                          <tr key={s.id} className="hover:bg-bg-secondary transition-colors">
                            <td className="px-6 py-3 text-sm font-medium text-text-primary truncate max-w-[200px]">{s.title}</td>
                            <td className="px-6 py-3 text-sm font-mono text-text-secondary">{s.message_count}</td>
                            <td className="px-6 py-3 text-sm font-mono text-text-secondary">{s.total_tokens.toLocaleString()}</td>
                            <td className="px-6 py-3">
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary-blue/10 px-2.5 py-0.5 text-xs font-semibold text-primary-blue">
                                <Coins size={10} />{s.total_credits}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-xs text-text-muted">
                              {new Date(s.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Credit transaction history */}
              {creditHistory.length > 0 && (
                <div className="rounded-xl border border-neutral-border bg-surface-card overflow-hidden">
                  <div className="border-b border-neutral-border px-6 py-4 flex items-center gap-2">
                    <Receipt size={15} className="text-text-muted" />
                    <h3 className="text-sm font-semibold text-text-primary">Credit History</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-neutral-border bg-bg-secondary">
                          {['Date', 'Type', 'Amount', 'Description', 'By'].map((h) => (
                            <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-border">
                        {creditHistory.map((tx) => (
                          <tr key={tx.id} className="hover:bg-bg-secondary transition-colors">
                            <td className="px-6 py-3 text-xs text-text-muted whitespace-nowrap">
                              {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="px-6 py-3">
                              <span className={cn(
                                'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize',
                                tx.type === 'purchase' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                              )}>
                                {tx.type}
                              </span>
                            </td>
                            <td className="px-6 py-3">
                              <span className={cn('font-mono font-semibold text-sm',
                                tx.amount > 0 ? 'text-emerald-600' : 'text-text-primary'
                              )}>
                                {tx.amount > 0 ? '+' : ''}{tx.amount} cr
                              </span>
                            </td>
                            <td className="px-6 py-3 text-sm text-text-secondary truncate max-w-[220px]">{tx.description}</td>
                            <td className="px-6 py-3 text-xs text-text-muted">{tx.user_name || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!usageSummary && !usageLoading && (
                <div className="text-center py-16 text-text-muted text-sm">No usage data yet.</div>
              )}
            </>
          )}
        </div>
      )}

      {/* Arka Microstacks partnership banner — hidden on Agent Credits tab */}
      {tab !== 'credits' && <div
        className="flex items-center gap-4 rounded-xl px-5 py-3 shadow-sm"
        style={{ background: 'linear-gradient(135deg, rgba(71,126,247,0.08) 0%, rgba(130,96,246,0.08) 100%)', border: '1px solid rgba(130,96,246,0.2)' }}
      >
        {/* Real ARKA logo (same asset as the marketing site). The navy lockup needs a light
            ground, so dark mode gives it a white chip. */}
        <span className="flex-shrink-0 rounded-lg dark:bg-white dark:px-3 dark:py-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- static partner asset */}
          <img
            src="/images/partners/arka-microstacks.png"
            alt="ARKA MicroStacks"
            className="h-8 w-auto"
            width={900}
            height={402}
          />
        </span>
        <div className="h-8 w-px flex-shrink-0" style={{ background: 'rgba(130,96,246,0.25)' }} />
        <p className="text-sm text-text-secondary leading-snug">
          Partnered with{' '}
          <strong className="font-semibold" style={{ color: 'var(--primary-purple)' }}>ARKA Microstacks</strong>
          {' '}for Managed Cloud Services
        </p>
      </div>}

    </div>
  );
}

// `useSearchParams()` requires a Suspense boundary for the production build — every
// other page that reads search params is wrapped the same way (go-live audit P0 #6a).
export default function BillingPage() {
  return (
    <Suspense>
      <BillingPageInner />
    </Suspense>
  );
}
