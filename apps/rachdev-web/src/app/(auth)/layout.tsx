'use client';

import { AuthSplitLayout } from '@rach/ui/components/layout/AuthSplitLayout';
import { LayoutTemplate, MessageSquare, FlaskConical, Rocket } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthSplitLayout
      eyebrow="RachDev"
      title={
        <>
          Build agents that<br />
          <span className="text-cyan-300">do real work.</span>
        </>
      }
      subtitle="Design, run, and deploy autonomous AI agents. 60+ templates across 15 industries — live in minutes."
      features={[
        { icon: LayoutTemplate, title: '60+ agent templates', desc: 'Production-tested templates across 15 industries, ready to customize.' },
        { icon: MessageSquare, title: 'Configure via chat', desc: "Describe your agent's behavior in plain English — no flowcharts or code." },
        { icon: FlaskConical, title: 'Test in a sandbox', desc: 'Trace every decision in a production-identical sandbox before you ship.' },
        { icon: Rocket, title: 'Deploy with one click', desc: 'Go live on managed infrastructure with zero downtime and instant rollback.' },
      ]}
      quote="We shipped our first support agent in an afternoon. The templates and sandbox made it effortless."
      quoteAuthor="— RachDev Customer"
    >
      {children}
    </AuthSplitLayout>
  );
}
