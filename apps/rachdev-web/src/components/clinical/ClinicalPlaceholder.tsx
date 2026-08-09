/**
 * Placeholder shell for the healthcare workspace views.
 *
 * Sprint 1 stands up the authenticated area + nav (the "one product" seam). The
 * POC agents (Naina, Asha, Kiran) fill these shells in Sprint 2–3. This keeps the
 * routes real and navigable in the meantime.
 */
export interface ClinicalPlaceholderProps {
  title: string;
  agent: string;
  sprint: string;
  description: string;
}

export function ClinicalPlaceholder({
  title,
  agent,
  sprint,
  description,
}: ClinicalPlaceholderProps) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-neutral-border bg-surface-card p-8">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold text-dash-heading">{title}</h2>
          <span className="inline-flex items-center rounded-full bg-accent-weak px-2.5 py-0.5 text-xs font-semibold text-accent">
            {agent}
          </span>
          <span className="inline-flex items-center rounded-full bg-surface-hover px-2.5 py-0.5 text-xs font-medium text-dash-body">
            {sprint}
          </span>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-dash-body">{description}</p>

        <div className="mt-6 rounded-xl border border-dashed border-neutral-border bg-surface-hover/60 px-4 py-6 text-center">
          <p className="text-sm font-medium text-dash-heading">
            Workspace scaffolded — implementation lands in {sprint}.
          </p>
          <p className="mt-1 text-xs text-dash-muted">
            Route, nav and RBAC are live; the agent flow plugs in here.
          </p>
        </div>
      </div>
    </div>
  );
}
