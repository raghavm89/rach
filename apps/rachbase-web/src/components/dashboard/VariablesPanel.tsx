"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Eye, EyeOff, Loader2, Save, Check } from "lucide-react";
import { deployment, type ServiceEnvVar } from "@rach/ui/lib/api";

/**
 * Phase 2 · WS7 — service environment variables.
 * Edit key/value pairs, mark secrets (masked), and save. Uses the existing
 * getEnv/setEnv endpoints on deployment_services.
 */
export function VariablesPanel({ serviceId, token }: { serviceId: number; token: string }) {
  const [vars, setVars] = useState<ServiceEnvVar[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<Record<number, boolean>>({});

  const load = useCallback(() => {
    setLoading(true);
    deployment.getEnv(token, serviceId)
      .then((d) => setVars(d.vars))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [token, serviceId]);

  useEffect(() => { load(); }, [load]);

  function update(i: number, patch: Partial<ServiceEnvVar>) {
    setVars((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
    setDirty(true); setSaved(false);
  }
  function addRow() { setVars((prev) => [...prev, { key: "", value: "", is_secret: false }]); setDirty(true); setSaved(false); }
  function removeRow(i: number) { setVars((prev) => prev.filter((_, idx) => idx !== i)); setDirty(true); setSaved(false); }

  async function save() {
    setSaving(true); setError(null);
    try {
      const clean = vars.filter((v) => v.key.trim());
      await deployment.setEnv(token, serviceId, clean);
      setVars(clean);
      setDirty(false); setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-8 text-text-muted"><Loader2 className="animate-spin" size={18} /></div>;

  return (
    <div className="space-y-3">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-neutral-border bg-surface-card">
        <div className="grid grid-cols-[1fr_1.4fr_auto_auto] items-center gap-2 border-b border-neutral-border bg-bg-secondary px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          <span>Key</span><span>Value</span><span>Secret</span><span></span>
        </div>
        {vars.length === 0 ? (
          <p className="px-3 py-4 text-xs text-text-muted">No variables yet.</p>
        ) : (
          vars.map((v, i) => (
            <div key={i} className="grid grid-cols-[1fr_1.4fr_auto_auto] items-center gap-2 border-b border-neutral-border px-3 py-2 last:border-0">
              <input
                value={v.key}
                onChange={(e) => update(i, { key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_") })}
                placeholder="MY_VAR"
                className="rounded-md border border-neutral-border px-2 py-1.5 font-mono text-xs outline-none focus:border-primary-blue"
              />
              <div className="flex items-center gap-1">
                <input
                  type={v.is_secret && !reveal[i] ? "password" : "text"}
                  value={v.value}
                  onChange={(e) => update(i, { value: e.target.value })}
                  placeholder="value"
                  className="flex-1 rounded-md border border-neutral-border px-2 py-1.5 font-mono text-xs outline-none focus:border-primary-blue"
                />
                {v.is_secret && (
                  <button onClick={() => setReveal((r) => ({ ...r, [i]: !r[i] }))} className="text-text-muted hover:text-text-primary">
                    {reveal[i] ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                )}
              </div>
              <input type="checkbox" checked={v.is_secret} onChange={(e) => update(i, { is_secret: e.target.checked })} className="mx-auto" />
              <button onClick={() => removeRow(i)} className="text-text-muted hover:text-red-600"><Trash2 size={13} /></button>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={addRow} className="inline-flex items-center gap-1.5 rounded-full border border-neutral-border px-3 py-1.5 text-xs text-text-muted hover:text-text-primary">
          <Plus size={13} /> Add variable
        </button>
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary-blue px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <Check size={13} /> : <Save size={13} />}
          {saved ? "Saved" : "Save"}
        </button>
      </div>
      <p className="text-xs text-text-muted">Changes apply on the next deploy.</p>
    </div>
  );
}
