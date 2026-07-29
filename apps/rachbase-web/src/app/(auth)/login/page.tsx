'use client';

import { Suspense, useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { AuthApiError, User } from '@rach/ui/lib/api';
import { OAuthButtons, OAuthDivider } from '@rach/ui/components/auth/OAuthButtons';
import { OtpVerification } from '@rach/ui/components/auth/OtpVerification';
import { PasswordStrength, isPasswordValid } from '@rach/ui/components/auth/PasswordStrength';
import { cn } from '@rach/ui/lib/utils';

/**
 * Combined sign-in / sign-up screen.
 *
 * The OTP screen, the OAuth buttons and the password meter now live in
 * @rach/ui/components/auth — this file previously carried all three inline at
 * 529 lines with ~20 useState hooks.
 */

type Tab = 'login' | 'signup';

interface PendingState {
  pendingId: number;
  email: string;
  expiresAt?: string;
  resendsRemaining?: number;
}

const URL_ERRORS: Record<string, string> = {
  session_expired: 'Your session expired. Please sign in again.',
};

const inputCls = cn(
  'w-full rounded-lg border border-neutral-border bg-white px-4 py-3 text-sm text-text-primary',
  'placeholder:text-text-muted outline-none transition-colors duration-200',
  'focus:border-primary-blue focus:ring-2 focus:ring-blue-500/20',
);

const submitCls = cn(
  'w-full rounded-full py-3 text-sm font-semibold text-white transition-all duration-200',
  'bg-gradient-to-r from-primary-blue to-primary-purple shadow-md',
  'hover:opacity-90 hover:shadow-lg',
  'disabled:cursor-not-allowed disabled:opacity-60',
  'flex items-center justify-center gap-2',
);

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { login, register, setSession } = useAuth();

  const [tab, setTab] = useState<Tab>(searchParams.get('tab') === 'signup' ? 'signup' : 'login');

  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [error, setError]         = useState('');
  const [noAccount, setNoAccount] = useState(false);
  const [loading, setLoading]     = useState(false);

  const [name, setName]         = useState('');
  const [phone, setPhone]       = useState('');
  const [workspace, setWorkspace] = useState('');
  const [accepted, setAccepted] = useState(false);

  const [pending, setPending] = useState<PendingState | null>(null);

  // Surface redirect-borne errors (e.g. the expired-session bounce).
  useEffect(() => {
    const code = searchParams.get('error');
    if (code) setError(URL_ERRORS[code] ?? code);
  }, [searchParams]);

  // Keep ?tab= in sync so the signup tab is linkable and survives a reload.
  // The tab used to be read once on mount and the URL never updated.
  const switchTab = useCallback((t: Tab) => {
    setTab(t);
    setError('');
    setNoAccount(false);
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    if (t === 'signup') params.set('tab', 'signup');
    else params.delete('tab');
    params.delete('error');
    router.replace(params.toString() ? `/login?${params}` : '/login', { scroll: false });
  }, [router, searchParams]);

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNoAccount(false);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      const e2 = err as AuthApiError;
      if (e2.pending_id) {
        // Signup was started but never confirmed — resume at the OTP screen
        // rather than claiming the account doesn't exist. The backend now
        // actually returns pending_id here; it never did, so this branch was
        // unreachable and the user hit a dead end.
        setPending({
          pendingId       : e2.pending_id,
          email,
          expiresAt       : e2.expires_at,
          resendsRemaining: e2.resends_remaining,
        });
      } else if (e2.no_account) {
        setNoAccount(true);
      } else {
        setError(e2.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [email, password, login]);

  const handleSignUp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await register(name, email, password, phone || undefined, workspace || undefined);
      setPending({ pendingId: result.pending_id, email, expiresAt: result.expires_at });
    } catch (err) {
      setError((err as Error).message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [name, email, password, phone, workspace, register]);

  const handleVerified = useCallback((token: string, user: User, expiresIn?: number) => {
    setSession(token, user, expiresIn);
    router.push('/dashboard');
  }, [setSession, router]);

  if (pending) {
    return (
      <div className="rounded-2xl border border-neutral-border bg-white px-8 py-10 shadow-sm">
        <OtpVerification
          pendingId={pending.pendingId}
          email={pending.email}
          expiresAt={pending.expiresAt}
          initialResendsRemaining={pending.resendsRemaining}
          onVerified={handleVerified}
          onBack={() => { setPending(null); switchTab('login'); }}
        />
      </div>
    );
  }

  const signupReady = Boolean(name && email && isPasswordValid(password) && accepted);

  return (
    <div className="rounded-2xl border border-neutral-border bg-white px-8 py-10 shadow-sm">
      <div role="tablist" aria-label="Sign in or sign up" className="mb-8 flex rounded-xl bg-bg-secondary p-1">
        {(['login', 'signup'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => switchTab(t)}
            className={cn(
              'flex-1 rounded-lg py-2 text-sm font-semibold transition-all duration-200',
              tab === t ? 'bg-white text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary',
            )}
          >
            {t === 'login' ? 'Sign In' : 'Sign Up'}
          </button>
        ))}
      </div>

      <div className="mb-8 h-0.5 w-full rounded-full" style={{ background: 'var(--gradient-cta)' }} />

      {/* Errors are announced, not merely displayed. */}
      <div aria-live="assertive">
        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}
      </div>

      {tab === 'login' ? (
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary" htmlFor="email">
              Email address
            </label>
            <input
              id="email" type="email" autoComplete="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com" className={inputCls}
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-text-primary" htmlFor="password">Password</label>
              <Link href="/forgot-password" className="text-xs text-primary-blue hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password" type={showPw ? 'text' : 'password'} autoComplete="current-password"
                required value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" className={cn(inputCls, 'pr-11')}
              />
              <button
                type="button" onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors hover:text-text-secondary"
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div aria-live="polite">
            {noAccount && (
              <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <p className="font-semibold">No account found</p>
                <p className="text-amber-700">
                  There&apos;s no account registered with this email address.{' '}
                  <button
                    type="button"
                    onClick={() => { setNoAccount(false); switchTab('signup'); }}
                    className="font-semibold underline underline-offset-2 transition-colors hover:text-amber-900"
                  >
                    Create an account →
                  </button>
                </p>
              </div>
            )}
          </div>

          <button type="submit" disabled={loading} className={submitCls}>
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Signing in…' : 'Sign in →'}
          </button>

          <OAuthDivider />
          <OAuthButtons />

          <p className="text-center text-sm text-text-muted">
            Don&apos;t have an account?{' '}
            <button type="button" onClick={() => switchTab('signup')} className="font-medium text-primary-blue hover:underline">
              Sign up free
            </button>
          </p>
        </form>
      ) : (
        <form onSubmit={handleSignUp} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary" htmlFor="su-name">
              Full name <span className="text-red-400">*</span>
            </label>
            <input
              id="su-name" type="text" autoComplete="name" required value={name}
              onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary" htmlFor="su-email">
              Email address <span className="text-red-400">*</span>
            </label>
            <input
              id="su-email" type="email" autoComplete="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary" htmlFor="su-phone">
              Phone number <span className="text-xs font-normal text-text-muted">(optional)</span>
            </label>
            <input
              id="su-phone" type="tel" autoComplete="tel" value={phone}
              onChange={(e) => setPhone(e.target.value)} placeholder="+1 415 555 0100" className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary" htmlFor="su-workspace">
              Workspace name <span className="text-xs font-normal text-text-muted">(optional)</span>
            </label>
            <input
              id="su-workspace" type="text" autoComplete="organization" value={workspace}
              onChange={(e) => setWorkspace(e.target.value)} placeholder="Acme Inc" className={inputCls}
            />
            <p className="mt-1 text-xs text-text-muted">
              Sets up your billing workspace so you can add credits. You can add this later if you skip it.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary" htmlFor="su-password">
              Password <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                id="su-password" type={showPw ? 'text' : 'password'} autoComplete="new-password"
                required value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 10 characters" className={cn(inputCls, 'pr-11')}
                aria-describedby="pw-requirements"
              />
              <button
                type="button" onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors hover:text-text-secondary"
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div id="pw-requirements">
              <PasswordStrength password={password} />
            </div>
          </div>

          {/* Terms acceptance previously appeared only on the /signup stub —
              i.e. not on the form people actually submit. */}
          <label className="flex items-start gap-2.5 text-sm text-text-muted">
            <input
              type="checkbox" checked={accepted} required
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-neutral-border text-primary-blue focus:ring-2 focus:ring-primary-blue/30"
            />
            <span>
              I agree to the{' '}
              <Link href="/legal/terms" className="text-primary-blue hover:underline">Terms of Service</Link>
              {' '}and{' '}
              <Link href="/legal/privacy" className="text-primary-blue hover:underline">Privacy Policy</Link>.
            </span>
          </label>

          <button type="submit" disabled={loading || !signupReady} className={submitCls}>
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Creating account…' : 'Create account →'}
          </button>

          <OAuthDivider label="or sign up with" />
          <OAuthButtons />

          <p className="text-center text-sm text-text-muted">
            Already have an account?{' '}
            <button type="button" onClick={() => switchTab('login')} className="font-medium text-primary-blue hover:underline">
              Sign in
            </button>
          </p>
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
