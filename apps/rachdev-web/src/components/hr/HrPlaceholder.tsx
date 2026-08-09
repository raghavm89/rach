import { PageHeader } from '@/components/dashboard/PageHeader';

/**
 * Placeholder for HR modules not yet ported from HR Layers. Keeps the sidebar
 * complete (Dashboard + Approvals are the two live screens in this pass).
 */
export function HrPlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={title} subtitle={description} />
      <div className="mt-6 rounded-2xl border border-dashed border-neutral-border bg-surface-card px-6 py-12 text-center">
        <p className="text-sm font-medium text-dash-heading">Coming to this workspace</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-dash-muted">
          This HR module is next up to port from HR Layers. The Dashboard and Approvals screens are live now.
        </p>
      </div>
    </div>
  );
}
