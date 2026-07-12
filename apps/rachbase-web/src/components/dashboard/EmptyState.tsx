import { cn } from "@rach/ui/lib/utils";

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-4 text-center", className)}>
      <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-dash-muted" />
      </div>
      <h3 className="text-base font-semibold text-dash-heading">{title}</h3>
      <p className="text-sm text-dash-muted mt-1 max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
