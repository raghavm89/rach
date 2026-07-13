'use client';

import { AuthSplitLayout } from '@rach/ui/components/layout/AuthSplitLayout';
import { Database, Server, Zap, Shield } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthSplitLayout
      logo={<BrandLogo />}
      eyebrow="RachBase"
      title={
        <>
          Your backend,<br />
          <span className="text-cyan-300">managed.</span>
        </>
      }
      subtitle="Provision VMs and containers, deploy from GitHub, and monitor in real time — all from one dashboard."
      features={[
        { icon: Database, title: 'Managed PostgreSQL', desc: 'Dedicated databases with automated backups, PITR, and zero noisy neighbours.' },
        { icon: Server, title: 'VMs & Containers', desc: 'Provision dedicated compute with full resource isolation — no noisy neighbours.' },
        { icon: Zap, title: 'Deploy from GitHub', desc: 'Webhook-driven pipelines with secure SSH command execution.' },
        { icon: Shield, title: 'Enterprise-grade security', desc: 'Anti-DDoS, CIS audits, and security patching included in every plan.' },
      ]}
      quote="From zero to a live backend in minutes. The dashboard, the support, the pricing — everything just works."
      quoteAuthor="— RachBase Customer"
    >
      {children}
    </AuthSplitLayout>
  );
}
