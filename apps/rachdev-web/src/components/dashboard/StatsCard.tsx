import { cn } from '@rach/ui/lib/utils';

/**
 * Stat card — mirrors RachBase's dashboard StatsCard look (shared design tokens).
 */
export function StatsCard({
  label,
  value,
  icon: Icon,
  accent,
  className,
}: {
  label: string;
  value: string | number;
  icon?: React.ElementType;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('rounded-xl border border-neutral-border bg-surface-card p-5', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-2xl font-semibold font-display text-dash-heading">{value}</p>
          <p className="mt-0.5 text-xs text-dash-muted">{label}</p>
        </div>
        {Icon && (
          <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', accent ? 'bg-accent-weak text-accent' : 'bg-surface-hover text-dash-muted')}>
            <Icon size={16} />
          </span>
        )}
      </div>
    </div>
  );
}
