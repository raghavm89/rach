/**
 * Page header — title + optional subtitle and right-aligned actions.
 * Mirrors the RachBase dashboard page-header look.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-2xl font-bold font-display text-dash-heading">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-dash-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
