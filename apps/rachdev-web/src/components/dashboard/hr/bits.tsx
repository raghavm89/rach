'use client';

/**
 * Shared building blocks for the HR workspace screens (Layers 2–4).
 * RachDev design-system styling; keeps the individual screens lean.
 */
import { useState } from 'react';
import { Sparkles, Check, Loader2, Star } from 'lucide-react';

/** A soft status pill. Pass a tailwind class pair for colour. */
export function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${className ?? 'bg-surface-hover text-dash-muted'}`}>
      {children}
    </span>
  );
}

/** Mono business-id chip (REQ-1024, EMP-1007 …). */
export function IdChip({ id }: { id: string }) {
  return <span className="font-mono text-[11px] text-dash-muted">{id}</span>;
}

/**
 * AI Draft Card — the recurring "human approves AI output" surface. Shows the
 * draft body, a draft/approved state, and an optional approve action.
 */
export function DraftCard({
  title = 'AI draft', body, approved, approvedByName, onApprove, busy, footnote,
}: {
  title?: string; body: string; approved?: boolean; approvedByName?: string;
  onApprove?: () => void; busy?: boolean; footnote?: string;
}) {
  return (
    <div className="rounded-xl border border-accent/30 bg-accent-weak/40 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-accent">
          <Sparkles size={13} /> {title}
        </span>
        {approved
          ? <Pill className="bg-ok-bg text-ok"><Check size={11} className="mr-1" /> Approved{approvedByName ? ` · ${approvedByName}` : ''}</Pill>
          : <Pill className="bg-amber-50 text-amber-600">Draft — awaiting approval</Pill>}
      </div>
      <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-dash-body">{body}</pre>
      {footnote && <p className="mt-2 text-[11px] italic text-dash-muted">{footnote}</p>}
      {!approved && onApprove && (
        <button onClick={onApprove} disabled={busy}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Approve
        </button>
      )}
    </div>
  );
}

/** Read-only star rating (1–5). */
export function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={13} className={n <= value ? 'fill-amber-400 text-amber-400' : 'text-neutral-border'} />
      ))}
    </span>
  );
}

/** Interactive star input. */
export function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <span className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => onChange(n)}
          className="p-0.5" aria-label={`${n} star${n > 1 ? 's' : ''}`}>
          <Star size={20} className={n <= (hover || value) ? 'fill-amber-400 text-amber-400' : 'text-neutral-border'} />
        </button>
      ))}
    </span>
  );
}

export const CARD = 'rounded-2xl border border-neutral-border bg-surface-card';
export const INPUT = 'w-full rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-body focus:border-accent focus:outline-none';
export const BTN = 'inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50';
export const BTN_GHOST = 'inline-flex items-center gap-2 rounded-lg border border-neutral-border bg-surface-card px-4 py-2 text-sm font-medium text-dash-muted hover:bg-surface-hover disabled:opacity-50';
