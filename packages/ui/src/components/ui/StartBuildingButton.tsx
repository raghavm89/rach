'use client';

import { useAuth } from '../../contexts/AuthContext';
import { Button } from './Button';

interface Props {
  variant?: 'dark' | 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  arrow?: boolean;
  className?: string;
  label?: string;
}

// Self-contained CTA for the design system. (The former `useHomeButton` variant
// depended on an app-level home component and was dropped during extraction — if
// an app needs that variant, compose it in the app layer.)
export function StartBuildingButton({
  variant = 'dark',
  size = 'lg',
  className,
  label = 'Start Building →',
}: Props) {
  const { user } = useAuth();
  const href = user ? '/dashboard' : '/signup';

  return (
    <Button
      variant={variant === 'dark' ? 'primary' : (variant as 'primary' | 'secondary')}
      size={size}
      href={href}
      className={className}
    >
      {label}
    </Button>
  );
}
