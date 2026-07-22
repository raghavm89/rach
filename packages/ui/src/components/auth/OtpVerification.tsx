'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mail, Loader2 } from 'lucide-react';
import { auth, AuthApiError, User } from '../../lib/api';
import { cn } from '../../lib/utils';

/**
 * Email OTP verification screen.
 *
 * Extracted from login/page.tsx, which carried login, signup and this screen in
 * one 529-line component with ~20 useState calls.
 *
 * Resend limits are driven entirely by the server response
 * (`resends_remaining`, `retry_after`, `expires_at`) rather than by constants
 * duplicated on the client, which could — and did — drift from the backend's.
 */

const OTP_LENGTH = 6;

export interface OtpVerificationProps {
  pendingId: number;
  email: string;
  /** ISO timestamp from the register/resend response. */
  expiresAt?: string;
  /** Server-reported resends left; falls back to the server's max on first render. */
  initialResendsRemaining?: number;
  onVerified: (token: string, user: User, expiresIn?: number) => void;
  onBack: () => void;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function OtpVerification({
  pendingId,
  email,
  expiresAt,
  initialResendsRemaining,
  onVerified,
  onBack,
}: OtpVerificationProps) {
  const [otp, setOtp]                 = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [error, setError]             = useState('');
  const [locked, setLocked]           = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [loading, setLoading]         = useState(false);

  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg]         = useState('');
  const [resendsLeft, setResendsLeft]     = useState<number | null>(initialResendsRemaining ?? null);

  const [expiryAt, setExpiryAt]           = useState<number | null>(
    expiresAt ? new Date(expiresAt).getTime() : null,
  );
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(Date.now() + 60_000);

  const [timeLeft, setTimeLeft] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      if (expiryAt)      setTimeLeft(Math.max(0, Math.floor((expiryAt - now) / 1000)));
      if (cooldownUntil) setCooldown(Math.max(0, Math.ceil((cooldownUntil - now) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiryAt, cooldownUntil]);

  useEffect(() => { refs.current[0]?.focus(); }, []);

  const handleChange = useCallback((index: number, value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length > 1) {
      // Paste — spread the digits across the boxes from here on.
      const digits = cleaned.slice(0, OTP_LENGTH).split('');
      setOtp((prev) => {
        const next = [...prev];
        digits.forEach((d, i) => { if (index + i < OTP_LENGTH) next[index + i] = d; });
        return next;
      });
      refs.current[Math.min(index + digits.length, OTP_LENGTH - 1)]?.focus();
    } else {
      setOtp((prev) => { const next = [...prev]; next[index] = cleaned; return next; });
      if (cleaned && index < OTP_LENGTH - 1) refs.current[index + 1]?.focus();
    }
    setError('');
  }, []);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) refs.current[index - 1]?.focus();
    if (e.key === 'ArrowLeft'  && index > 0)               refs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1)  refs.current[index + 1]?.focus();
  }, [otp]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < OTP_LENGTH) { setError('Please enter the full 6-digit code.'); return; }

    setLoading(true);
    setError('');
    try {
      const { access_token, user, expires_in } = await auth.verifyEmailOtp(pendingId, code);
      onVerified(access_token, user, expires_in);
    } catch (err) {
      const e2 = err as AuthApiError;
      setError(e2.message || 'Invalid code. Please try again.');
      if (typeof e2.attempts_left === 'number') setAttemptsLeft(e2.attempts_left);
      if (e2.locked) setLocked(true);
      setOtp(Array(OTP_LENGTH).fill(''));
      refs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }, [pendingId, otp, onVerified]);

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || resendsLeft === 0) return;
    setResendLoading(true);
    setResendMsg('');
    setError('');
    setOtp(Array(OTP_LENGTH).fill(''));
    try {
      const result = await auth.resendVerification(pendingId);
      setExpiryAt(new Date(result.expires_at).getTime());
      setCooldownUntil(Date.now() + 60_000);
      setResendsLeft(result.resends_remaining);
      setLocked(false);
      setAttemptsLeft(null);
      setResendMsg(
        result.email_sent
          ? 'New code sent — check your inbox.'
          : 'Code regenerated, but the email failed to send. Try again shortly.',
      );
      refs.current[0]?.focus();
    } catch (err) {
      const e2 = err as AuthApiError;
      if (typeof e2.resends_remaining === 'number') setResendsLeft(e2.resends_remaining);
      setResendMsg(e2.message || 'Failed to resend. Please try again.');
    } finally {
      setResendLoading(false);
    }
  }, [pendingId, cooldown, resendsLeft]);

  const expired  = expiryAt !== null && timeLeft === 0;
  const disabled = loading || locked || expired || otp.join('').length < OTP_LENGTH;

  return (
    <div className="flex flex-col items-center py-2">
      <div
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
        style={{ background: 'linear-gradient(135deg,#eff6ff,#f5f3ff)' }}
      >
        <Mail size={28} style={{ color: '#2563eb' }} aria-hidden="true" />
      </div>

      <h2 className="mb-1 text-xl font-bold text-text-primary">Check your email</h2>
      <p className="mb-3 text-center text-sm leading-relaxed text-text-muted">
        We sent a 6-digit code to <strong className="text-text-primary">{email}</strong>.
        <br />Enter it below to activate your account.
      </p>

      {expiryAt !== null && (
        <div
          className={cn(
            'mb-5 text-sm font-medium',
            expired ? 'text-red-500' : timeLeft < 120 ? 'text-orange-500' : 'text-text-muted',
          )}
          aria-live="polite"
        >
          {expired ? 'Code expired' : `Expires in ${fmt(timeLeft)}`}
        </div>
      )}

      <form onSubmit={handleSubmit} className="w-full">
        <div className="mb-5 flex justify-center gap-2">
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { refs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={OTP_LENGTH}
              value={digit}
              disabled={locked || expired}
              aria-label={`Digit ${i + 1} of ${OTP_LENGTH}`}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onFocus={(e) => e.target.select()}
              className={cn(
                'h-14 w-11 rounded-xl border-2 text-center font-mono text-xl font-bold text-text-primary',
                'outline-none transition-all duration-150',
                digit ? 'border-primary-blue bg-blue-50' : 'border-neutral-border bg-white',
                'focus:border-primary-blue focus:ring-2 focus:ring-blue-500/20',
                'disabled:cursor-not-allowed disabled:opacity-50',
                error && !digit ? 'border-red-300' : '',
              )}
            />
          ))}
        </div>

        {/* aria-live so screen readers announce failures, which the original
            markup never did. */}
        <div aria-live="assertive">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-600">
              {error}
              {attemptsLeft !== null && attemptsLeft > 0 && (
                <span className="mt-1 block text-xs text-red-500">
                  {attemptsLeft} {attemptsLeft === 1 ? 'attempt' : 'attempts'} remaining
                </span>
              )}
            </div>
          )}
        </div>

        <div aria-live="polite">
          {resendMsg && (
            <div
              className={cn(
                'mb-4 rounded-lg px-4 py-3 text-center text-sm',
                resendMsg.includes('sent')
                  ? 'border border-green-200 bg-green-50 text-green-700'
                  : 'border border-red-200 bg-red-50 text-red-600',
              )}
            >
              {resendMsg}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={disabled}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold text-white',
            'bg-gradient-to-r from-primary-blue to-primary-purple shadow-md transition-all duration-200',
            'hover:opacity-90 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? 'Verifying…'
            : locked ? 'Locked — request a new code'
            : expired ? 'Code expired — request a new one'
            : 'Verify & Sign In →'}
        </button>
      </form>

      <div className="mt-5 flex flex-col items-center gap-3 text-sm">
        {resendsLeft === 0 ? (
          <p className="text-center text-xs text-red-500">
            Maximum resend attempts reached. Please start over.
          </p>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendLoading || cooldown > 0}
              className="flex items-center gap-1 text-primary-blue hover:underline disabled:cursor-not-allowed disabled:opacity-40"
            >
              {resendLoading && <Loader2 size={13} className="animate-spin" />}
              {resendLoading ? 'Sending…' : cooldown > 0 ? `Resend in ${fmt(cooldown)}` : 'Resend code'}
            </button>
            {resendsLeft !== null && (
              <span className="text-xs text-text-muted">({resendsLeft} left)</span>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onBack}
          className="text-text-muted hover:text-text-secondary hover:underline"
        >
          ← Back to sign in
        </button>
      </div>
    </div>
  );
}

export default OtpVerification;
