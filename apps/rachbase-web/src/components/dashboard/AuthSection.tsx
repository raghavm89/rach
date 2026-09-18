'use client';

import { useEffect, useState } from 'react';
import { Loader2, Users, ShieldCheck, Clock, Gauge, Link2, Plus, Trash2, Rocket, ServerCrash, Check, AppWindow, Server, Copy, Search, RefreshCw, Mail, Lock, X } from 'lucide-react';
import { cn } from '@rach/ui/lib/utils';
import { projects as api, type AuthConfig, type AuthConfigPatch, type BaasUser, type OAuthApp } from '@rach/ui/lib/api';

/**
 * The Backend → Auth section, modeled on Supabase's Authentication: a left sub-nav where most
 * pages are CONFIGURATION (control-plane, editable before the backend deploys) and only Users is
 * live data from the deployed Auth service.
 */
const OAUTH = ['google', 'github', 'apple', 'azure', 'facebook', 'gitlab', 'discord', 'twitter', 'linkedin', 'slack', 'spotify', 'twitch'];
const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google', github: 'GitHub', apple: 'Apple', azure: 'Azure', facebook: 'Facebook', gitlab: 'GitLab',
  discord: 'Discord', twitter: 'Twitter', linkedin: 'LinkedIn', slack: 'Slack', spotify: 'Spotify', twitch: 'Twitch',
};

type SubKey = 'users' | 'oauthapps' | 'providers' | 'oauthserver' | 'sessions' | 'rate' | 'url';
const NAV: { group: string; items: { key: SubKey; label: string; icon: typeof Users }[] }[] = [
  { group: 'Manage', items: [
    { key: 'users', label: 'Users', icon: Users },
    { key: 'oauthapps', label: 'OAuth Apps', icon: AppWindow },
  ] },
  { group: 'Configuration', items: [
    { key: 'providers', label: 'Sign In / Providers', icon: ShieldCheck },
    { key: 'oauthserver', label: 'OAuth Server', icon: Server },
    { key: 'sessions', label: 'Sessions', icon: Clock },
    { key: 'rate', label: 'Rate Limits', icon: Gauge },
    { key: 'url', label: 'URL Configuration', icon: Link2 },
  ] },
];

export default function AuthSection({ token, projectId }: { token: string; projectId: number }) {
  const [sub, setSub] = useState<SubKey>('providers');   // default to a config page (works pre-deploy)
  const active = NAV.flatMap((g) => g.items).find((i) => i.key === sub);

  return (
    <div className="grid grid-cols-[180px_1fr] gap-6">
      <nav className="space-y-4">
        {NAV.map((g) => (
          <div key={g.group}>
            <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">{g.group}</p>
            <div className="space-y-0.5">
              {g.items.map((i) => (
                <button key={i.key} onClick={() => setSub(i.key)}
                  className={cn('flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm',
                    sub === i.key ? 'bg-blue-50 font-medium text-primary-blue' : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary')}>
                  <i.icon size={15} /> {i.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="min-w-0">
        <h3 className="mb-4 flex items-center gap-2 text-base font-bold font-display text-text-primary">
          {active && <active.icon size={17} className="text-text-muted" />} {active?.label}
        </h3>
        {sub === 'users' && <UsersPage token={token} projectId={projectId} />}
        {sub === 'oauthapps' && <OAuthAppsPage token={token} projectId={projectId} onGoToSettings={() => setSub('oauthserver')} />}
        {sub === 'providers' && <ProvidersPage token={token} projectId={projectId} />}
        {sub === 'oauthserver' && <OAuthServerPage token={token} projectId={projectId} />}
        {sub === 'sessions' && <SessionsPage token={token} projectId={projectId} />}
        {sub === 'rate' && <RateLimitsPage token={token} projectId={projectId} />}
        {sub === 'url' && <UrlConfigPage token={token} projectId={projectId} />}
      </div>
    </div>
  );
}

// ── shared config-form scaffolding ────────────────────────────────────────────
function useAuthConfig(token: string, projectId: number) {
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  useEffect(() => {
    let alive = true;
    (async () => { try { const r = await api.getAuthConfig(token, projectId); if (alive) setConfig(r.config); } catch (e) { if (alive) setErr((e as Error).message); } finally { if (alive) setLoading(false); } })();
    return () => { alive = false; };
  }, [token, projectId]);
  return { config, setConfig, loading, err, setErr };
}

function SaveBar({ dirty, saving, saved, onSave }: { dirty: boolean; saving: boolean; saved: boolean; onSave: () => void }) {
  return (
    <div className="mt-4 flex items-center justify-end gap-2">
      {saved && <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Check size={13} /> Saved</span>}
      <button onClick={onSave} disabled={!dirty || saving}
        className="inline-flex items-center gap-1.5 rounded-full bg-primary-blue px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40">
        {saving && <Loader2 size={14} className="animate-spin" />} Save changes
      </button>
    </div>
  );
}

const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="divide-y divide-neutral-border rounded-2xl border border-neutral-border bg-surface-card">{children}</div>
);
const Row = ({ title, desc, control }: { title: string; desc?: string; control: React.ReactNode }) => (
  <div className="flex items-center gap-4 px-4 py-3">
    <div className="min-w-0"><p className="text-sm text-text-primary">{title}</p>{desc && <p className="text-xs text-text-muted">{desc}</p>}</div>
    <div className="ml-auto shrink-0">{control}</div>
  </div>
);
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
      className={cn('inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors', on ? 'bg-emerald-500' : 'bg-neutral-300')}>
      <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform', on ? 'translate-x-4' : 'translate-x-0')} />
    </button>
  );
}
const NumInput = ({ value, onChange, unit }: { value: number; onChange: (n: number) => void; unit?: string }) => (
  <div className="flex items-center gap-2">
    <input type="number" min={0} value={value} onChange={(e) => onChange(Number(e.target.value))}
      className="w-28 rounded-lg border border-neutral-border px-2.5 py-1.5 text-right text-sm" />
    {unit && <span className="w-20 text-xs text-text-muted">{unit}</span>}
  </div>
);
const Center = () => <div className="flex items-center justify-center py-16 text-text-muted"><Loader2 className="animate-spin" /></div>;

// "Create a new user" dialog (Supabase-style).
function CreateUserModal({ onClose, onCreate }: { onClose: () => void; onCreate: (email: string, password: string, autoConfirm: boolean) => Promise<void> }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [autoConfirm, setAutoConfirm] = useState(true);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  async function submit() {
    setBusy(true); setErr('');
    try { await onCreate(email.trim(), password, autoConfirm); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-neutral-border bg-surface-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-neutral-border px-5 py-3.5">
          <h3 className="text-base font-semibold text-text-primary">Create a new user</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Email address</label>
            <div className="relative">
              <Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="user@example.com"
                className="w-full rounded-lg border border-neutral-border py-2 pl-9 pr-3 text-sm text-text-primary" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">User Password</label>
            <div className="relative">
              <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••"
                className="w-full rounded-lg border border-neutral-border py-2 pl-9 pr-3 text-sm text-text-primary" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-text-primary">
            <input type="checkbox" checked={autoConfirm} onChange={(e) => setAutoConfirm(e.target.checked)} className="h-4 w-4 rounded border-neutral-border" />
            Auto confirm user?
          </label>
          <p className="text-xs text-text-muted">A confirmation email will {autoConfirm ? 'not ' : ''}be sent when creating a user via this form.</p>
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}
          <button onClick={submit} disabled={busy || !email || password.length < 8}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
            {busy && <Loader2 size={15} className="animate-spin" />} Create user
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sign In / Providers ───────────────────────────────────────────────────────
function ProvidersPage({ token, projectId }: { token: string; projectId: number }) {
  const { config, setConfig, loading, err, setErr } = useAuthConfig(token, projectId);
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false); const [dirty, setDirty] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState('');
  useEffect(() => { (async () => { try { const r = await api.getBaas(token, projectId); if (r.baas?.url) setCallbackUrl(`${r.baas.url}/auth/v1/callback`); } catch { /* ignore */ } })(); }, [token, projectId]);
  if (loading) return <Center />;
  if (!config) return <p className="text-sm text-red-600">{err || 'Could not load config.'}</p>;

  const patchSignups = (k: keyof AuthConfig['signups'], v: boolean) => { setConfig({ ...config, signups: { ...config.signups, [k]: v } }); setDirty(true); setSaved(false); };
  const patchProvider = (p: string, patch: Partial<AuthConfig['providers'][string]>) => { setConfig({ ...config, providers: { ...config.providers, [p]: { ...config.providers[p], ...patch } } }); setDirty(true); setSaved(false); };

  async function save() {
    setSaving(true); setErr('');
    const providersPatch: AuthConfigPatch['providers'] = {};
    for (const p of ['email', 'phone', ...OAUTH]) providersPatch[p] = config!.providers[p];
    try { const r = await api.setAuthConfig(token, projectId, { signups: config!.signups, providers: providersPatch }); setConfig(r.config); setDirty(false); setSaved(true); }
    catch (e) { setErr((e as Error).message); } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-semibold text-text-primary">User Signups</p>
        <Card>
          <Row title="Allow new users to sign up" desc="If disabled, new users cannot sign up to your application." control={<Toggle on={config.signups.allow_signups} onChange={(v) => patchSignups('allow_signups', v)} />} />
          <Row title="Confirm email" desc="Users must confirm their email before the first sign-in." control={<Toggle on={config.signups.confirm_email} onChange={(v) => patchSignups('confirm_email', v)} />} />
          <Row title="Allow anonymous sign-ins" desc="Enable anonymous sign-ins for your project." control={<Toggle on={config.signups.allow_anonymous} onChange={(v) => patchSignups('allow_anonymous', v)} />} />
          <Row title="Allow manual linking" desc="Enable manual account-linking APIs." control={<Toggle on={config.signups.allow_manual_linking} onChange={(v) => patchSignups('allow_manual_linking', v)} />} />
        </Card>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-text-primary">Auth Providers</p>
        <Card>
          <Row title="Email" desc="Email + password sign-in." control={<Toggle on={config.providers.email?.enabled ?? false} onChange={(v) => patchProvider('email', { enabled: v })} />} />
          <Row title="Phone" desc="Phone / SMS OTP sign-in." control={<Toggle on={config.providers.phone?.enabled ?? false} onChange={(v) => patchProvider('phone', { enabled: v })} />} />
          {OAUTH.map((p) => (
            <ProviderRow key={p} name={PROVIDER_LABELS[p]} cfg={config.providers[p]} onChange={(patch) => patchProvider(p, patch)} callbackUrl={callbackUrl} />
          ))}
        </Card>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}
      <SaveBar dirty={dirty} saving={saving} saved={saved} onSave={save} />
    </div>
  );
}

function ProviderRow({ name, cfg, onChange, callbackUrl }: { name: string; cfg?: AuthConfig['providers'][string]; onChange: (p: Partial<AuthConfig['providers'][string]>) => void; callbackUrl?: string }) {
  const enabled = cfg?.enabled ?? false;
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-4">
        <p className="text-sm text-text-primary">{name}</p>
        <span className={cn('ml-auto rounded-full px-2 py-0.5 text-xs', enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-bg-secondary text-text-muted')}>{enabled ? 'Enabled' : 'Disabled'}</span>
        <Toggle on={enabled} onChange={(v) => onChange({ enabled: v })} />
      </div>
      {enabled && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-text-muted">Client ID
              <input value={cfg?.client_id ?? ''} onChange={(e) => onChange({ client_id: e.target.value })} className="mt-1 w-full rounded-lg border border-neutral-border px-2.5 py-1.5 text-sm text-text-primary" />
            </label>
            <label className="text-xs text-text-muted">Client Secret {cfg?.secret_set && <span className="text-emerald-600">(set)</span>}
              <input type="password" placeholder={cfg?.secret_set ? '•••••••• (leave blank to keep)' : ''} onChange={(e) => onChange({ secret: e.target.value })} className="mt-1 w-full rounded-lg border border-neutral-border px-2.5 py-1.5 text-sm text-text-primary" />
            </label>
          </div>
          {callbackUrl && (
            <p className="text-xs text-text-muted">Authorized redirect URI (add this in the provider console): <code className="rounded bg-bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-text-primary">{callbackUrl}</code></p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sessions ──────────────────────────────────────────────────────────────────
function SessionsPage({ token, projectId }: { token: string; projectId: number }) {
  const { config, setConfig, loading, err, setErr } = useAuthConfig(token, projectId);
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false); const [dirty, setDirty] = useState(false);
  if (loading) return <Center />;
  if (!config) return <p className="text-sm text-red-600">{err || 'Could not load config.'}</p>;
  const set = (k: keyof AuthConfig['sessions'], v: number | boolean) => { setConfig({ ...config, sessions: { ...config.sessions, [k]: v } }); setDirty(true); setSaved(false); };
  async function save() { setSaving(true); setErr(''); try { const r = await api.setAuthConfig(token, projectId, { sessions: config!.sessions }); setConfig(r.config); setDirty(false); setSaved(true); } catch (e) { setErr((e as Error).message); } finally { setSaving(false); } }
  const s = config.sessions;
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-semibold text-text-primary">User Sessions</p>
        <Card>
          <Row title="Enforce single session per user" desc="All but a user's most recently active session are terminated." control={<Toggle on={s.single_session} onChange={(v) => set('single_session', v)} />} />
          <Row title="Time-box user sessions" desc="Hours before a user must sign in again. 0 = never." control={<NumInput value={s.timebox_hours} onChange={(n) => set('timebox_hours', n)} unit={s.timebox_hours ? 'hours' : 'never'} />} />
          <Row title="Inactivity timeout" desc="Idle hours before a user must sign in again. 0 = never." control={<NumInput value={s.inactivity_timeout_hours} onChange={(n) => set('inactivity_timeout_hours', n)} unit={s.inactivity_timeout_hours ? 'hours' : 'never'} />} />
        </Card>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-text-primary">Access Tokens</p>
        <Card>
          <Row title="Access token expiry" desc="How long access tokens are valid before refresh. Recommended: 3600s." control={<NumInput value={s.jwt_expiry} onChange={(n) => set('jwt_expiry', n)} unit="seconds" />} />
        </Card>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-text-primary">Refresh Tokens</p>
        <Card>
          <Row title="Detect & revoke reused refresh tokens" desc="Prevent replay from potentially compromised refresh tokens." control={<Toggle on={s.refresh_rotation} onChange={(v) => set('refresh_rotation', v)} />} />
          <Row title="Refresh token reuse interval" desc="Seconds a refresh token may be reused. Recommended: 10." control={<NumInput value={s.refresh_reuse_interval} onChange={(n) => set('refresh_reuse_interval', n)} unit="seconds" />} />
        </Card>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <SaveBar dirty={dirty} saving={saving} saved={saved} onSave={save} />
    </div>
  );
}

// ── Rate Limits ───────────────────────────────────────────────────────────────
function RateLimitsPage({ token, projectId }: { token: string; projectId: number }) {
  const { config, setConfig, loading, err, setErr } = useAuthConfig(token, projectId);
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false); const [dirty, setDirty] = useState(false);
  if (loading) return <Center />;
  if (!config) return <p className="text-sm text-red-600">{err || 'Could not load config.'}</p>;
  const set = (k: keyof AuthConfig['rate_limits'], v: number) => { setConfig({ ...config, rate_limits: { ...config.rate_limits, [k]: v } }); setDirty(true); setSaved(false); };
  async function save() { setSaving(true); setErr(''); try { const r = await api.setAuthConfig(token, projectId, { rate_limits: config!.rate_limits }); setConfig(r.config); setDirty(false); setSaved(true); } catch (e) { setErr((e as Error).message); } finally { setSaving(false); } }
  const r = config.rate_limits;
  const rows: [keyof AuthConfig['rate_limits'], string, string, string][] = [
    ['emails_per_hour', 'Rate limit for sending emails', 'Emails sent per hour from your project.', 'emails/h'],
    ['sms_per_hour', 'Rate limit for sending SMS', 'SMS messages sent per hour from your project.', 'sms/h'],
    ['token_refresh_per_5min', 'Rate limit for token refreshes', 'Sessions refreshed per 5 min per IP.', 'req/5min'],
    ['token_verify_per_5min', 'Rate limit for token verifications', 'OTP / magic-link verifications per 5 min per IP.', 'req/5min'],
    ['anonymous_per_hour', 'Rate limit for anonymous users', 'Anonymous sign-ins per hour per IP.', 'req/h'],
    ['signin_per_5min', 'Rate limit for sign-ups and sign-ins', 'Sign-up/sign-in requests per 5 min per IP.', 'req/5min'],
  ];
  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">Safeguard against bursts of traffic to prevent abuse and maximize stability.</p>
      <Card>{rows.map(([k, title, desc, unit]) => <Row key={k} title={title} desc={desc} control={<NumInput value={r[k]} onChange={(n) => set(k, n)} unit={unit} />} />)}</Card>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <SaveBar dirty={dirty} saving={saving} saved={saved} onSave={save} />
    </div>
  );
}

// ── URL Configuration ─────────────────────────────────────────────────────────
function UrlConfigPage({ token, projectId }: { token: string; projectId: number }) {
  const { config, setConfig, loading, err, setErr } = useAuthConfig(token, projectId);
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false); const [dirty, setDirty] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  if (loading) return <Center />;
  if (!config) return <p className="text-sm text-red-600">{err || 'Could not load config.'}</p>;
  const u = config.url_config;
  const setSite = (v: string) => { setConfig({ ...config, url_config: { ...u, site_url: v } }); setDirty(true); setSaved(false); };
  const addUrl = () => { const v = newUrl.trim(); if (!v) return; setConfig({ ...config, url_config: { ...u, redirect_urls: [...u.redirect_urls, v] } }); setNewUrl(''); setDirty(true); setSaved(false); };
  const removeUrl = (i: number) => { setConfig({ ...config, url_config: { ...u, redirect_urls: u.redirect_urls.filter((_, idx) => idx !== i) } }); setDirty(true); setSaved(false); };
  async function save() { setSaving(true); setErr(''); try { const r = await api.setAuthConfig(token, projectId, { url_config: config!.url_config }); setConfig(r.config); setDirty(false); setSaved(true); } catch (e) { setErr((e as Error).message); } finally { setSaving(false); } }
  return (
    <div className="space-y-5">
      <div>
        <label className="text-sm font-medium text-text-primary">Site URL</label>
        <p className="mb-1.5 text-xs text-text-muted">The base URL of your app; used for redirects and email links.</p>
        <input value={u.site_url} onChange={(e) => setSite(e.target.value)} placeholder="https://your-app.com" className="w-full rounded-lg border border-neutral-border px-3 py-2 text-sm text-text-primary" />
      </div>
      <div>
        <label className="text-sm font-medium text-text-primary">Redirect URLs</label>
        <p className="mb-1.5 text-xs text-text-muted">Allow-list of URLs auth can redirect to after sign-in.</p>
        <div className="mb-2 flex gap-2">
          <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://your-app.com/callback" className="flex-1 rounded-lg border border-neutral-border px-3 py-2 text-sm" />
          <button onClick={addUrl} className="inline-flex items-center gap-1 rounded-full border border-neutral-border px-3 py-2 text-sm text-text-secondary hover:bg-bg-secondary"><Plus size={14} /> Add</button>
        </div>
        {u.redirect_urls.length > 0 && (
          <ul className="divide-y divide-neutral-border rounded-lg border border-neutral-border">
            {u.redirect_urls.map((url, i) => (
              <li key={i} className="flex items-center gap-2 px-3 py-2 text-sm"><span className="truncate font-mono text-xs text-text-primary">{url}</span>
                <button onClick={() => removeUrl(i)} className="ml-auto text-text-muted hover:text-red-600"><Trash2 size={14} /></button></li>
            ))}
          </ul>
        )}
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <SaveBar dirty={dirty} saving={saving} saved={saved} onSave={save} />
    </div>
  );
}

// ── OAuth Server (config — control-plane, works pre-deploy) ─────────────────────
function OAuthServerPage({ token, projectId }: { token: string; projectId: number }) {
  const { config, setConfig, loading, err, setErr } = useAuthConfig(token, projectId);
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false); const [dirty, setDirty] = useState(false);
  if (loading) return <Center />;
  if (!config) return <p className="text-sm text-red-600">{err || 'Could not load config.'}</p>;
  const os = config.oauth_server;
  const set = (k: keyof AuthConfig['oauth_server'], v: boolean | string) => { setConfig({ ...config, oauth_server: { ...os, [k]: v } }); setDirty(true); setSaved(false); };
  async function save() { setSaving(true); setErr(''); try { const r = await api.setAuthConfig(token, projectId, { oauth_server: config!.oauth_server }); setConfig(r.config); setDirty(false); setSaved(true); } catch (e) { setErr((e as Error).message); } finally { setSaving(false); } }
  const site = config.url_config.site_url;
  const previewUrl = site ? `${site.replace(/\/$/, '')}${os.authorization_path || '/oauth/consent'}` : null;
  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">Configure your project to act as an identity provider for third-party applications.</p>
      <Card>
        <Row title="Enable the OAuth Server" desc="Let this project create and manage OAuth applications." control={<Toggle on={os.enabled} onChange={(v) => set('enabled', v)} />} />
        <div className="px-4 py-3">
          <p className="text-sm text-text-primary">Authorization Path</p>
          <p className="mb-2 text-xs text-text-muted">Path on your site where you implement the consent screen.</p>
          <input value={os.authorization_path} onChange={(e) => set('authorization_path', e.target.value)} className="w-full rounded-lg border border-neutral-border px-3 py-2 font-mono text-sm text-text-primary" />
          {previewUrl
            ? <p className="mt-1.5 text-xs text-text-muted">Preview authorization URL: <code className="rounded bg-bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-text-primary">{previewUrl}</code></p>
            : <p className="mt-1.5 text-xs text-amber-700">Set a Site URL under URL Configuration to preview the authorization URL.</p>}
        </div>
        <Row title="Allow Dynamic OAuth Apps" desc="Enable programmatic app registration via the /oauth/register API." control={<Toggle on={os.allow_dynamic} onChange={(v) => set('allow_dynamic', v)} />} />
      </Card>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <SaveBar dirty={dirty} saving={saving} saved={saved} onSave={save} />
    </div>
  );
}

// ── OAuth Apps (registered client apps — live, deploy-gated) ────────────────────
function OAuthAppsPage({ token, projectId, onGoToSettings }: { token: string; projectId: number; onGoToSettings: () => void }) {
  const [enabled, setEnabled] = useState(false);
  const [apps, setApps] = useState<OAuthApp[] | null>(null);
  const [loading, setLoading] = useState(true); const [down, setDown] = useState(false); const [err, setErr] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState(''); const [type, setType] = useState<'confidential' | 'public'>('confidential'); const [uris, setUris] = useState('');
  const [created, setCreated] = useState<OAuthApp | null>(null);

  async function load() {
    setLoading(true); setDown(false);
    try { const cfg = await api.getAuthConfig(token, projectId); setEnabled(cfg.config.oauth_server.enabled); } catch { /* ignore */ }
    try { const r = await api.baasOAuthApps(token, projectId); setApps(r.apps); } catch { setDown(true); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token, projectId]);

  async function create() {
    setErr('');
    const redirect_uris = uris.split(/[\n,]/).map((u) => u.trim()).filter(Boolean);
    if (!name.trim() || redirect_uris.length === 0) { setErr('Name and at least one redirect URI are required.'); return; }
    try {
      const app = await api.baasCreateOAuthApp(token, projectId, { name: name.trim(), redirect_uris, client_type: type });
      setCreated(app); setShowNew(false); setName(''); setUris(''); load();
    } catch (e) { setErr((e as Error).message); }
  }
  async function del(clientId: string) { try { await api.baasDeleteOAuthApp(token, projectId, clientId); load(); } catch (e) { setErr((e as Error).message); } }

  if (loading) return <Center />;

  return (
    <div className="space-y-4">
      <div className={cn('flex items-center gap-3 rounded-xl border p-3 text-sm', enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-neutral-border bg-bg-secondary text-text-secondary')}>
        <Server size={16} />
        <span>{enabled ? 'OAuth Server is enabled.' : 'OAuth Server is disabled. Enable it to register apps.'}</span>
        {!enabled && <button onClick={onGoToSettings} className="ml-auto rounded-full border border-neutral-border bg-white px-3 py-1 text-xs font-medium text-text-secondary hover:bg-bg-secondary">OAuth Server Settings</button>}
      </div>

      {created && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="mb-1 text-xs font-medium text-amber-800">App created — copy the client secret now, it won&apos;t be shown again.</p>
          <CopyLine label="Client ID" value={created.client_id} />
          {created.client_secret && <CopyLine label="Client Secret" value={created.client_secret} />}
          <button onClick={() => setCreated(null)} className="mt-1.5 text-xs text-amber-700 hover:underline">Done</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">Third-party apps that can sign users in with this project.</p>
        <button onClick={() => setShowNew((s) => !s)} disabled={!enabled}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary-blue px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"><Plus size={14} /> New OAuth App</button>
      </div>

      {showNew && enabled && (
        <div className="space-y-2 rounded-xl border border-neutral-border bg-surface-card p-4">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="App name" className="w-full rounded-lg border border-neutral-border px-3 py-2 text-sm" />
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-muted">Client type</span>
            <select value={type} onChange={(e) => setType(e.target.value as 'confidential' | 'public')} className="rounded-lg border border-neutral-border px-2 py-1.5 text-sm">
              <option value="confidential">Confidential (has secret)</option>
              <option value="public">Public (PKCE, no secret)</option>
            </select>
          </div>
          <textarea value={uris} onChange={(e) => setUris(e.target.value)} rows={3} placeholder="Redirect URIs (one per line)" className="w-full rounded-lg border border-neutral-border px-3 py-2 font-mono text-xs" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNew(false)} className="rounded-full border border-neutral-border px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-secondary">Cancel</button>
            <button onClick={create} className="rounded-full bg-primary-blue px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700">Create app</button>
          </div>
        </div>
      )}

      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}

      {down ? (
        <div className="rounded-2xl border border-neutral-border bg-surface-card p-8 text-center">
          <ServerCrash size={22} className="mx-auto text-text-muted" />
          <p className="mt-3 text-sm font-medium text-text-primary">Backend not running yet</p>
          <p className="mt-1 text-sm text-text-muted">Registered apps live in your project backend — deploy it to manage them. Settings on the left work now.</p>
        </div>
      ) : apps && apps.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-neutral-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg-secondary text-xs uppercase text-text-muted"><tr><th className="px-4 py-2 font-medium">Name</th><th className="px-4 py-2 font-medium">Client ID</th><th className="px-4 py-2 font-medium">Type</th><th className="px-4 py-2" /></tr></thead>
            <tbody className="divide-y divide-neutral-border">
              {apps.map((a) => (
                <tr key={a.client_id}>
                  <td className="px-4 py-2.5 text-text-primary">{a.name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-text-muted">{a.client_id}</td>
                  <td className="px-4 py-2.5"><span className="rounded-full bg-bg-secondary px-2 py-0.5 text-xs text-text-muted">{a.client_type}</span></td>
                  <td className="px-4 py-2.5 text-right"><button onClick={() => del(a.client_id)} className="text-text-muted hover:text-red-600" aria-label="Delete app"><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-2xl border border-neutral-border bg-surface-card p-8 text-center text-sm text-text-muted">No OAuth apps found.</p>
      )}
    </div>
  );
}

function CopyLine({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-1 flex items-center gap-2">
      <span className="w-24 text-xs text-amber-800">{label}</span>
      <code className="flex-1 truncate rounded bg-white px-2 py-1 font-mono text-xs text-text-primary">{value}</code>
      <button onClick={async () => { try { await navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* noop */ } }} className="text-amber-700"><Copy size={13} /></button>
      {copied && <Check size={13} className="text-emerald-600" />}
    </div>
  );
}

// ── Users (live — deploy-gated) ────────────────────────────────────────────────
function UsersPage({ token, projectId }: { token: string; projectId: number }) {
  const [data, setData] = useState<{ users: BaasUser[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true); const [down, setDown] = useState(false);
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [err, setErr] = useState('');
  const [deploying, setDeploying] = useState(false);

  async function load() { setLoading(true); setDown(false); try { setData(await api.baasUsers(token, projectId)); } catch { setDown(true); } finally { setLoading(false); } }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token, projectId]);
  async function add(email: string, password: string, autoConfirm: boolean) {
    await api.baasCreateUser(token, projectId, { email, password, auto_confirm: autoConfirm });
    setShowAdd(false); load();
  }
  async function del(id: number) { try { await api.baasDeleteUser(token, projectId, id); load(); } catch (e) { setErr((e as Error).message); } }
  async function deploy() { setDeploying(true); setErr(''); try { await api.deployBaas(token, projectId); load(); } catch (e) { setErr((e as Error).message); } finally { setDeploying(false); } }

  const users = (data?.users ?? []).filter((u) => !query || (u.email || '').toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-3">
      {/* Toolbar — always visible (search + Add user), like Supabase */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by email"
            className="w-full rounded-lg border border-neutral-border py-2 pl-9 pr-3 text-sm" />
        </div>
        <button onClick={load} aria-label="Refresh" className="rounded-lg border border-neutral-border p-2 text-text-muted hover:text-text-primary"><RefreshCw size={15} /></button>
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"><Plus size={15} /> Add user</button>
      </div>

      {showAdd && <CreateUserModal onClose={() => setShowAdd(false)} onCreate={add} />}

      {down && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <ServerCrash size={16} />
          <span>Backend not deployed — live users will appear once it&apos;s running. Auth settings on the left work now.</span>
          <button onClick={deploy} disabled={deploying} className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-primary-blue px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {deploying ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />} Deploy
          </button>
        </div>
      )}
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}

      {loading ? <Center /> : (
        <div className="overflow-hidden rounded-2xl border border-neutral-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg-secondary text-xs uppercase text-text-muted">
              <tr><th className="px-4 py-2 font-medium">UID</th><th className="px-4 py-2 font-medium">Email</th><th className="px-4 py-2 font-medium">Created</th><th className="px-4 py-2" /></tr>
            </thead>
            <tbody className="divide-y divide-neutral-border">
              {users.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center">
                  <Users size={22} className="mx-auto text-text-muted" />
                  <p className="mt-2 text-sm font-medium text-text-primary">No users in your project</p>
                  <p className="text-sm text-text-muted">There are currently no users who signed up to your project.</p>
                </td></tr>
              ) : users.map((usr) => (
                <tr key={usr.id}>
                  <td className="px-4 py-2.5 font-mono text-xs text-text-muted">{usr.id}</td>
                  <td className="px-4 py-2.5 text-text-primary">{usr.email}</td>
                  <td className="px-4 py-2.5 text-xs text-text-muted">{new Date(usr.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 text-right"><button onClick={() => del(usr.id)} className="text-text-muted hover:text-red-600" aria-label="Delete user"><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
