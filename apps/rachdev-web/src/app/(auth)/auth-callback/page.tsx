'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';

const TOKEN_KEY = 'rd_access_token';
const USER_KEY  = 'rd_user';

function AuthCallbackInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { login }    = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const userRaw = searchParams.get('user');
    const error = searchParams.get('error');

    if (error) {
      router.replace(`/login?error=${encodeURIComponent(error)}`);
      return;
    }

    if (!token || !userRaw) {
      router.replace('/login?error=OAuth+sign-in+failed');
      return;
    }

    try {
      const user = JSON.parse(decodeURIComponent(userRaw));
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      // Use login from AuthContext to sync state
      login(token, user);
      router.replace('/dashboard');
    } catch {
      router.replace('/login?error=Failed+to+complete+sign-in');
    }
  }, [searchParams, router, login]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-secondary">
      <div className="flex flex-col items-center gap-4">
        <Loader2 size={32} className="animate-spin text-primary-blue" />
        <p className="text-sm text-text-muted">Completing sign-in…</p>
      </div>
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
