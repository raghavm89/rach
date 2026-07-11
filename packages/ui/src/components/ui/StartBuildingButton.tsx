'use client';

import { useAuth } from '@/contexts/AuthContext';
import { HomeButton } from '@/components/home/HomeButton';
import { Button } from '@/components/ui/Button';

interface Props {
  variant?: 'dark' | 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  arrow?: boolean;
  className?: string;
  useHomeButton?: boolean;
  label?: string;
}

export function StartBuildingButton({
  variant = 'dark',
  size = 'lg',
  arrow = true,
  className,
  useHomeButton = false,
  label = 'Start Building →',
}: Props) {
  const { user } = useAuth();
  const href = user ? '/dashboard' : '/signup';

  if (useHomeButton) {
    return (
      <HomeButton variant={variant as 'dark' | 'primary' | 'ghost'} href={href} arrow={arrow} className={className}>
        {label.replace(' →', '')}
      </HomeButton>
    );
  }

  return (
    <Button variant={variant === 'dark' ? 'primary' : variant as 'primary' | 'secondary'} size={size} href={href} className={className}>
      {label}
    </Button>
  );
}
