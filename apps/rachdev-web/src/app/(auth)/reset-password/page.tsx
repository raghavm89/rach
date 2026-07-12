'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { KeyRound, Eye, EyeOff, CheckCircle2, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { auth } from '@rach/ui/lib/api';

function ResetPasswordForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get('token') || '';

  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [showCf, setShowCf]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [success, setSuccess]     = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    if (!token) {
      setError('No reset token found. Please request a new password reset link.');
    }
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await auth.resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch (err) {
      setError((err as Error).message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputCls = 'w-full rounded-lg border border-neutral-border bg-white py-2.5 pl-9 pr-10 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-colors';

  return (
    <>
      <div className="rounded-2xl border border-neutral-border bg-white p-8 shadow-sm">

          {success ? (
            /* ── Success ── */
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
                <CheckCircle2 size={28} className="text-emerald-600" />
              </div>
              <h1 className="text-xl font-bold font-display text-text-primary mb-2">Password updated!</h1>
              <p className="text-sm text-text-muted mb-1">
                Your password has been reset successfully.
              </p>
              <p className="text-sm text-text-muted">
                Redirecting you to login…
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-xl font-bold font-display text-text-primary mb-1">Set new password</h1>
                <p className="text-sm text-text-muted">Choose a strong password for your account.</p>
              </div>

              {error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {!token ? (
                <div className="text-center">
                  <Link
                    href="/forgot-password"
                    className="inline-flex items-center gap-1.5 text-sm text-primary-blue hover:underline"
                  >
                    Request a new reset link
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* New password */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-text-primary" htmlFor="password">
                      New password
                    </label>
                    <div className="relative">
                      <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                      <input
                        id="password"
                        type={showPw ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        required
                        autoFocus
                        className={inputCls}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                      >
                        {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm password */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-text-primary" htmlFor="confirm">
                      Confirm password
                    </label>
                    <div className="relative">
                      <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                      <input
                        id="confirm"
                        type={showCf ? 'text' : 'password'}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Repeat your password"
                        required
                        className={inputCls}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCf(!showCf)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                      >
                        {showCf ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {confirm && password !== confirm && (
                      <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !password || !confirm}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary-blue to-primary-purple py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                    {loading ? 'Updating…' : 'Reset password'}
                  </button>
                </form>
              )}
            </>
          )}

        </div>

      <div className="mt-6 text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={14} />
          Back to login
        </Link>
      </div>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
