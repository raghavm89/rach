'use client';

import { useMemo } from 'react';
import { cn } from '../../lib/utils';

/**
 * Password policy, mirrored from the server-side validator in
 * packages/identity/src/routes/auth.js. Keep the two in sync — the server is
 * authoritative; this only gives the user feedback before they submit.
 */
export const PASSWORD_MIN_LENGTH = 10;

export interface PasswordRule {
  label: string;
  test: (pw: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { label: `At least ${PASSWORD_MIN_LENGTH} characters`, test: (pw) => pw.length >= PASSWORD_MIN_LENGTH },
  { label: 'Contains a letter',                          test: (pw) => /[a-zA-Z]/.test(pw) },
  { label: 'Contains a number or symbol',                test: (pw) => /[0-9!@#$%^&*(),.?":{}|<>_\-+=[\]\\/~`';]/.test(pw) },
];

export function isPasswordValid(pw: string) {
  return PASSWORD_RULES.every((r) => r.test(pw));
}

const LEVELS = [
  { label: 'Too weak', bar: 'bg-red-400',     text: 'text-red-500' },
  { label: 'Weak',     bar: 'bg-orange-400',  text: 'text-orange-500' },
  { label: 'Good',     bar: 'bg-yellow-400',  text: 'text-yellow-600' },
  { label: 'Strong',   bar: 'bg-emerald-500', text: 'text-emerald-600' },
];

export function PasswordStrength({ password }: { password: string }) {
  const { score, passed } = useMemo(() => {
    const passedRules = PASSWORD_RULES.map((r) => r.test(password));
    const met = passedRules.filter(Boolean).length;
    // Length beyond the minimum earns the top band — length is what actually
    // buys entropy, so reward it rather than demanding more character classes.
    const bonus = password.length >= 16 ? 1 : 0;
    return { score: Math.min(met + bonus, 4), passed: passedRules };
  }, [password]);

  if (!password) return null;

  const level = LEVELS[Math.max(0, score - 1)];

  return (
    <div className="mt-2">
      <div className="flex gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-200',
              i < score ? level.bar : 'bg-neutral-border',
            )}
          />
        ))}
      </div>

      <p className={cn('mt-1.5 text-xs font-medium', level.text)} aria-live="polite">
        {level.label}
      </p>

      <ul className="mt-1.5 space-y-0.5">
        {PASSWORD_RULES.map((rule, i) => (
          <li
            key={rule.label}
            className={cn('flex items-center gap-1.5 text-xs', passed[i] ? 'text-emerald-600' : 'text-text-muted')}
          >
            <span aria-hidden="true">{passed[i] ? '✓' : '○'}</span>
            {rule.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PasswordStrength;
