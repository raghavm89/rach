'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Boxes, Plus, Check } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { admin, type AgentTemplate } from '@rach/ui/lib/api';
import { industryModules } from '@/config/dashboard/registry';

const PROVIDERS = ['anthropic', 'vllm'];

// Workspace (industry) options for the filter + create form, from the registry.
const INDUSTRY_LIST = Object.values(industryModules).map((m) => ({ value: m.id, label: m.label }));
const FILTER_OPTIONS = [{ value: 'all', label: 'All workspaces' }, ...INDUSTRY_LIST, { value: 'none', label: 'General' }];
const CREATE_OPTIONS = [{ value: '', label: 'General' }, ...INDUSTRY_LIST];

const industryLabel = (id: string | null) => (id && industryModules[id] ? industryModules[id].label : 'General');

function TemplateCard({ tpl, token, onSaved }: { tpl: AgentTemplate; token: string; onSaved: (t: AgentTemplate) => void }) {
  const [name, setName] = useState(tpl.name);
  const [provider, setProvider] = useState(tpl.provider);
  const [model, setModel] = useState(tpl.model ?? '');
  const [prompt, setPrompt] = useState(tpl.prompt);
  const [enabled, setEnabled] = useState(tpl.enabled);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true); setSaved(false);
    try {
      const { template } = await admin.updateTemplate(token, tpl.id, { name, provider, model: model || undefined, prompt, enabled });
      onSaved(template);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-neutral-border bg-surface-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-md bg-surface-hover px-2 py-0.5 font-mono text-xs text-dash-body">{tpl.key}</span>
        <span className="rounded-full bg-accent-weak px-2 py-0.5 text-[10.5px] font-medium text-accent">{industryLabel(tpl.industry)}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 rounded-lg border border-neutral-border bg-surface-app px-2 py-1 text-sm font-medium text-dash-heading focus:border-accent focus:outline-none" />
        <label className="flex items-center gap-1.5 text-xs text-dash-body">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 rounded border-neutral-border text-accent" />
          Enabled
        </label>
      </div>
      <div className="mb-3 flex gap-2">
        <select value={provider} onChange={(e) => setProvider(e.target.value)} className="rounded-lg border border-neutral-border bg-surface-app px-2 py-1 text-sm text-dash-body focus:border-accent focus:outline-none">
          {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="model (blank = gateway default)" className="flex-1 rounded-lg border border-neutral-border bg-surface-app px-2 py-1 text-sm text-dash-body focus:border-accent focus:outline-none" />
      </div>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} placeholder="System prompt…" className="w-full resize-y rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading focus:border-accent focus:outline-none" />
      <div className="mt-3">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  );
}

export default function AgentTemplatesPage() {
  const { token } = useAuth();
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workspace, setWorkspace] = useState('all');
  const [newKey, setNewKey] = useState('');
  const [newName, setNewName] = useState('');
  const [newIndustry, setNewIndustry] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!token) return;
    admin.templates(token)
      .then((r: { templates: AgentTemplate[] }) => setTemplates(r.templates))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const visible = useMemo(() => templates.filter((t) => {
    if (workspace === 'all') return true;
    if (workspace === 'none') return !t.industry;
    return t.industry === workspace;
  }), [templates, workspace]);

  const countFor = (value: string) =>
    value === 'all' ? templates.length
      : value === 'none' ? templates.filter((t) => !t.industry).length
        : templates.filter((t) => t.industry === value).length;

  const create = async () => {
    if (!token || !newKey.trim() || !newName.trim()) return;
    setCreating(true); setError('');
    try {
      const { template } = await admin.createTemplate(token, { key: newKey.trim(), name: newName.trim(), industry: newIndustry || null });
      setTemplates((list) => [...list, template]);
      setNewKey(''); setNewName('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const onSaved = (t: AgentTemplate) => setTemplates((list) => list.map((x) => (x.id === t.id ? t : x)));

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Boxes size={20} className="text-accent" />
          <h2 className="text-xl font-semibold text-dash-heading">Agent Templates</h2>
          <span className="hidden text-sm text-dash-muted sm:inline">Platform defaults every organization inherits</span>
        </div>
        <label className="flex items-center gap-2">
          <span className="text-xs font-medium text-dash-muted">Workspace</span>
          <select
            value={workspace}
            onChange={(e) => setWorkspace(e.target.value)}
            className="rounded-lg border border-neutral-border bg-surface-card px-3 py-2 text-sm text-dash-heading focus:border-accent focus:outline-none"
          >
            {FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label} ({countFor(o.value)})</option>)}
          </select>
        </label>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      <div className="mb-6 flex flex-wrap items-end gap-2 rounded-2xl border border-dashed border-neutral-border bg-surface-hover/50 p-4">
        <div className="min-w-[120px] flex-1">
          <label className="mb-1 block text-xs font-medium text-dash-body">Key</label>
          <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="scribe" className="w-full rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading focus:border-accent focus:outline-none" />
        </div>
        <div className="min-w-[120px] flex-1">
          <label className="mb-1 block text-xs font-medium text-dash-body">Name</label>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Clinical Scribe" className="w-full rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading focus:border-accent focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-dash-body">Workspace</label>
          <select value={newIndustry} onChange={(e) => setNewIndustry(e.target.value)} className="rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-body focus:border-accent focus:outline-none">
            {CREATE_OPTIONS.map((o) => <option key={o.value || 'general'} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <button onClick={create} disabled={creating || !newKey.trim() || !newName.trim()} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-dash-muted"><Loader2 size={16} className="animate-spin" /> Loading…</div>
      ) : (
        <div className="space-y-4">
          {token && visible.map((t) => <TemplateCard key={t.id} tpl={t} token={token} onSaved={onSaved} />)}
          {visible.length === 0 && (
            <p className="text-sm text-dash-muted">
              {templates.length === 0 ? 'No templates yet — add one above (e.g. key ' : 'No templates in this workspace. '}
              {templates.length === 0 ? <><b>scribe</b>).</> : 'Switch the workspace filter or add one.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
