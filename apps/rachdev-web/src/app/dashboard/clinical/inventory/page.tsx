'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, PackagePlus, AlertTriangle, Check, X, Pill } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { inventory, type StockItem, type ReorderAlert } from '@rach/ui/lib/api';
import { PageHeader } from '@/components/dashboard/PageHeader';

export default function InventoryPage() {
  const { token } = useAuth();
  const [stock, setStock] = useState<StockItem[]>([]);
  const [alerts, setAlerts] = useState<ReorderAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');

  // dispense
  const [rx, setRx] = useState('');
  // add drug
  const [nd, setNd] = useState({ drug: '', unit: 'tablet', quantity: '', reorder_threshold: '' });
  // restock inputs keyed by drug
  const [restockQty, setRestockQty] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [s, a] = await Promise.all([inventory.stock(token), inventory.alerts(token)]);
      setStock(s.stock); setAlerts(a.alerts);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const note = (msg: string) => { setFlash(msg); setTimeout(() => setFlash(''), 3000); };

  const dispense = async () => {
    if (!token || !rx.trim()) return;
    setBusy(true); setError('');
    try {
      const { item, alert } = await inventory.dispense(token, { prescription: rx.trim() });
      setRx('');
      note(alert ? `Dispensed ${item.drug} — shortage alert raised.` : `Dispensed ${item.drug}. ${item.quantity} ${item.unit} left.`);
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const addDrug = async () => {
    if (!token || !nd.drug.trim()) return;
    setBusy(true); setError('');
    try {
      await inventory.upsertStock(token, {
        drug: nd.drug.trim(), unit: nd.unit || 'unit',
        quantity: parseInt(nd.quantity, 10) || 0, reorder_threshold: parseInt(nd.reorder_threshold, 10) || 0,
      });
      setNd({ drug: '', unit: 'tablet', quantity: '', reorder_threshold: '' });
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const restock = async (drug: string) => {
    const qty = parseInt(restockQty[drug], 10);
    if (!token || !qty) return;
    setBusy(true); setError('');
    try {
      await inventory.restock(token, { drug, qty });
      setRestockQty((m) => ({ ...m, [drug]: '' }));
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const resolve = async (id: number, status: 'ordered' | 'dismissed') => {
    if (!token) return;
    try { await inventory.resolveAlert(token, id, status); await load(); }
    catch (e) { setError((e as Error).message); }
  };

  const openAlerts = alerts.filter((a) => a.status === 'open');

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Inventory" subtitle="Kiran — pharmacy stock, dispensing & shortage alerts" />

      {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {flash && <div className="mb-4 rounded-xl border border-ok-line bg-ok-bg px-4 py-3 text-sm text-ok">{flash}</div>}

      {/* Shortage alerts */}
      {openAlerts.length > 0 && (
        <div className="mb-6 rounded-xl border border-wait-line bg-wait-bg/60 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-wait"><AlertTriangle size={15} /> Shortage alerts ({openAlerts.length})</h3>
          <div className="space-y-2">
            {openAlerts.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-border bg-surface-card px-3 py-2 text-sm">
                <span className="text-dash-heading">{a.message || `${a.drug} low — reorder ${a.qty_suggested}`}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => resolve(a.id, 'ordered')} className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90"><Check size={12} /> Mark ordered</button>
                  <button onClick={() => resolve(a.id, 'dismissed')} className="inline-flex items-center gap-1 rounded-lg border border-neutral-border px-2.5 py-1 text-xs text-dash-body hover:bg-surface-hover"><X size={12} /> Dismiss</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dispense (prescription → stock) */}
      <div className="mb-6 rounded-xl border border-neutral-border bg-surface-card p-5">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-dash-heading"><Pill size={15} /> Dispense a prescription</h3>
        <div className="flex flex-wrap items-center gap-2">
          <input value={rx} onChange={(e) => setRx(e.target.value)} placeholder='e.g. "Metformin 500mg #30"'
            className="flex-1 min-w-[240px] rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading focus:border-accent focus:outline-none" />
          <button onClick={dispense} disabled={busy || !rx.trim()} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Pill size={14} />} Dispense
          </button>
        </div>
        <p className="mt-1.5 text-xs text-dash-muted">Approved prescriptions decrement stock; Kiran raises a reorder alert when a drug crosses its threshold.</p>
      </div>

      {/* Stock table */}
      <div className="overflow-hidden rounded-xl border border-neutral-border bg-surface-card">
        <div className="border-b border-neutral-border px-5 py-3"><h3 className="text-sm font-semibold text-dash-heading">Drug stock</h3></div>
        {loading ? (
          <div className="flex items-center gap-2 px-5 py-6 text-sm text-dash-muted"><Loader2 size={16} className="animate-spin" /> Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-border text-left text-xs uppercase tracking-wide text-dash-muted">
                {['Drug', 'Qty', 'Reorder at', 'Status', 'Restock'].map((h) => <th key={h} className="px-5 py-2.5 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {stock.map((it) => (
                <tr key={it.id} className="border-b border-neutral-border last:border-0">
                  <td className="px-5 py-3 font-medium text-dash-heading">{it.drug} <span className="text-xs text-dash-muted">/ {it.unit}</span></td>
                  <td className="px-5 py-3 text-dash-body">{it.quantity}</td>
                  <td className="px-5 py-3 text-dash-muted">{it.reorder_threshold}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${it.low ? 'bg-wait-bg text-wait' : 'bg-ok-bg text-ok'}`}>{it.low ? 'Low' : 'OK'}</span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <input value={restockQty[it.drug] ?? ''} onChange={(e) => setRestockQty((m) => ({ ...m, [it.drug]: e.target.value }))}
                        placeholder="+qty" className="w-16 rounded-lg border border-neutral-border bg-surface-app px-2 py-1 text-sm text-dash-heading focus:border-accent focus:outline-none" />
                      <button onClick={() => restock(it.drug)} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-neutral-border px-2 py-1 text-xs text-dash-body hover:bg-surface-hover disabled:opacity-50"><PackagePlus size={13} /> Add</button>
                    </div>
                  </td>
                </tr>
              ))}
              {stock.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-dash-muted">No drugs yet — add one below.</td></tr>}
            </tbody>
          </table>
        )}
        {/* Add drug */}
        <div className="flex flex-wrap items-end gap-2 border-t border-neutral-border bg-surface-hover/40 p-4">
          <input value={nd.drug} onChange={(e) => setNd({ ...nd, drug: e.target.value })} placeholder="Drug name" className="flex-1 min-w-[160px] rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading focus:border-accent focus:outline-none" />
          <input value={nd.unit} onChange={(e) => setNd({ ...nd, unit: e.target.value })} placeholder="unit" className="w-24 rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading focus:border-accent focus:outline-none" />
          <input value={nd.quantity} onChange={(e) => setNd({ ...nd, quantity: e.target.value })} placeholder="qty" className="w-20 rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading focus:border-accent focus:outline-none" />
          <input value={nd.reorder_threshold} onChange={(e) => setNd({ ...nd, reorder_threshold: e.target.value })} placeholder="reorder at" className="w-24 rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading focus:border-accent focus:outline-none" />
          <button onClick={addDrug} disabled={busy || !nd.drug.trim()} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"><Plus size={14} /> Save</button>
        </div>
      </div>
    </div>
  );
}
