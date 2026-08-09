'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Plus, Loader2, Sparkles, Trash2, ChevronRight } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { hr } from '@rach/ui/lib/api';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { Modal, Field, inputCls } from '@/components/dashboard/Modal';
import {
  REQ_STATUS_LABELS, formatBand, formatDate,
  type Requisition, type Application, type RequisitionStatus,
} from '@/lib/hr/demo';

const emptyReq = {
  title: '', dept: '', hiringManager: '', min: '', max: '', headcount: '1',
  location: '', workMode: 'hybrid', minExp: '', joinDays: '30', mustHaves: '',
};

const STATUS_CLASS: Record<RequisitionStatus, string> = {
  draft: 'bg-surface-hover text-dash-muted',
  jd_review: 'bg-amber-50 text-amber-600',
  open: 'bg-accent-weak text-accent',
  offer_stage: 'bg-ok-bg text-ok',
  closed: 'bg-surface-hover text-dash-muted',
};

export default function HrRequisitionsPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const isDirector = user?.role === 'hr_director';

  const [reqs, setReqs] = useState<Requisition[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError('');
      const [r, a] = await Promise.all([
        hr.list<Requisition>('requisitions', token),
        hr.list<Application>('applications', token),
      ]);
      setReqs(r);
      setApps(a);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const activeFor = (reqId: string) => apps.filter((a) => a.requisitionId === reqId && a.stage !== 'rejected').length;

  const deleteReq = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!token || !window.confirm('Delete this requisition? This cannot be undone.')) return;
    setDeletingId(id); setError('');
    try {
      await hr.remove('requisitions', id, token);
      setReqs((list) => list.filter((r) => r.id !== id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  // New-requisition modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyReq);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const set = (k: keyof typeof emptyReq, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submitAndDraft = async () => {
    if (!token || !form.title.trim()) return;
    setCreating(true); setCreateError('');
    try {
      const min = Math.round((Number(form.min) || 0) * 100000);
      const max = Math.round((Number(form.max) || 0) * 100000);
      const requisition = {
        id: `REQ-${Date.now()}`,
        title: form.title.trim(), dept: form.dept.trim(), hiringManager: form.hiringManager.trim(),
        headcount: Number(form.headcount) || 1,
        compBandINR: { min, max: Math.max(max, min) },
        location: form.location.trim(), workMode: form.workMode,
        minExperienceYears: Number(form.minExp) || 0, noticeNeedDays: Number(form.joinDays) || 30,
        mustHaves: form.mustHaves.split(',').map((s) => s.trim()).filter(Boolean),
        status: 'open', screening: { scoreThreshold: 70 }, createdAt: new Date().toISOString(),
      };
      await hr.create<Requisition>('requisitions', requisition, token);
      await hr.draftJd(requisition, token);           // JD-writer agent → routes a jd_approval
      router.push(`/dashboard/hr/requisitions/${requisition.id}`); // land on the JD detail
    } catch (e) {
      setCreateError((e as Error).message);
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Requisitions"
        subtitle="Every opening starts here — submit a requisition and the AI drafts the JD for human review."
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => { setLoading(true); load(); }} disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-neutral-border bg-surface-card px-3 py-2 text-sm font-medium text-dash-muted hover:bg-surface-hover disabled:opacity-50">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button onClick={() => { setCreateError(''); setForm(emptyReq); setShowCreate(true); }}
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
              <Plus size={15} /> New requisition
            </button>
          </div>
        }
      />

      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

      <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-border bg-surface-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-border text-left text-xs text-dash-muted">
              <th className="px-5 py-2.5 font-medium">Role</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Hiring manager</th>
              <th className="px-3 py-2.5 font-medium">Comp band</th>
              <th className="px-3 py-2.5 text-right font-medium">Headcount</th>
              <th className="px-3 py-2.5 text-right font-medium">Active</th>
              <th className="px-3 py-2.5 text-right font-medium">Created</th>
              <th className="px-5 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-5 py-8 text-center text-dash-muted">Loading…</td></tr>
            ) : reqs.length === 0 ? (
              <tr><td colSpan={8} className="px-5 py-8 text-center text-dash-muted">No requisitions yet — create one to get started.</td></tr>
            ) : reqs.map((r) => (
              <tr key={r.id} onClick={() => router.push(`/dashboard/hr/requisitions/${r.id}`)}
                className="group cursor-pointer border-b border-neutral-border last:border-0 hover:bg-surface-hover/40">
                <td className="px-5 py-3">
                  <div className="font-medium text-dash-heading">{r.title}</div>
                  <div className="text-[11px] text-dash-muted">{r.dept} · {r.id}</div>
                </td>
                <td className="px-3 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[r.status]}`}>{REQ_STATUS_LABELS[r.status]}</span>
                </td>
                <td className="px-3 py-3 text-dash-body">{r.hiringManager}</td>
                <td className="px-3 py-3 text-[12px] text-dash-body">{formatBand(r.compBandINR)}</td>
                <td className="px-3 py-3 text-right text-dash-body">{r.headcount}</td>
                <td className="px-3 py-3 text-right text-dash-body">{activeFor(r.id)}</td>
                <td className="px-3 py-3 text-right text-[11px] text-dash-muted">{formatDate(r.createdAt)}</td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {isDirector && (
                      <button onClick={(e) => deleteReq(e, r.id)} disabled={deletingId === r.id} aria-label="Delete requisition"
                        className="rounded-md p-1 text-dash-muted opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 disabled:opacity-50">
                        {deletingId === r.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    )}
                    <ChevronRight size={15} className="text-dash-muted/50" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <Modal
          title="New requisition"
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <button onClick={() => setShowCreate(false)} className="rounded-lg border border-neutral-border px-4 py-2 text-sm font-medium text-dash-body hover:bg-surface-hover">Cancel</button>
              <button onClick={submitAndDraft} disabled={creating || !form.title.trim()} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {creating ? 'Drafting JD…' : 'Submit and draft JD'}
              </button>
            </>
          }
        >
          {createError && <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{createError}</div>}
          <p className="mb-3 text-xs text-dash-muted">Submit the facts — the AI drafts the JD, then the approval chain takes over.</p>
          <Field label="Role title"><input autoFocus value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Senior Backend Engineer" className={inputCls} /></Field>
          <Field label="Department / team"><input value={form.dept} onChange={(e) => set('dept', e.target.value)} placeholder="e.g. Engineering — Platform" className={inputCls} /></Field>
          <Field label="Hiring manager"><input value={form.hiringManager} onChange={(e) => set('hiringManager', e.target.value)} className={inputCls} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Headcount"><input type="number" value={form.headcount} onChange={(e) => set('headcount', e.target.value)} className={inputCls} /></Field>
            <Field label="Band min (LPA)"><input type="number" value={form.min} onChange={(e) => set('min', e.target.value)} placeholder="28" className={inputCls} /></Field>
            <Field label="Band max (LPA)"><input type="number" value={form.max} onChange={(e) => set('max', e.target.value)} placeholder="40" className={inputCls} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Location"><input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Bengaluru" className={inputCls} /></Field>
            <Field label="Work mode">
              <select value={form.workMode} onChange={(e) => set('workMode', e.target.value)} className={inputCls}>
                <option value="onsite">Onsite</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Min experience (years)"><input type="number" value={form.minExp} onChange={(e) => set('minExp', e.target.value)} placeholder="3" className={inputCls} /></Field>
            <Field label="Joining need (days)"><input type="number" value={form.joinDays} onChange={(e) => set('joinDays', e.target.value)} className={inputCls} /></Field>
          </div>
          <Field label="Must-haves (comma-separated)"><input value={form.mustHaves} onChange={(e) => set('mustHaves', e.target.value)} placeholder="PostgreSQL, Kafka, AWS, Distributed systems" className={inputCls} /></Field>
        </Modal>
      )}
    </div>
  );
}
