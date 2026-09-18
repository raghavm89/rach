'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, ShieldCheck, Lock } from 'lucide-react';

/**
 * Reference OAuth consent screen (the page you point "Authorization Path" at). This is what an
 * end-user sees after a third-party app sends them to `<project>/auth/oauth/authorize`: they sign
 * in to YOUR project, then approve/deny. It runs entirely client-side against the project backend
 * (`issuer`) — obtain a user session, then POST the decision to `/auth/oauth/consent`, which
 * returns the redirect back to the app (with the auth code, or an error).
 *
 * Copy this into your own app and restyle it; nothing here is RachBase-specific.
 */
export default function OAuthConsentPage() {
  return (
    <Suspense fallback={<Shell><Loader2 className="animate-spin text-neutral-400" /></Shell>}>
      <Consent />
    </Suspense>
  );
}

function Consent() {
  const q = useSearchParams();
  const issuer = (q.get('issuer') || '').replace(/\/$/, '');
  const clientId = q.get('client_id') || '';
  const redirectUri = q.get('redirect_uri') || '';
  const scope = q.get('scope') || '';
  const state = q.get('state') || '';
  const codeChallenge = q.get('code_challenge') || '';
  const codeChallengeMethod = q.get('code_challenge_method') || '';

  const [token, setToken] = useState('');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');

  const missing = !issuer || !clientId || !redirectUri;

  async function signIn() {
    setBusy(true); setErr('');
    try {
      const r = await fetch(`${issuer}/auth/v1/token`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const body = await r.json();
      if (!r.ok || !body.access_token) throw new Error(body.error || 'sign-in failed');
      setToken(body.access_token);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function decide(approved: boolean) {
    setBusy(true); setErr('');
    try {
      const r = await fetch(`${issuer}/auth/oauth/consent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ client_id: clientId, redirect_uri: redirectUri, scope, state, code_challenge: codeChallenge, code_challenge_method: codeChallengeMethod, approved }),
      });
      const body = await r.json();
      if (!r.ok || !body.redirect) throw new Error(body.error || 'consent failed');
      window.location.href = body.redirect;   // back to the app with ?code=… (or ?error=…)
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  if (missing) return <Shell><p className="text-sm text-red-600">Missing OAuth parameters (issuer, client_id, redirect_uri). This page is opened by an app&apos;s sign-in flow.</p></Shell>;

  return (
    <Shell>
      <div className="mb-5 flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><ShieldCheck size={22} /></div>
        <div>
          <h1 className="text-lg font-bold text-neutral-900">Authorize application</h1>
          <p className="text-xs text-neutral-500">An app wants to sign you in and access your account.</p>
        </div>
      </div>

      <dl className="mb-5 space-y-1.5 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs">
        <Detail k="Application" v={clientId} mono />
        <Detail k="Redirect to" v={redirectUri} mono />
        {scope && <Detail k="Scope" v={scope} />}
      </dl>

      {err && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}

      {!token ? (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-sm font-medium text-neutral-700"><Lock size={14} /> Sign in to continue</p>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="password" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          <button onClick={signIn} disabled={busy || !email || !password} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {busy && <Loader2 size={15} className="animate-spin" />} Sign in
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button onClick={() => decide(false)} disabled={busy} className="flex-1 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">Deny</button>
          <button onClick={() => decide(true)} disabled={busy} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {busy && <Loader2 size={15} className="animate-spin" />} Authorize
          </button>
        </div>
      )}
    </Shell>
  );
}

function Detail({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex gap-2"><dt className="w-24 shrink-0 text-neutral-500">{k}</dt><dd className={`min-w-0 flex-1 truncate text-neutral-800 ${mono ? 'font-mono' : ''}`}>{v}</dd></div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">{children}</div>
    </div>
  );
}
