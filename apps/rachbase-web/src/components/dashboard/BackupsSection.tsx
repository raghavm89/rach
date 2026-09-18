'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, DatabaseBackup, Download, RotateCcw, ShieldAlert, Check, X, Clock } from 'lucide-react';
import { cn } from '@rach/ui/lib/utils';
import { projects as api, type BaasBackup, type BaasRestore } from '@rach/ui/lib/api';

/**
 * Backend → Backups. Lists managed-Postgres backups (daily, plan-tiered retention), lets the
 * user take an on-demand backup, download a backup, or restore one into a NEW database.
 */
function humanSize(bytes: number | null): string {
  if (bytes == null) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let n = bytes, i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}
function fmtDate(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: 'bg-emerald-50 text-emerald-700',
    running: 'bg-blue-50 text-primary-blue',
    pending: 'bg-blue-50 text-primary-blue',
    failed: 'bg-red-50 text-red-600',
  };
  const Icon = status === 'completed' ? Check : status === 'failed' ? X : Clock;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize', map[status] || 'bg-neutral-100 text-text-muted')}>
      <Icon size={11} /> {status}
    </span>
  );
}

export default function BackupsSection({ token, projectId }: { token: string; projectId: number }) {
  const [backups, setBackups] = useState<BaasBackup[]>([]);
  const [restores, setRestores] = useState<BaasRestore[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.baasBackups(token, projectId);
      setBackups(r.backups);
      setRestores(r.restores);
      setConfigured(r.storageConfigured);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load backups');
    } finally {
      setLoading(false);
    }
  }, [token, projectId]);

  useEffect(() => { load(); }, [load]);

  // Poll while anything is in flight so status flips without a manual refresh.
  useEffect(() => {
    const inFlight = backups.some((b) => b.status === 'running' || b.status === 'pending')
      || restores.some((r) => r.status === 'running' || r.status === 'pending');
    if (inFlight && !timer.current) { timer.current = setInterval(load, 8000); }
    if (!inFlight && timer.current) { clearInterval(timer.current); timer.current = null; }
    return () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
  }, [backups, restores, load]);

  const backupNow = async () => {
    setBusy(true); setMsg(null); setErr(null);
    try {
      const r = await api.baasCreateBackup(token, projectId);
      setMsg(`${r.message}. Kept for ${r.retentionDays} days.`);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Backup failed to start');
    } finally { setBusy(false); }
  };

  const restore = async (b: BaasBackup) => {
    if (!window.confirm(`Restore the backup from ${fmtDate(b.completed_at || b.started_at)} into a NEW database? Your current database is left untouched.`)) return;
    setBusy(true); setMsg(null); setErr(null);
    try {
      const r = await api.baasRestoreBackup(token, projectId, b.id);
      setMsg(r.message);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Restore failed to start');
    } finally { setBusy(false); }
  };

  const download = async (b: BaasBackup) => {
    try {
      const { url } = await api.baasBackupDownload(token, projectId, b.id);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not generate a download link');
    }
  };

  if (loading) return <div className="flex items-center justify-center py-16 text-text-muted"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-bold font-display text-text-primary">Backups</h3>
          <p className="text-xs text-text-muted">Automatic daily backups of your managed Postgres. Restores always create a new database — your live one is never overwritten.</p>
        </div>
        <button onClick={backupNow} disabled={busy || !configured}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary-blue px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <DatabaseBackup size={15} />} Back up now
        </button>
      </div>

      {!configured && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          <span>Backup storage isn&apos;t configured yet. Once object storage is set up, daily backups start automatically.</span>
        </div>
      )}
      {msg && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</div>}
      {err && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{err}</div>}

      <div className="overflow-hidden rounded-xl border border-neutral-border">
        <table className="w-full text-sm">
          <thead className="bg-bg-secondary text-left text-xs text-text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Backup</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Size</th>
              <th className="px-4 py-2.5 font-medium">Expires</th>
              <th className="px-4 py-2.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-border">
            {backups.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted">No backups yet. Daily backups run automatically, or take one now.</td></tr>
            )}
            {backups.map((b) => (
              <tr key={b.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-text-primary">{fmtDate(b.started_at)}</div>
                  <div className="text-[11px] capitalize text-text-muted">{b.kind}{b.error ? ` · ${b.error}` : ''}</div>
                </td>
                <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                <td className="px-4 py-3 text-text-secondary">{humanSize(b.size_bytes)}</td>
                <td className="px-4 py-3 text-text-secondary">{fmtDate(b.expires_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3">
                    {b.status === 'completed' && (
                      <>
                        <button onClick={() => download(b)} className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary"><Download size={14} /> Download</button>
                        <button onClick={() => restore(b)} disabled={busy} className="inline-flex items-center gap-1 text-primary-blue hover:opacity-80 disabled:opacity-50"><RotateCcw size={14} /> Restore</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {restores.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Recent restores</h4>
          <div className="space-y-1.5">
            {restores.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-border px-4 py-2 text-sm">
                <span className="font-mono text-text-secondary">{r.target_db}</span>
                <span className="flex items-center gap-3">
                  <span className="text-text-muted">{fmtDate(r.completed_at || r.started_at)}</span>
                  <StatusBadge status={r.status} />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
