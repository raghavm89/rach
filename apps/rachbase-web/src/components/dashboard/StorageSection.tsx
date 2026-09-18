'use client';

import { useEffect, useState } from 'react';
import { Loader2, FolderPlus, HardDrive, Server, Plus, Trash2, Check, ServerCrash, X, Copy, ShieldAlert } from 'lucide-react';
import { cn } from '@rach/ui/lib/utils';
import { projects as api, type BaasBucket, type StorageConfig, type S3Key } from '@rach/ui/lib/api';

/**
 * Backend → Storage (Supabase-style, minus Analytics/Vectors). Sub-nav MANAGE: Files; CONFIG: S3.
 * Files has Buckets / Settings / Policies. Buckets are live (deploy-gated); Settings + S3 are
 * control-plane config that works before deploy.
 */
export default function StorageSection({ token, projectId }: { token: string; projectId: number }) {
  const [sub, setSub] = useState<'files' | 's3'>('files');
  return (
    <div className="grid grid-cols-[180px_1fr] gap-6">
      <nav className="space-y-4">
        <div>
          <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Manage</p>
          <button onClick={() => setSub('files')} className={cn('flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm', sub === 'files' ? 'bg-blue-50 font-medium text-primary-blue' : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary')}><HardDrive size={15} /> Files</button>
        </div>
        <div>
          <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Configuration</p>
          <button onClick={() => setSub('s3')} className={cn('flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm', sub === 's3' ? 'bg-blue-50 font-medium text-primary-blue' : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary')}><Server size={15} /> S3</button>
        </div>
      </nav>
      <div className="min-w-0">{sub === 'files' ? <FilesPage token={token} projectId={projectId} /> : <S3Page token={token} projectId={projectId} />}</div>
    </div>
  );
}

const Center = () => <div className="flex items-center justify-center py-16 text-text-muted"><Loader2 className="animate-spin" /></div>;

// ── Files (Buckets / Settings / Policies) ──────────────────────────────────────
function FilesPage({ token, projectId }: { token: string; projectId: number }) {
  const [tab, setTab] = useState<'buckets' | 'settings' | 'policies'>('buckets');
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold font-display text-text-primary">Files</h3>
        <p className="text-xs text-text-muted">General file storage for most types of digital content.</p>
      </div>
      <div className="flex gap-5 border-b border-neutral-border text-sm">
        {(['buckets', 'settings', 'policies'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn('-mb-px border-b-2 px-0.5 py-2 capitalize', tab === t ? 'border-primary-blue font-medium text-text-primary' : 'border-transparent text-text-muted hover:text-text-primary')}>{t}</button>
        ))}
      </div>
      {tab === 'buckets' && <BucketsTab token={token} projectId={projectId} />}
      {tab === 'settings' && <SettingsTab token={token} projectId={projectId} />}
      {tab === 'policies' && <PoliciesTab token={token} projectId={projectId} />}
    </div>
  );
}

function BucketsTab({ token, projectId }: { token: string; projectId: number }) {
  const [buckets, setBuckets] = useState<BaasBucket[] | null>(null);
  const [loading, setLoading] = useState(true); const [down, setDown] = useState(false); const [err, setErr] = useState('');
  const [showNew, setShowNew] = useState(false);
  async function load() { setLoading(true); setDown(false); try { const r = await api.baasBuckets(token, projectId); setBuckets(r.buckets); } catch { setDown(true); } finally { setLoading(false); } }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token, projectId]);
  if (loading) return <Center />;

  const hasBuckets = buckets && buckets.length > 0;
  return (
    <div className="space-y-3">
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}
      {down && <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800"><ServerCrash size={16} /> Backend not deployed — buckets are created once it&apos;s live. Settings + S3 work now.</div>}
      {hasBuckets ? (
        <>
          <div className="flex justify-end"><button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"><Plus size={15} /> New bucket</button></div>
          <div className="overflow-hidden rounded-2xl border border-neutral-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg-secondary text-xs uppercase text-text-muted"><tr><th className="px-4 py-2 font-medium">Name</th><th className="px-4 py-2 font-medium">Visibility</th><th className="px-4 py-2 font-medium">Created</th></tr></thead>
              <tbody className="divide-y divide-neutral-border">
                {buckets!.map((b) => (
                  <tr key={b.name}><td className="px-4 py-2.5 font-mono text-text-primary">{b.name}</td>
                    <td className="px-4 py-2.5"><span className={cn('rounded-full px-2 py-0.5 text-xs', b.visibility === 'public' ? 'bg-emerald-50 text-emerald-700' : 'bg-bg-secondary text-text-muted')}>{b.visibility}</span></td>
                    <td className="px-4 py-2.5 text-xs text-text-muted">{new Date(b.created_at).toLocaleDateString()}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-neutral-border bg-surface-card p-12 text-center">
          <FolderPlus size={26} className="mx-auto text-text-muted" />
          <p className="mt-2 text-sm font-semibold text-text-primary">Create a file bucket</p>
          <p className="text-sm text-text-muted">Store images, videos, documents, and any other file type.</p>
          <button onClick={() => setShowNew(true)} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"><Plus size={15} /> New bucket</button>
        </div>
      )}
      {showNew && <NewBucketModal onClose={() => setShowNew(false)} onCreate={async (name, pub) => { await api.baasCreateBucket(token, projectId, { name, visibility: pub ? 'public' : 'private' }); setShowNew(false); load(); }} />}
    </div>
  );
}

function NewBucketModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, isPublic: boolean) => Promise<void> }) {
  const [name, setName] = useState(''); const [isPublic, setIsPublic] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  async function submit() { setBusy(true); setErr(''); try { await onCreate(name.trim(), isPublic); } catch (e) { setErr((e as Error).message); setBusy(false); } }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-neutral-border bg-surface-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-neutral-border px-5 py-3.5"><h3 className="text-base font-semibold text-text-primary">Create a bucket</h3><button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={18} /></button></div>
        <div className="space-y-4 px-5 py-4">
          <div><label className="mb-1 block text-sm font-medium text-text-secondary">Bucket name</label>
            <input value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder="avatars" className="w-full rounded-lg border border-neutral-border px-3 py-2 font-mono text-sm" /></div>
          <label className="flex items-center justify-between text-sm">
            <span><span className="font-medium text-text-primary">Public bucket</span><br /><span className="text-xs text-text-muted">Anyone can read objects without a signed URL.</span></span>
            <Toggle on={isPublic} onChange={setIsPublic} />
          </label>
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}
          <button onClick={submit} disabled={busy || !name} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{busy && <Loader2 size={15} className="animate-spin" />} Create bucket</button>
        </div>
      </div>
    </div>
  );
}

const UNITS: [string, number][] = [['KB', 1024], ['MB', 1024 * 1024], ['GB', 1024 * 1024 * 1024]];
function SettingsTab({ token, projectId }: { token: string; projectId: number }) {
  const [cfg, setCfg] = useState<StorageConfig | null>(null); const [loading, setLoading] = useState(true); const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false); const [dirty, setDirty] = useState(false);
  const [size, setSize] = useState(50); const [unit, setUnit] = useState('MB');
  useEffect(() => { (async () => { try { const r = await api.baasStorageConfig(token, projectId); setCfg(r.config); const mb = r.config.file_size_limit_bytes / (1024 * 1024); setSize(Number.isInteger(mb) ? mb : Math.round(mb)); setUnit('MB'); } catch (e) { setErr((e as Error).message); } finally { setLoading(false); } })(); }, [token, projectId]);
  if (loading) return <Center />;
  if (!cfg) return <p className="text-sm text-red-600">{err || 'Could not load storage config.'}</p>;
  const mark = () => { setDirty(true); setSaved(false); };
  async function save() {
    setSaving(true); setErr('');
    const bytes = Math.max(0, Math.trunc(size * (UNITS.find(([u]) => u === unit)?.[1] || 1)));
    try { const r = await api.baasSetStorageConfig(token, projectId, { image_transformation: cfg!.image_transformation, file_size_limit_bytes: bytes }); setCfg(r.config); setDirty(false); setSaved(true); }
    catch (e) { setErr((e as Error).message); } finally { setSaving(false); }
  }
  return (
    <div className="space-y-4">
      <div className="divide-y divide-neutral-border rounded-2xl border border-neutral-border bg-surface-card">
        <div className="flex items-center gap-4 px-4 py-3">
          <div><p className="text-sm text-text-primary">Enable image transformation</p><p className="text-xs text-text-muted">Optimize and resize images on the fly.</p></div>
          <div className="ml-auto"><Toggle on={cfg.image_transformation} onChange={(v) => { setCfg({ ...cfg, image_transformation: v }); mark(); }} /></div>
        </div>
        <div className="flex items-center gap-4 px-4 py-3">
          <div><p className="text-sm text-text-primary">Global file size limit</p><p className="text-xs text-text-muted">Restrict the size of files uploaded across all buckets.</p></div>
          <div className="ml-auto flex items-center gap-2">
            <input type="number" min={0} value={size} onChange={(e) => { setSize(Number(e.target.value)); mark(); }} className="w-24 rounded-lg border border-neutral-border px-2.5 py-1.5 text-right text-sm" />
            <select value={unit} onChange={(e) => { setUnit(e.target.value); mark(); }} className="rounded-lg border border-neutral-border px-2 py-1.5 text-sm">{UNITS.map(([u]) => <option key={u} value={u}>{u}</option>)}</select>
          </div>
        </div>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex items-center justify-end gap-2">
        {saved && <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Check size={13} /> Saved</span>}
        <button onClick={save} disabled={!dirty || saving} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40">{saving && <Loader2 size={14} className="animate-spin" />} Save</button>
      </div>
    </div>
  );
}

function PoliciesTab({ token, projectId }: { token: string; projectId: number }) {
  const [buckets, setBuckets] = useState<BaasBucket[] | null>(null); const [down, setDown] = useState(false); const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => { try { const r = await api.baasBuckets(token, projectId); setBuckets(r.buckets); } catch { setDown(true); } finally { setLoading(false); } })(); }, [token, projectId]);
  if (loading) return <Center />;
  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">Access is governed per bucket by its visibility: <span className="font-medium text-text-primary">public</span> buckets are readable by anyone; <span className="font-medium text-text-primary">private</span> buckets require a valid role (authenticated / service_role) or a signed URL. Writes and deletes always require an authorized role.</p>
      {down ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800"><ServerCrash size={16} /> Backend not deployed — bucket policies appear once it&apos;s live.</div>
      ) : (buckets && buckets.length > 0) ? (
        <div className="overflow-hidden rounded-2xl border border-neutral-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg-secondary text-xs uppercase text-text-muted"><tr><th className="px-4 py-2 font-medium">Bucket</th><th className="px-4 py-2 font-medium">Read</th><th className="px-4 py-2 font-medium">Write / Delete</th></tr></thead>
            <tbody className="divide-y divide-neutral-border">
              {buckets.map((b) => (<tr key={b.name}><td className="px-4 py-2.5 font-mono text-text-primary">{b.name}</td>
                <td className="px-4 py-2.5 text-xs text-text-muted">{b.visibility === 'public' ? 'Anyone' : 'Authenticated / signed URL'}</td>
                <td className="px-4 py-2.5 text-xs text-text-muted">Authenticated / service_role</td></tr>))}
            </tbody>
          </table>
        </div>
      ) : <p className="rounded-2xl border border-neutral-border bg-surface-card p-8 text-center text-sm text-text-muted">No buckets yet — create one under Buckets.</p>}
    </div>
  );
}

// ── S3 Configuration ───────────────────────────────────────────────────────────
function S3Page({ token, projectId }: { token: string; projectId: number }) {
  const [cfg, setCfg] = useState<StorageConfig | null>(null);
  const [s3, setS3] = useState<{ endpoint: string; region: string }>({ endpoint: '', region: '' });
  const [keys, setKeys] = useState<S3Key[]>([]); const [loading, setLoading] = useState(true); const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false); const [dirty, setDirty] = useState(false);
  const [showNew, setShowNew] = useState(false); const [fresh, setFresh] = useState<S3Key | null>(null);
  async function load() { try { const r = await api.baasStorageConfig(token, projectId); setCfg(r.config); setS3(r.s3); setKeys(r.keys); } catch (e) { setErr((e as Error).message); } finally { setLoading(false); } }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token, projectId]);
  if (loading) return <Center />;
  if (!cfg) return <p className="text-sm text-red-600">{err || 'Could not load S3 config.'}</p>;
  async function save() { setSaving(true); setErr(''); try { const r = await api.baasSetStorageConfig(token, projectId, { s3_enabled: cfg!.s3_enabled }); setCfg((c) => ({ ...c!, ...r.config })); setDirty(false); setSaved(true); } catch (e) { setErr((e as Error).message); } finally { setSaving(false); } }

  return (
    <div className="space-y-6">
      <div><h3 className="text-base font-bold font-display text-text-primary">S3 Configuration</h3><p className="text-xs text-text-muted">Connect to your buckets using any S3-compatible service via the S3 protocol.</p></div>

      <div className="divide-y divide-neutral-border rounded-2xl border border-neutral-border bg-surface-card">
        <div className="flex items-center gap-4 px-4 py-3">
          <div><p className="text-sm text-text-primary">S3 protocol connection</p><p className="text-xs text-text-muted">Allow clients to connect to Storage via the S3 protocol.</p></div>
          <div className="ml-auto"><Toggle on={cfg.s3_enabled} onChange={(v) => { setCfg({ ...cfg, s3_enabled: v }); setDirty(true); setSaved(false); }} /></div>
        </div>
        <CopyField label="Endpoint" value={s3.endpoint || '—'} />
        <CopyField label="Region" value={cfg.region} />
        <div className="flex items-center justify-end gap-2 px-4 py-3">
          {saved && <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Check size={13} /> Saved</span>}
          <button onClick={save} disabled={!dirty || saving} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40">{saving && <Loader2 size={14} className="animate-spin" />} Save</button>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <div><p className="text-sm font-semibold text-text-primary">Access keys</p><p className="text-xs text-text-muted">Manage your access keys for this project.</p></div>
          <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-secondary"><Plus size={14} /> New access key</button>
        </div>
        {fresh && (
          <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-amber-800"><ShieldAlert size={13} /> Copy the secret now — it won&apos;t be shown again.</p>
            <CopyLine label="Access key ID" value={fresh.access_key_id} />
            {fresh.secret_access_key && <CopyLine label="Secret" value={fresh.secret_access_key} />}
            <button onClick={() => setFresh(null)} className="mt-1.5 text-xs text-amber-700 hover:underline">Done</button>
          </div>
        )}
        {err && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}
        <div className="overflow-hidden rounded-2xl border border-neutral-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg-secondary text-xs uppercase text-text-muted"><tr><th className="px-4 py-2 font-medium">Name</th><th className="px-4 py-2 font-medium">Key ID</th><th className="px-4 py-2 font-medium">Created at</th><th className="px-4 py-2" /></tr></thead>
            <tbody className="divide-y divide-neutral-border">
              {keys.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center"><p className="text-sm font-medium text-text-primary">No access keys created</p><p className="text-xs text-text-muted">There are no access keys associated with your project yet.</p></td></tr>
              ) : keys.map((k) => (
                <tr key={k.id}><td className="px-4 py-2.5 text-text-primary">{k.name || '—'}</td><td className="px-4 py-2.5 font-mono text-xs text-text-muted">{k.access_key_id}</td><td className="px-4 py-2.5 text-xs text-text-muted">{new Date(k.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 text-right"><button onClick={async () => { await api.baasDeleteS3Key(token, projectId, k.id); load(); }} className="text-text-muted hover:text-red-600"><Trash2 size={14} /></button></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showNew && <NewS3KeyModal onClose={() => setShowNew(false)} onCreate={async (desc) => { const r = await api.baasCreateS3Key(token, projectId, desc); setFresh(r.key); setShowNew(false); load(); }} />}
    </div>
  );
}

function NewS3KeyModal({ onClose, onCreate }: { onClose: () => void; onCreate: (desc: string) => Promise<void> }) {
  const [desc, setDesc] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  async function submit() { setBusy(true); setErr(''); try { await onCreate(desc.trim()); } catch (e) { setErr((e as Error).message); setBusy(false); } }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-neutral-border bg-surface-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-neutral-border px-5 py-4">
          <div className="flex items-center justify-between"><h3 className="text-base font-semibold text-text-primary">Create new S3 access keys</h3><button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={18} /></button></div>
          <p className="mt-1 text-xs text-text-muted">S3 access keys provide full access to all S3 operations across all buckets and bypass any existing policies.</p>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div><label className="mb-1 block text-sm font-medium text-text-secondary">Description</label>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="My test key" className="w-full rounded-lg border border-neutral-border px-3 py-2 text-sm" /></div>
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}
          <div className="flex justify-end"><button onClick={submit} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{busy && <Loader2 size={15} className="animate-spin" />} Create access key</button></div>
        </div>
      </div>
    </div>
  );
}

// ── shared ──
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={cn('inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors', on ? 'bg-emerald-500' : 'bg-neutral-300')}>
      <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform', on ? 'translate-x-4' : 'translate-x-0')} />
    </button>
  );
}
function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <p className="text-sm text-text-primary">{label}</p>
      <code className="ml-auto max-w-md flex-1 truncate rounded-lg border border-neutral-border bg-bg-secondary px-2.5 py-1.5 text-right font-mono text-xs text-text-primary">{value}</code>
      <CopyBtn value={value} />
    </div>
  );
}
function CopyLine({ label, value }: { label: string; value: string }) {
  return (<div className="mt-1 flex items-center gap-2"><span className="w-28 text-xs text-amber-800">{label}</span><code className="flex-1 truncate rounded bg-white px-2 py-1 font-mono text-xs text-text-primary">{value}</code><CopyBtn value={value} /></div>);
}
function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return <button onClick={async () => { try { await navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* noop */ } }} className="rounded-lg border border-neutral-border p-1.5 text-text-muted hover:text-text-primary">{copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}</button>;
}
