'use client';

import { Suspense, useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Mail } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { auth } from '@rach/ui/lib/api';
import { cn } from '@rach/ui/lib/utils';
import { PasswordStrength, isPasswordValid } from '@rach/ui/components/auth/PasswordStrength';

// Falls back to the BACKEND port (8080), matching the shared api client — the
// old default was 3000 (the frontend's own port), so OAuth links pointed at the
// app itself when the env var was unset. (auth audit #25)
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

function OAuthDivider() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 border-t border-neutral-border" />
      <span className="text-xs text-text-muted">or continue with</span>
      <div className="flex-1 border-t border-neutral-border" />
    </div>
  );
}

function OAuthButtons() {
  return (
    <div className="flex flex-col gap-2.5">
      <a
        href={`${BACKEND_URL}/api/auth/google`}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-neutral-border bg-white px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-bg-secondary transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18L12.048 13.56C11.24 14.1 10.211 14.42 9 14.42c-2.392 0-4.417-1.616-5.142-3.786H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
          <path d="M3.858 10.634A5.452 5.452 0 013.52 9c0-.563.097-1.11.338-1.634V5.034H.957A9 9 0 000 9c0 1.452.348 2.827.957 4.034l2.9-2.4z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.966l2.9 2.4C4.584 5.196 6.608 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </a>
      <a
        href={`${BACKEND_URL}/api/auth/github`}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-neutral-border bg-white px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-bg-secondary transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
        </svg>
        Continue with GitHub
      </a>
    </div>
  );
}


type Tab = 'login' | 'signup';

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = (searchParams.get('tab') === 'signup' ? 'signup' : 'login') as Tab;

  const { login, register, setSession } = useAuth();
  const [tab, setTab] = useState<Tab>(initialTab);

  // Shared
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState(searchParams.get('error') || '');
  const [noAccount, setNoAccount] = useState(false);
  const [loading, setLoading]   = useState(false);

  // Sign-up only
  const [name, setName]   = useState('');
  const [phone, setPhone] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [accepted, setAccepted] = useState(false); // Terms acceptance (auth audit: legal)

  // OTP verification state (shown after sign-up or login with unverified email)
  const [pendingId, setPendingId]           = useState<number | null>(null);
  const [otp, setOtp]                       = useState<string[]>(Array(6).fill(''));
  const [otpError, setOtpError]             = useState('');
  const [otpLoading, setOtpLoading]         = useState(false);
  const [resendLoading, setResendLoading]   = useState(false);
  const [resendMsg, setResendMsg]           = useState('');
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer state
  const [otpExpiresAt, setOtpExpiresAt]           = useState<number | null>(null);
  const [otpTimeLeft, setOtpTimeLeft]               = useState(600); // seconds
  const [resendCooldownUntil, setResendCooldownUntil] = useState<number | null>(null);
  const [resendCooldown, setResendCooldown]         = useState(0);   // seconds until resend allowed
  const [resendAttemptsLeft, setResendAttemptsLeft] = useState(5);

  const MAX_RESENDS = 5;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // Tick timers every second while OTP screen is visible
  useEffect(() => {
    if (!otpExpiresAt) return;
    const tick = () => {
      const now = Date.now();
      setOtpTimeLeft(Math.max(0, Math.floor((otpExpiresAt - now) / 1000)));
      if (resendCooldownUntil) {
        setResendCooldown(Math.max(0, Math.ceil((resendCooldownUntil - now) / 1000)));
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [otpExpiresAt, resendCooldownUntil]);

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNoAccount(false);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      const e2 = err as Error & { pending_id?: number; no_account?: boolean };
      if (e2.pending_id) {
        // Email exists but not yet verified — jump straight to OTP screen
        setPendingId(e2.pending_id);
        setOtpExpiresAt(Date.now() + 10 * 60_000);
        setResendCooldownUntil(Date.now() + 60_000);
        setResendAttemptsLeft(MAX_RESENDS);
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
      // Registration succeeded — show email-verification pending screen
      setPendingId(result.pending_id);
      const expiry = new Date(result.expires_at).getTime();
      setOtpExpiresAt(expiry);
      setOtpTimeLeft(Math.floor((expiry - Date.now()) / 1000));
      setResendCooldownUntil(Date.now() + 60_000);
      setResendCooldown(60);
      setResendAttemptsLeft(MAX_RESENDS);
    } catch (err) {
      setError((err as Error).message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [name, email, password, phone, workspace, register]);

  const handleOtpChange = useCallback((index: number, value: string) => {
    // Accept only digits; handle paste of full code
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length > 1) {
      // Paste scenario — distribute digits across boxes
      const digits = cleaned.slice(0, 6).split('');
      setOtp((prev) => {
        const next = [...prev];
        digits.forEach((d, i) => { if (index + i < 6) next[index + i] = d; });
        return next;
      });
      const nextFocus = Math.min(index + digits.length, 5);
      otpRefs.current[nextFocus]?.focus();
    } else {
      setOtp((prev) => { const next = [...prev]; next[index] = cleaned; return next; });
      if (cleaned && index < 5) otpRefs.current[index + 1]?.focus();
    }
    setOtpError('');
  }, []);

  const handleOtpKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }, [otp]);

  const handleOtpSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingId) return;
    const code = otp.join('');
    if (code.length < 6) { setOtpError('Please enter the full 6-digit code.'); return; }
    setOtpLoading(true);
    setOtpError('');
    try {
      const { access_token, user } = await auth.verifyEmailOtp(pendingId, code);
      setSession(access_token, user);
      router.push('/dashboard');
    } catch (err) {
      setOtpError((err as Error).message || 'Invalid code. Please try again.');
      setOtp(Array(6).fill(''));
      otpRefs.current[0]?.focus();
    } finally {
      setOtpLoading(false);
    }
  }, [pendingId, otp, setSession, router]);

  const handleResend = useCallback(async () => {
    if (!pendingId || resendCooldown > 0 || resendAttemptsLeft <= 0) return;
    setResendLoading(true);
    setResendMsg('');
    setOtp(Array(6).fill(''));
    setOtpError('');
    try {
      const result = await auth.resendVerification(pendingId);
      const expiry = new Date(result.expires_at).getTime();
      setOtpExpiresAt(expiry);
      setOtpTimeLeft(Math.floor((expiry - Date.now()) / 1000));
      setResendCooldownUntil(Date.now() + 60_000);
      setResendCooldown(60);
      setResendAttemptsLeft(result.resends_remaining);
      setResendMsg('New code sent! Check your inbox.');
      otpRefs.current[0]?.focus();
    } catch (err) {
      setResendMsg((err as Error).message || 'Failed to resend. Please try again.');
    } finally {
      setResendLoading(false);
    }
  }, [pendingId, resendCooldown, resendAttemptsLeft]);

  const switchTab = (t: Tab) => {
    setTab(t);
    setError('');
    setNoAccount(false);
  };

  const inputCls = cn(
    'w-full rounded-lg border border-neutral-border bg-white px-4 py-3 text-sm text-text-primary placeholder:text-text-muted outline-none transition-colors duration-200',
    'focus:border-primary-blue focus:ring-2 focus:ring-blue-500/20',
  );

  const submitCls = cn(
    'w-full rounded-full py-3 text-sm font-semibold text-white transition-all duration-200',
    'bg-gradient-to-r from-primary-blue to-primary-purple shadow-md',
    'hover:opacity-90 hover:shadow-lg',
    'disabled:opacity-60 disabled:cursor-not-allowed',
    'flex items-center justify-center gap-2',
  );

  return (
    <>
        {/* Card */}
        <div className="rounded-2xl border border-neutral-border bg-white px-8 py-10 shadow-sm">

          {/* ── OTP VERIFICATION ── */}
          {pendingId && (
            <div className="flex flex-col items-center py-2">
              {/* Icon */}
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                   style={{ background: 'linear-gradient(135deg,#eff6ff,#f5f3ff)' }}>
                <Mail size={28} style={{ color: '#2563eb' }} />
              </div>

              <h2 className="mb-1 text-xl font-bold text-text-primary">Check your email</h2>
              <p className="mb-3 text-sm text-text-muted text-center leading-relaxed">
                We sent a 6-digit code to{' '}
                <strong className="text-text-primary">{email}</strong>.
                <br />Enter it below to activate your account.
              </p>

              {/* OTP expiry countdown */}
              <div className={cn(
                'mb-5 flex items-center justify-center gap-1.5 text-sm font-medium',
                otpTimeLeft === 0
                  ? 'text-red-500'
                  : otpTimeLeft < 120
                    ? 'text-orange-500'
                    : 'text-text-muted',
              )}>
                <span>{otpTimeLeft === 0 ? '⏱ Code expired' : `⏱ Expires in ${fmt(otpTimeLeft)}`}</span>
              </div>

              <form onSubmit={handleOtpSubmit} className="w-full">
                {/* OTP boxes */}
                <div className="mb-5 flex justify-center gap-2">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      onFocus={(e) => e.target.select()}
                      className={cn(
                        'h-14 w-11 rounded-xl border-2 text-center text-xl font-bold text-text-primary',
                        'outline-none transition-all duration-150 font-mono',
                        digit
                          ? 'border-primary-blue bg-blue-50'
                          : 'border-neutral-border bg-white',
                        'focus:border-primary-blue focus:ring-2 focus:ring-blue-500/20',
                        otpError && !digit ? 'border-red-300' : '',
                      )}
                    />
                  ))}
                </div>

                {otpError && (
                  <div role="alert" aria-live="assertive" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 text-center">
                    {otpError}
                  </div>
                )}

                {resendMsg && (
                  <div className={cn(
                    'mb-4 rounded-lg px-4 py-3 text-sm text-center',
                    resendMsg.includes('sent') || resendMsg.includes('inbox')
                      ? 'border border-green-200 bg-green-50 text-green-700'
                      : 'border border-red-200 bg-red-50 text-red-600'
                  )}>
                    {resendMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={otpLoading || otp.join('').length < 6 || otpTimeLeft === 0}
                  className={submitCls}
                >
                  {otpLoading && <Loader2 size={16} className="animate-spin" />}
                  {otpLoading ? 'Verifying…' : otpTimeLeft === 0 ? 'Code expired — request a new one' : 'Verify & Sign In →'}
                </button>
              </form>

              <div className="mt-5 flex flex-col items-center gap-3 text-sm">
                {/* Resend button */}
                {resendAttemptsLeft <= 0 ? (
                  <p className="text-red-500 text-xs text-center">
                    Maximum resend attempts reached. Please go back and register again.
                  </p>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resendLoading || resendCooldown > 0}
                      className="text-primary-blue hover:underline disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      {resendLoading && <Loader2 size={13} className="animate-spin" />}
                      {resendLoading
                        ? 'Sending…'
                        : resendCooldown > 0
                          ? `Resend in ${fmt(resendCooldown)}`
                          : `Resend code`}
                    </button>
                    <span className="text-text-muted text-xs">
                      ({resendAttemptsLeft} left)
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => { setPendingId(null); setOtp(Array(6).fill('')); setOtpError(''); switchTab('login'); }}
                  className="text-text-muted hover:text-text-secondary hover:underline"
                >
                  ← Back to sign in
                </button>
              </div>
            </div>
          )}

          {/* ── TABS (hidden while verification pending) ── */}
          {!pendingId && <>
          {/* Tab switcher */}
          <div className="mb-8 flex rounded-xl bg-bg-secondary p-1">
            {(['login', 'signup'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
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

          {/* Gradient accent line */}
          <div className="mb-8 h-0.5 w-full rounded-full" style={{ background: 'var(--gradient-cta)' }} />

          {/* ── LOGIN ── */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary" htmlFor="email">
                  Email address
                </label>
                <input id="email" type="email" autoComplete="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputCls} />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-sm font-medium text-text-primary" htmlFor="password">Password</label>
                  <Link href="/forgot-password" className="text-xs text-primary-blue hover:underline">Forgot password?</Link>
                </div>
                <div className="relative">
                  <input id="password" type={showPw ? 'text' : 'password'} autoComplete="current-password"
                    required value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" className={cn(inputCls, 'pr-11')} />
                  <button type="button" onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                    aria-label={showPw ? 'Hide password' : 'Show password'}>
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div role="alert" aria-live="assertive" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              {noAccount && (
                <div role="alert" aria-live="polite" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 space-y-1">
                  <p className="font-semibold">No account found</p>
                  <p className="text-amber-700">
                    There&apos;s no account registered with this email address.{' '}
                    <button
                      type="button"
                      onClick={() => { setNoAccount(false); setError(''); switchTab('signup'); }}
                      className="font-semibold underline underline-offset-2 hover:text-amber-900 transition-colors"
                    >
                      Create an account →
                    </button>
                  </p>
                </div>
              )}

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
          )}

          {/* ── SIGN UP ── */}
          {tab === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary" htmlFor="su-name">
                  Full name <span className="text-red-400">*</span>
                </label>
                <input id="su-name" type="text" autoComplete="name" required value={name}
                  onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" className={inputCls} />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary" htmlFor="su-email">
                  Email address <span className="text-red-400">*</span>
                </label>
                <input id="su-email" type="email" autoComplete="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={inputCls} />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary" htmlFor="su-phone">
                  Phone number <span className="text-xs font-normal text-text-muted">(optional)</span>
                </label>
                <input id="su-phone" type="tel" autoComplete="tel" value={phone}
                  onChange={(e) => setPhone(e.target.value)} placeholder="+1 415 555 0100" className={inputCls} />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary" htmlFor="su-workspace">
                  Workspace name <span className="text-xs font-normal text-text-muted">(optional)</span>
                </label>
                <input id="su-workspace" type="text" autoComplete="organization" value={workspace}
                  onChange={(e) => setWorkspace(e.target.value)} placeholder="Acme Inc" className={inputCls} />
                <p className="mt-1 text-xs text-text-muted">
                  Sets up your billing workspace so you can add credits. You can add this later if you skip it.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary" htmlFor="su-password">
                  Password <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input id="su-password" type={showPw ? 'text' : 'password'} autoComplete="new-password"
                    required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 characters" className={cn(inputCls, 'pr-11')} />
                  <button type="button" onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                    aria-label={showPw ? 'Hide password' : 'Show password'}>
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <PasswordStrength password={password} />
              </div>

              {/* Terms acceptance — previously only on the /signup stub, i.e. not
                  on the form people actually submit. (auth audit: legal) */}
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

              {error && (
                <div role="alert" aria-live="assertive" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !(name && email && isPasswordValid(password) && accepted)}
                className={submitCls}
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? 'Creating account…' : 'Create account →'}
              </button>

              <OAuthDivider />
              <OAuthButtons />

              <p className="text-center text-sm text-text-muted">
                Already have an account?{' '}
                <button type="button" onClick={() => switchTab('login')} className="font-medium text-primary-blue hover:underline">
                  Sign in
                </button>
              </p>
            </form>
          )}
          </>}
        </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
