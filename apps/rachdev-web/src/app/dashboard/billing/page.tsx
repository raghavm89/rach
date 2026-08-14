'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Coins, Check, Zap, RefreshCw, ReceiptText, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { agent, users, type CreditPack, type BillingAddress } from '@rach/ui/lib/api';
import { PageHeader } from '@/components/dashboard/PageHeader';

// Buyer's country drives currency + GST on credits; a full address + (optional)
// GSTIN is what makes the tax invoice compliant. Kept minimal on purpose.
const COUNTRIES = ['India', 'United States', 'United Kingdom', 'Singapore', 'Australia', 'Canada', 'Germany', 'UAE', 'Other'];
const emptyAddress = (): BillingAddress => ({ line1: '', line2: '', city: '', state: '', pincode: '', country: 'India' });
const addressComplete = (a: BillingAddress | null | undefined) =>
  !!(a && a.line1?.trim() && a.city?.trim() && a.state?.trim() && a.pincode?.trim() && a.country?.trim());

// Display-only INR rate (mirrors the backend USD_TO_INR default). The exact
// charged amount comes from the purchase endpoint and shows in Razorpay.
const INR_PER_USD = 90;
const inr = (usd: number) => `₹${Math.round(usd * INR_PER_USD).toLocaleString('en-IN')}`;

interface RazorpayResponse { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
interface RazorpayWindow { Razorpay?: new (opts: Record<string, unknown>) => { open: () => void } }

function loadRazorpay(): Promise<void> {
  return new Promise((resolve) => {
    if ((window as unknown as RazorpayWindow).Razorpay) return resolve();
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
}

export default function BillingPage() {
  const { token, user, updateUser } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof agent.getCreditHistory>>['transactions']>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Billing details (saved to the user profile — the source pricing + invoicing read).
  const [bizName, setBizName] = useState('');
  const [gstin, setGstin] = useState('');
  const [addr, setAddr] = useState<BillingAddress>(emptyAddress());
  const [savingBilling, setSavingBilling] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);

  // Hydrate the form from the signed-in user's saved profile.
  useEffect(() => {
    if (!user) return;
    setBizName(user.business_name || '');
    setGstin(user.gstin || '');
    setAddr({ ...emptyAddress(), ...(user.billing_address || {}) });
  }, [user]);

  const billingReady = addressComplete(user?.billing_address);

  async function saveBilling() {
    if (!token) return;
    if (!addressComplete(addr)) { toast.error('Fill address line 1, city, state, PIN/ZIP and country.'); return; }
    setSavingBilling(true);
    try {
      const res = await users.updateMe(token, {
        account_type: (bizName.trim() || gstin.trim()) ? 'business' : 'individual',
        business_name: bizName.trim() || null,
        gstin: gstin.trim() ? gstin.trim().toUpperCase() : null,
        billing_address: addr,
      });
      updateUser(res.user);
      setBillingOpen(false);
      toast.success('Billing details saved');
    } catch (e) { toast.error((e as Error).message || 'Could not save billing details'); }
    finally { setSavingBilling(false); }
  }

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError('');
      const [c, h] = await Promise.all([agent.getCredits(token), agent.getCreditHistory(token, 1)]);
      setBalance(c.balance);
      setPacks(c.packs);
      setHistory(h.transactions);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function buy(pack: CreditPack) {
    if (!token) return;
    // Require billing details first so the charge is priced correctly (currency +
    // GST) and the tax invoice is compliant. Both are read from the saved profile.
    if (!billingReady) {
      toast.error('Add your billing details before purchasing.');
      setBillingOpen(true);
      if (typeof document !== 'undefined') document.getElementById('billing-details')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    setBuying(pack.id); setError('');
    try {
      const order = await agent.purchaseCredits(token, pack.id);
      await loadRazorpay();
      const Razorpay = (window as unknown as RazorpayWindow).Razorpay!;
      new Razorpay({
        key: order.razorpay_key_id,
        order_id: order.order_id,
        amount: order.amount,
        currency: order.currency,
        name: 'RachDev Agent Credits',
        description: `${pack.label} — ${pack.credits.toLocaleString('en-IN')} credits`,
        prefill: { email: user?.email, name: user?.name },
        theme: { color: '#2563eb' },
        handler: async (r: RazorpayResponse) => {
          try {
            const res = await agent.verifyPurchase(token, {
              razorpay_order_id: r.razorpay_order_id,
              razorpay_payment_id: r.razorpay_payment_id,
              razorpay_signature: r.razorpay_signature,
              pack_id: pack.id,
            });
            setBalance(res.balance);
            toast.success(`Added ${res.credits_added.toLocaleString('en-IN')} credits`);
            load();
          } catch (e) { toast.error((e as Error).message || 'Verification failed'); }
        },
        modal: { ondismiss: () => setBuying(null) },
      }).open();
    } catch (e) {
      toast.error((e as Error).message || 'Could not start checkout');
    } finally {
      setBuying(null);
    }
  }

  const isAdmin = user?.role === 'tenant_admin' || user?.role === 'admin';

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Billing & credits"
        subtitle="Credits power your agent runs. Top up anytime — pay per pack, no subscription."
        actions={
          <button onClick={() => { setLoading(true); load(); }} disabled={loading} className="flex items-center gap-2 rounded-lg border border-neutral-border bg-surface-card px-4 py-2 text-sm font-medium text-dash-muted hover:bg-surface-hover disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />
      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

      {/* Balance */}
      <div className="mt-6 flex items-center justify-between rounded-2xl border border-accent/30 bg-accent-weak/40 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-white"><Coins size={20} /></div>
          <div>
            <p className="text-[12px] uppercase tracking-wide text-dash-muted">Credit balance</p>
            <p className="text-3xl font-semibold text-dash-heading">
              {loading ? '—' : (balance ?? 0).toLocaleString('en-IN')}
              <span className="ml-1 text-sm font-normal text-dash-muted">credits</span>
            </p>
          </div>
        </div>
        <p className="hidden text-[12px] text-dash-muted sm:block">1 credit ≈ 1,000 tokens</p>
      </div>

      {!isAdmin && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
          Only the workspace owner can buy credits. Ask your admin to top up.
        </p>
      )}

      {/* Billing details — the source pricing (currency + GST) and the tax invoice read from. */}
      {isAdmin && (
        <div id="billing-details" className="mt-6 rounded-2xl border border-neutral-border bg-surface-card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ReceiptText size={16} className="text-accent" />
              <h3 className="text-sm font-semibold text-dash-heading">Billing details</h3>
              {billingReady
                ? <span className="rounded-full bg-ok-bg px-2 py-0.5 text-[11px] font-medium text-ok">Complete</span>
                : <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">Required before purchase</span>}
            </div>
            <button onClick={() => setBillingOpen((v) => !v)} className="text-[13px] font-medium text-accent hover:underline">
              {billingOpen ? 'Close' : billingReady ? 'Edit' : 'Add details'}
            </button>
          </div>

          {!billingOpen && billingReady && (
            <p className="mt-2 text-[13px] text-dash-muted">
              {[user?.business_name, user?.gstin && `GSTIN ${user.gstin}`, user?.billing_address?.city, user?.billing_address?.country].filter(Boolean).join(' · ')}
            </p>
          )}

          {billingOpen && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-[12px] text-dash-muted">Business name (optional)
                <input value={bizName} onChange={(e) => setBizName(e.target.value)} placeholder="Acme Pvt Ltd"
                  className="mt-1 w-full rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading" />
              </label>
              <label className="text-[12px] text-dash-muted">GSTIN (optional — for GST invoice)
                <input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" maxLength={15}
                  className="mt-1 w-full rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading" />
              </label>
              <label className="text-[12px] text-dash-muted sm:col-span-2">Address line 1
                <input value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} placeholder="Street, building"
                  className="mt-1 w-full rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading" />
              </label>
              <label className="text-[12px] text-dash-muted sm:col-span-2">Address line 2 (optional)
                <input value={addr.line2 || ''} onChange={(e) => setAddr({ ...addr, line2: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading" />
              </label>
              <label className="text-[12px] text-dash-muted">City
                <input value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading" />
              </label>
              <label className="text-[12px] text-dash-muted">State / Province
                <input value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })} placeholder="e.g. Karnataka"
                  className="mt-1 w-full rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading" />
              </label>
              <label className="text-[12px] text-dash-muted">PIN / ZIP
                <input value={addr.pincode} onChange={(e) => setAddr({ ...addr, pincode: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading" />
              </label>
              <label className="text-[12px] text-dash-muted">Country
                <select value={addr.country} onChange={(e) => setAddr({ ...addr, country: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading">
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <div className="sm:col-span-2">
                <button onClick={saveBilling} disabled={savingBilling}
                  className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                  {savingBilling ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save billing details
                </button>
                <p className="mt-2 text-[11px] text-dash-muted">Indian buyers with a GSTIN get a GST tax invoice; the country sets the currency and tax. Used for every credit purchase.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Packs */}
      <h3 className="mb-3 mt-8 text-sm font-semibold text-dash-heading">Top up</h3>
      {loading ? (
        <p className="text-sm text-dash-muted">Loading…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {packs.map((p, i) => (
            <div key={p.id} className={`rounded-2xl border bg-surface-card p-4 ${i === 2 ? 'border-accent' : 'border-neutral-border'}`}>
              {i === 2 && <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-accent-weak px-2 py-0.5 text-[10px] font-semibold text-accent"><Zap size={10} /> Popular</span>}
              <p className="text-sm font-semibold text-dash-heading">{p.label}</p>
              <p className="mt-1 text-2xl font-bold text-dash-heading">{p.credits.toLocaleString('en-IN')}<span className="ml-1 text-[12px] font-normal text-dash-muted">credits</span></p>
              <p className="mt-0.5 text-[13px] text-dash-muted">{inr(p.price_usd)}</p>
              <button
                onClick={() => buy(p)}
                disabled={!isAdmin || !!buying}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {buying === p.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Buy
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-[11px] text-dash-muted">Prices are placeholders shown at ₹{INR_PER_USD}/USD; final pricing is set by the pack config + USD_TO_INR. Billed once via Razorpay — not a subscription.</p>

      {/* History */}
      <h3 className="mb-3 mt-8 text-sm font-semibold text-dash-heading">Recent transactions</h3>
      <div className="overflow-hidden rounded-2xl border border-neutral-border bg-surface-card">
        <table className="w-full text-sm">
          <tbody>
            {loading ? (
              <tr><td className="px-5 py-8 text-center text-dash-muted">Loading…</td></tr>
            ) : history.length === 0 ? (
              <tr><td className="px-5 py-8 text-center text-dash-muted">No transactions yet.</td></tr>
            ) : history.map((t) => (
              <tr key={t.id} className="border-b border-neutral-border last:border-0">
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${t.amount >= 0 ? 'bg-ok-bg text-ok' : 'bg-surface-hover text-dash-muted'}`}>
                    {t.amount >= 0 ? 'Added' : 'Used'}
                  </span>
                </td>
                <td className="px-3 py-3 text-dash-body">{t.description || (t.amount >= 0 ? 'Credit purchase' : 'Agent usage')}</td>
                <td className="px-3 py-3 text-right font-medium text-dash-heading">{t.amount >= 0 ? '+' : ''}{t.amount.toLocaleString('en-IN')}</td>
                <td className="px-5 py-3 text-right text-[11px] text-dash-muted">{new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
