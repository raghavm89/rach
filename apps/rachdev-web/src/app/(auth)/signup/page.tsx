"use client";

import Link from "next/link";

// Backend port (8080), matching the shared api client — not the frontend's own
// port. (auth audit #25)
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

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

export default function SignupPage() {
  return (
    <>
      <div className="rounded-2xl border border-neutral-border bg-white p-8 shadow-sm space-y-5">
          <div className="text-center">
            <h1 className="text-xl font-bold font-display text-text-primary">Create your account</h1>
            <p className="mt-1 text-sm text-text-muted">Start building in under 90 seconds</p>
          </div>

          {/* OAuth */}
          <OAuthButtons />

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-neutral-border" />
            <span className="text-xs text-text-muted">or sign up with email</span>
            <div className="flex-1 border-t border-neutral-border" />
          </div>

          {/* Email signup CTA → login page signup tab */}
          <Link
            href="/login?tab=signup"
            className="flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-primary-blue to-primary-purple py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Sign up with Email →
          </Link>

          <p className="text-center text-sm text-text-muted">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-primary-blue hover:underline">
              Sign in
            </Link>
          </p>
        </div>

      <p className="mt-4 text-center text-xs text-text-muted">
        By signing up you agree to our{' '}
        <Link href="/legal/terms" className="hover:underline">Terms</Link>
        {' '}and{' '}
        <Link href="/legal/privacy" className="hover:underline">Privacy Policy</Link>.
      </p>
    </>
  );
}
