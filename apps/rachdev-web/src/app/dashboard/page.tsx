'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { industryModules } from '@/config/dashboard/registry';

/**
 * Dashboard index. `/dashboard` has no content — it routes the user to their
 * primary workspace view based on tenant industry + role, driven by the registry
 * so every industry (healthcare, hr, …) lands correctly with no per-industry code.
 * A tenant_admin on a tenant with no industry goes to Agent Monitor; a user with
 * no workspace at all falls back to Settings.
 */
export default function DashboardIndex() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;

    let dest = '/dashboard/settings';

    if (user.role === 'admin') {
      dest = '/dashboard/orgs';
    } else {
      const industry = user.tenant_industry ?? null;
      const mod = industry ? industryModules[industry] : undefined;
      if (mod) {
        // First module in this industry the user's role can see.
        const first = mod.modules.find((m) => !m.roles || m.roles.includes(user.role)) ?? mod.modules[0];
        dest = first?.href ?? '/dashboard/settings';
      } else if (user.role === 'tenant_admin') {
        dest = '/dashboard/agent-monitor';
      }
    }

    router.replace(dest);
  }, [loading, user, router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center" aria-live="polite">
      <Loader2 size={28} className="animate-spin text-accent" />
    </div>
  );
}
