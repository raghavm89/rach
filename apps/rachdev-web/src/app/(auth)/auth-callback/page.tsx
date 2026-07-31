'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';

/**
 * OAuth landing page.
 *
 * The backend no longer puts a token or a user profile in this URL — it sets
 * the HttpOnly refresh cookie and redirects here with `?status=ok`. We trade
 * that cookie for an access token via /api/auth/refresh.
 *
 * The previous version called `login(token, user)` from AuthContext, but that
 * signature is `(email, password)` — so it fired a real login request with the
 * JWT as the email, left React state unpopulated, and navigated to the
 * dashboard anyway on the back of a rejected promise.
 */

const ERROR_MESSAGES: Record<string, string> = {
  cancelled:       'Sign-in was cancelled.',
  invalid_state:   'That sign-in link expired or was already used. Please try again.',
  exchange_failed: 'We could not complete sign-in with that provider. Please try again.',
  no_email:        'That account has no verified email address we can use.',
  unverified:      'Your email address is not verified. Verify it first, then try again.',
  server_error:    'Something went wrong during sign-in. Please try again.',
  session_expired: 'Your session expired. Please sign in again.',
};

function AuthCallbackInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { hydrateFromCookie } = useAuth();

  const [error, setError] = useState('');

  // React StrictMode double-invokes effects in dev. Refresh tokens rotate on
  // use, so running this twice would replay a rotated token and trip the reuse
  // detector — revoking the family we just created.
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const errCode = searchParams.get('error');
    if (errCode) {
      setError(ERROR_MESSAGES[errCode] ?? ERROR_MESSAGES.server_error);
      return;
    }

    (async () => {
      const ok = await hydrateFromCookie();
      if (ok) router.replace('/dashboard');
      else setError(ERROR_MESSAGES.server_error);
    })();
  }, [searchParams, router, hydrateFromCookie]);

  if (error) {
    return (
      <div className="rounded-2xl border border-neutral-border bg-white px-8 py-10 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
          <AlertCircle size={28} className="text-red-600" />
        </div>
        <h1 className="mb-2 text-xl font-bold text-text-primary">Sign-in failed</h1>
        <p role="alert" className="mb-6 text-sm text-text-muted">{error}</p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-primary-blue to-primary-purple px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-16" aria-live="polite">
      <Loader2 size={32} className="animate-spin text-primary-blue" />
      <p className="text-sm text-text-muted">Completing sign-in…</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <AuthCallbackInner />
    </Suspense>
  );
}
