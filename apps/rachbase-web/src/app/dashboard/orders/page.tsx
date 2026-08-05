'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShoppingBag, RefreshCw, AlertCircle, Clock,
  CheckCircle2, XCircle, Plus, Ban, Loader2,
  X, Server, CreditCard, Calendar, ChevronRight, Building2,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { expansion, ExpansionRequest } from '@rach/ui/lib/api';
import { cn } from '@rach/ui/lib/utils';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  pending            : { label: 'Active',               cls: 'bg-amber-50 text-amber-700 border border-amber-200',       icon: <Clock size={11} /> },
  fulfilled          : { label: 'Fulfilled',             cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', icon: <CheckCircle2 size={11} /> },
  cancelled          : { label: 'Cancelled',             cls: 'bg-surface-hover text-text-muted border border-neutral-border', icon: <XCircle size={11} /> },
  cancel_at_period_end: { label: 'Cancels at cycle end', cls: 'bg-orange-50 text-orange-700 border border-orange-200',   icon: <Ban size={11} /> },
};

function usd(cents: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', minimumFractionDigits: 0,
  }).format(cents / 100);
}

function isCancellable(order: ExpansionRequest) {
  return (
    !!order.razorpay_subscription_id &&
    order.status !== 'cancelled' &&
    order.subscription_status !== 'cancel_at_period_end'
  );
}

// ─── Order Detail Modal ───────────────────────────────────────────────────────

function OrderDetailModal({ request: r, onClose }: { request: ExpansionRequest; onClose: () => void }) {
  const STATUS_STYLE: Record<string, { dot: string; badge: string; label: string }> = {
    pending  : { dot: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700 border-amber-200',       label: 'Pending' },
    fulfilled: { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Fulfilled' },
    cancelled: { dot: 'bg-neutral-400', badge: 'bg-surface-hover text-text-muted border-neutral-border', label: 'Cancelled' },
  };
  const s = STATUS_STYLE[r.status] ?? STATUS_STYLE.pending;

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('en-IN', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }) : null;

  const amountDisplay =
    r.amount_paid > 0
      ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: r.currency ?? 'INR' }).format(r.amount_paid / 100)
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg rounded-2xl bg-surface-card shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-neutral-border">
          <div>
            <h3 className="font-bold text-text-primary">Order #{r.id}</h3>
            <p className="text-xs text-text-muted mt-0.5">Placed {fmt(r.requested_at)}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-bg-secondary transition-colors">
            <X size={16} className="text-text-muted" />
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
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">What was ordered</p>
            <p className="text-sm font-medium text-text-primary">
              {r.custom_description ?? r.package_name ?? 'Custom resource order'}
            </p>
            {r.vm_count != null && r.vm_count > 0 && (
              <p className="text-xs text-text-muted mt-1 flex items-center gap-1">
                <Server size={11} /> {r.vm_count} VM{r.vm_count !== 1 ? 's' : ''} included
              </p>
            )}
            {r.notes && <p className="text-xs text-text-muted mt-2 italic">{r.notes}</p>}
          </div>

          {/* Tenant info (admin view) */}
          {r.tenant_name && (
            <div className="rounded-xl border border-neutral-border p-4">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Tenant</p>
              <div className="flex items-center gap-2">
                <Building2 size={13} className="text-text-muted" />
                <span className="text-sm text-text-primary font-medium">{r.tenant_name}</span>
              </div>
              {r.requested_by_name && (
                <p className="text-xs text-text-muted mt-1">Requested by: {r.requested_by_name}</p>
              )}
            </div>
          )}

          {/* Payment */}
          {(amountDisplay || r.razorpay_payment_id || r.razorpay_order_id) && (
            <div className="rounded-xl border border-neutral-border p-4 space-y-3">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Payment</p>
              {amountDisplay && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-text-secondary">
                    <CreditCard size={14} className="text-text-muted" /> Amount paid
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
                    <Calendar size={11} /> Next charge
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

// ─── Orders Page ──────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const { user, token } = useAuth();
  const router = useRouter();

  const isAdmin = user?.role === 'admin';

  const [orders, setOrders]               = useState<ExpansionRequest[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [refreshing, setRefreshing]       = useState(false);
  const [cancelling, setCancelling]       = useState<number | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<number | null>(null);
  const [selected, setSelected]           = useState<ExpansionRequest | null>(null);
  const [statusFilter, setStatusFilter]   = useState('');
  const [actionId, setActionId]           = useState<number | null>(null);

  useEffect(() => {
    if (user && !['admin', 'tenant_admin', 'tenant_user'].includes(user.role)) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const fetchOrders = useCallback(async (isRefresh = false) => {
    if (!token) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const data = isAdmin
        ? await expansion.allRequests(token, statusFilter || undefined)
        : await expansion.myRequests(token);
      setOrders(data.requests);
    } catch (err) {
      setError((err as Error).message || 'Failed to load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, isAdmin, statusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleCancel = useCallback(async (orderId: number) => {
    if (!token) return;
    setCancelling(orderId);
    setCancelConfirm(null);
    try {
      const res = await expansion.cancelMySubscription(token, orderId);
      setOrders((prev) => prev.map((o) => o.id === orderId ? res.request : o));
    } catch (err) {
      setError((err as Error).message || 'Failed to cancel subscription');
    } finally {
      setCancelling(null);
    }
  }, [token]);

  const handleFulfil = useCallback(async (orderId: number) => {
    if (!token) return;
    setActionId(orderId);
    try {
      await expansion.fulfilRequest(token, orderId);
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: 'fulfilled', fulfilled_at: new Date().toISOString() } : o));
    } catch (err) {
      setError((err as Error).message || 'Failed to fulfil order');
    } finally {
      setActionId(null);
    }
  }, [token]);

  const handleAdminCancel = useCallback(async (orderId: number) => {
    if (!token) return;
    setActionId(orderId);
    try {
      await expansion.cancelRequest(token, orderId);
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: 'cancelled' } : o));
    } catch (err) {
      setError((err as Error).message || 'Failed to cancel order');
    } finally {
      setActionId(null);
      setCancelConfirm(null);
    }
  }, [token]);

  const pending   = orders.filter((o) => o.status === 'pending').length;
  const fulfilled = orders.filter((o) => o.status === 'fulfilled').length;

  return (
    <div className="max-w-4xl space-y-6">

      {/* Detail modal */}
      {selected && <OrderDetailModal request={selected} onClose={() => setSelected(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display text-text-primary">Orders</h2>
          <p className="mt-0.5 text-sm text-text-muted">
            {isAdmin ? 'All tenant resource provisioning requests' : 'Your resource provisioning requests'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-neutral-border bg-surface-card px-3 py-2 text-sm text-text-secondary focus:border-primary-blue focus:outline-none"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="cancelled">Cancelled</option>
            </select>
          )}
          <button
            onClick={() => fetchOrders(true)}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg border border-neutral-border bg-surface-card px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={cn(refreshing && 'animate-spin')} />
            Refresh
          </button>
          {!isAdmin && (
            <Link
              href="/dashboard/billing"
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-blue to-primary-purple px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              <Plus size={14} /> New Order
            </Link>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle size={15} className="shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto text-xs underline">Dismiss</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Orders', value: orders.length },
          { label: 'Active',       value: pending },
          { label: 'Fulfilled',    value: fulfilled },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-neutral-border bg-surface-card p-5">
            {loading
              ? <div className="h-8 w-12 animate-pulse rounded-lg bg-surface-hover mb-2" />
              : <p className="text-2xl font-bold font-mono text-text-primary">{s.value}</p>
            }
            <p className="mt-0.5 text-xs text-text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-neutral-border bg-surface-card overflow-hidden">
        <div className="border-b border-neutral-border px-6 py-4 flex items-center gap-2">
          <ShoppingBag size={16} className="text-text-muted" />
          <h3 className="text-sm font-semibold text-text-primary">Order History</h3>
          <span className="ml-auto text-xs text-text-muted">{orders.length} orders</span>
        </div>

        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-border bg-bg-secondary">
                  {['Order', ...(isAdmin ? ['Tenant'] : []), 'Amount', 'Status', 'Date', ''].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-border">
                {[...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4">
                      <div className="h-3.5 w-36 animate-pulse rounded bg-surface-hover mb-1.5" />
                      <div className="h-3 w-10 animate-pulse rounded bg-surface-hover" />
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4"><div className="h-5 w-28 animate-pulse rounded-full bg-surface-hover" /></td>
                    )}
                    <td className="px-6 py-4"><div className="h-4 w-16 animate-pulse rounded bg-surface-hover" /></td>
                    <td className="px-6 py-4"><div className="h-5 w-20 animate-pulse rounded-full bg-surface-hover" /></td>
                    <td className="px-6 py-4"><div className="h-3.5 w-24 animate-pulse rounded bg-surface-hover" /></td>
                    <td className="px-6 py-4"><div className="h-3.5 w-20 animate-pulse rounded bg-surface-hover" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-20 text-center">
            <ShoppingBag size={32} className="mx-auto text-text-muted mb-3" />
            <p className="text-sm text-text-muted">No orders yet.</p>
            {!isAdmin && (
              <Link
                href="/dashboard/billing"
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary-blue hover:underline"
              >
                <Plus size={13} /> Place your first order
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-border bg-bg-secondary">
                  {[
                    'Order',
                    ...(isAdmin ? ['Tenant'] : []),
                    'Amount', 'Status', 'Date', '',
                  ].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-border">
                {orders.map((order) => {
                  const statusKey = order.subscription_status === 'cancel_at_period_end' ? 'cancel_at_period_end' : order.status;
                  const sc        = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.pending;
                  const label     = order.custom_description ?? order.package_name ?? 'Custom Order';
                  const canCancel = isCancellable(order);

                  return (
                    <tr key={order.id} className="hover:bg-bg-secondary/50 transition-colors">

                      {/* Order description */}
                      <td className="px-6 py-4">
                        <p className="font-medium text-text-primary">{label}</p>
                        <p className="text-xs text-text-muted font-mono mt-0.5">#{order.id}</p>
                      </td>

                      {/* Tenant — admin only */}
                      {isAdmin && (
                        <td className="px-6 py-4">
                          {order.tenant_name ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-sky/20 px-2.5 py-0.5 text-xs font-medium text-primary-blue">
                              <Building2 size={10} />
                              {order.tenant_name}
                            </span>
                          ) : (
                            <span className="text-xs text-text-muted">—</span>
                          )}
                          {order.requested_by_name && (
                            <p className="text-xs text-text-muted mt-0.5">{order.requested_by_name}</p>
                          )}
                        </td>
                      )}

                      {/* Amount */}
                      <td className="px-6 py-4">
                        <span className="font-semibold font-mono text-text-primary">
                          {order.amount_paid ? usd(order.amount_paid) : '—'}
                        </span>
                        {order.razorpay_subscription_id && (
                          <span className="text-xs text-text-muted ml-1">/mo</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                          sc.cls,
                        )}>
                          {sc.icon}
                          {sc.label}
                        </span>
                        {order.status === 'fulfilled' && order.fulfilled_at && (
                          <p className="text-xs text-text-muted mt-0.5">
                            {new Date(order.fulfilled_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                          </p>
                        )}
                      </td>

                      {/* Requested date */}
                      <td className="px-6 py-4 text-text-secondary text-xs">
                        {new Date(order.requested_at).toLocaleDateString('en-IN', {
                          year: 'numeric', month: 'short', day: 'numeric',
                        })}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {/* View details */}
                          <button
                            onClick={() => setSelected(order)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary-blue hover:underline transition-colors"
                          >
                            View <ChevronRight size={12} />
                          </button>

                          {/* Admin: Fulfil + Cancel for pending orders */}
                          {isAdmin && order.status === 'pending' && cancelConfirm !== order.id && (
                            <>
                              <button
                                onClick={() => handleFulfil(order.id)}
                                disabled={actionId === order.id}
                                className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-primary-blue to-primary-purple px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                              >
                                {actionId === order.id
                                  ? <Loader2 size={11} className="animate-spin" />
                                  : <CheckCircle2 size={11} />}
                                Fulfil
                              </button>
                              <button
                                onClick={() => setCancelConfirm(order.id)}
                                disabled={actionId === order.id}
                                className="inline-flex items-center gap-1 rounded-lg border border-neutral-border px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-red-50 hover:border-red-300 hover:text-red-600 disabled:opacity-50 transition-all"
                              >
                                <X size={11} /> Cancel
                              </button>
                            </>
                          )}
                          {isAdmin && order.status === 'pending' && cancelConfirm === order.id && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-text-muted">Sure?</span>
                              <button
                                onClick={() => handleAdminCancel(order.id)}
                                disabled={actionId === order.id}
                                className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-60"
                              >
                                {actionId === order.id ? <Loader2 size={11} className="animate-spin" /> : <Ban size={11} />}
                                Yes
                              </button>
                              <button onClick={() => setCancelConfirm(null)} className="text-xs text-text-muted hover:text-text-primary">No</button>
                            </div>
                          )}

                          {/* Cancel — tenant only */}
                          {!isAdmin && canCancel && cancelConfirm !== order.id && (
                            <button
                              onClick={() => setCancelConfirm(order.id)}
                              className="text-xs text-red-500 hover:text-red-700 font-medium hover:underline transition-colors"
                            >
                              Cancel
                            </button>
                          )}
                          {!isAdmin && canCancel && cancelConfirm === order.id && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-text-muted">Sure?</span>
                              <button
                                onClick={() => handleCancel(order.id)}
                                disabled={cancelling === order.id}
                                className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-60"
                              >
                                {cancelling === order.id
                                  ? <Loader2 size={11} className="animate-spin" />
                                  : <Ban size={11} />}
                                Yes, cancel
                              </button>
                              <button
                                onClick={() => setCancelConfirm(null)}
                                className="text-xs text-text-muted hover:text-text-primary"
                              >
                                No
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isAdmin && (
        <p className="text-xs text-text-muted text-center">
          Subscription cancellations take effect at the end of the current billing cycle — no further charges after that.
          One-time orders are cancelled immediately if not yet fulfilled.
        </p>
      )}
    </div>
  );
}
