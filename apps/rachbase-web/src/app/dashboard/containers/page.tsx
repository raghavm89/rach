'use client';

import { useState } from 'react';
import { Box, Cpu, MemoryStick, HardDrive, Plus, X, GitBranch } from 'lucide-react';
import { cn } from '@rach/ui/lib/utils';

const PLAN = {
  name: 'Standard Container',
  cpu: '0.5 vCPU',
  ram: '1 GB RAM',
  disk: '5 GB SSD',
  price: 15,
};

export default function ContainersPage() {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display text-text-primary">Containers</h2>
          <p className="mt-1 text-sm text-text-muted">
            Lightweight managed compute — deploy stateless apps, services, and workers.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Plus size={16} /> New Container
        </button>
      </div>

      {/* Plan card */}
      <div className="rounded-xl border border-neutral-border bg-surface-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-primary-blue">
              <Box size={22} />
            </div>
            <div>
              <p className="font-semibold text-text-primary">{PLAN.name}</p>
              <p className="text-xs text-text-muted">Billed monthly · cancel anytime</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold font-display text-text-primary">${PLAN.price}</p>
            <p className="text-xs text-text-muted">per container / month</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { icon: <Cpu size={16} />, label: PLAN.cpu },
            { icon: <MemoryStick size={16} />, label: PLAN.ram },
            { icon: <HardDrive size={16} />, label: PLAN.disk },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2 rounded-lg bg-bg-secondary px-3 py-2 text-sm text-text-secondary">
              {s.icon}
              {s.label}
            </div>
          ))}
        </div>
      </div>

      {/* Empty state */}
      <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-border bg-surface-card/50 px-6 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-secondary text-text-muted">
          <Box size={24} />
        </div>
        <p className="mt-4 font-semibold text-text-primary">No containers yet</p>
        <p className="mt-1 max-w-sm text-sm text-text-muted">
          Spin up your first container from a GitHub repository. It provisions in seconds on the
          same infrastructure as your VMs.
        </p>
        <button
          onClick={() => setShowCreate(true)}
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-neutral-border px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-bg-secondary"
        >
          <Plus size={16} /> Create a container
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-md rounded-2xl bg-surface-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-text-primary">New Container</h3>
              <button onClick={() => setShowCreate(false)} className="text-text-muted hover:text-text-primary">
                <X size={18} />
              </button>
            </div>
            <p className="mt-1 text-sm text-text-muted">
              {PLAN.cpu} · {PLAN.ram} · {PLAN.disk} — ${PLAN.price}/mo
            </p>
            <label className="mt-5 block text-sm font-medium text-text-primary">Source</label>
            <button className="mt-2 flex w-full items-center gap-3 rounded-lg border border-neutral-border px-4 py-3 text-left transition-colors hover:bg-bg-secondary">
              <GitBranch size={18} className="text-text-primary" />
              <span className="text-sm font-medium text-text-primary">GitHub Repository</span>
            </button>
            <button
              className={cn(
                'mt-6 w-full rounded-full bg-primary-blue py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700',
              )}
              onClick={() => setShowCreate(false)}
            >
              Deploy container — ${PLAN.price}/mo
            </button>
            <p className="mt-3 text-center text-xs text-text-muted">
              Container provisioning is rolling out — contact us to enable it on your account.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
