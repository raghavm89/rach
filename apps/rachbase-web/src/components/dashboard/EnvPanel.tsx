'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Eye, EyeOff, Save, Check } from 'lucide-react';
import { cn } from '@rach/ui/lib/utils';
import { projects as api, type ServiceEnvVar } from '@rach/ui/lib/api';

// Same rule the server enforces (ENV_KEY_RE) — validated here for instant feedback.
const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;

// A suggested run command per detected app type (mirrors appDetect.DEFAULT_COMMAND). Shown
// as a placeholder only — leaving the field blank runs the built image's own ENTRYPOINT/CMD.
const DEFAULT_CMD: Record<string, string> = {
  node: 'npm start', python: 'python app.py', ruby: 'bundle exec ruby app.rb',
  go: './app', java: 'java -jar app.jar', php: 'php -S 0.0.0.0:8080', rust: './app',
};

type Row = ServiceEnvVar & { show?: boolean };

export default function EnvPanel({
  token, projectId, sid, appType,
}: {
  token: string; projectId: number; sid: number; appType?: string | null;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [startCommand, setStartCommand] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await api.getEnv(token, projectId, sid);
        if (!alive) return;
        setRows(data.vars.map((v) => ({ ...v, show: !v.is_secret })));
        setStartCommand(data.start_command ?? '');
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [token, projectId, sid]);

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    setSaved(false);
  }
  function addRow() { setRows((rs) => [...rs, { key: '', value: '', is_secret: true, show: true }]); setSaved(false); }
  function removeRow(i: number) { setRows((rs) => rs.filter((_, idx) => idx !== i)); setSaved(false); }

  const badKeys = rows.filter((r) => r.key.trim() && !KEY_RE.test(r.key.trim()));
  const dupKeys = rows.map((r) => r.key.trim()).filter((k, i, a) => k && a.indexOf(k) !== i);

  async function save() {
    setError(null);
    if (badKeys.length) { setError(`Invalid variable name: ${badKeys[0].key}. Use letters, digits and underscores; must not start with a digit.`); return; }
    if (dupKeys.length) { setError(`Duplicate variable name: ${dupKeys[0]}`); return; }
    setSaving(true);
    try {
      // Persist the run command first (config), then the whole env set (replace semantics).
      await api.setConfig(token, projectId, sid, { start_command: startCommand.trim() || null });
      const clean = rows.filter((r) => r.key.trim()).map((r) => ({ key: r.key.trim(), value: r.value, is_secret: r.is_secret !== false }));
      await api.setEnv(token, projectId, sid, clean);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex items-center gap-2 py-3 text-sm text-text-muted"><Loader2 size={14} className="animate-spin" /> Loading variables…</div>;

  const cmdPlaceholder = (appType && DEFAULT_CMD[appType]) ? `${DEFAULT_CMD[appType]} (image default if blank)` : 'Leave blank to use the image default';

  return (
    <div className="space-y-4">
      {/* Run command */}
      <div>
        <label className="mb-1 block text-xs font-medium text-text-secondary">Run command</label>
        <input
          value={startCommand}
          onChange={(e) => { setStartCommand(e.target.value); setSaved(false); }}
          placeholder={cmdPlaceholder}
          className="w-full rounded-lg border border-neutral-border bg-white px-3 py-2 font-mono text-sm text-text-primary placeholder:text-text-muted"
        />
        <p className="mt-1 text-xs text-text-muted">The command your container runs. Blank → the built image&apos;s own start command.</p>
      </div>

      {/* Env vars */}
      <div>
        <label className="mb-1 block text-xs font-medium text-text-secondary">Environment variables</label>
        {rows.length === 0 ? (
          <p className="py-1 text-sm text-text-muted">No variables yet.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={r.key}
                  onChange={(e) => update(i, { key: e.target.value })}
                  placeholder="KEY"
                  className={cn(
                    'w-2/5 rounded-lg border bg-white px-2.5 py-1.5 font-mono text-sm',
                    r.key.trim() && !KEY_RE.test(r.key.trim()) ? 'border-red-300 text-red-600' : 'border-neutral-border text-text-primary',
                  )}
                />
                <div className="relative flex-1">
                  <input
                    value={r.value}
                    type={r.is_secret && !r.show ? 'password' : 'text'}
                    onChange={(e) => update(i, { value: e.target.value })}
                    placeholder="value"
                    className="w-full rounded-lg border border-neutral-border bg-white px-2.5 py-1.5 pr-8 font-mono text-sm text-text-primary"
                  />
                  {r.is_secret && (
                    <button type="button" onClick={() => update(i, { show: !r.show })}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary" aria-label={r.show ? 'Hide value' : 'Show value'}>
                      {r.show ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  )}
                </div>
                <label className="flex items-center gap-1 text-xs text-text-muted" title="Mask this value in the UI">
                  <input type="checkbox" checked={r.is_secret !== false} onChange={(e) => update(i, { is_secret: e.target.checked, show: !e.target.checked })} /> secret
                </label>
                <button type="button" onClick={() => removeRow(i)} className="text-text-muted hover:text-red-600" aria-label="Remove variable"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
        <button type="button" onClick={addRow} className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-neutral-border px-3 py-1 text-xs text-text-muted hover:text-text-primary">
          <Plus size={13} /> Add variable
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-primary-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : <Save size={15} />}
          {saved ? 'Saved' : 'Save'}
        </button>
        <p className="text-xs text-text-muted">Changes apply on the next deploy.</p>
      </div>
    </div>
  );
}
