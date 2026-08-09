'use client';

import { X } from 'lucide-react';

/**
 * Simple centered modal for the admin dashboard (create org / add user).
 * RachDev design tokens; overlay + card pattern.
 */
export function Modal({
  title, onClose, children, footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-md rounded-2xl border border-neutral-border bg-surface-card shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-border px-5 py-3.5">
          <h3 className="text-sm font-semibold text-dash-heading">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded-lg text-dash-muted hover:bg-surface-hover">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-neutral-border px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/** Labeled field wrapper used inside the modals. */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-medium text-dash-muted">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  'w-full rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading outline-none focus:border-accent';
