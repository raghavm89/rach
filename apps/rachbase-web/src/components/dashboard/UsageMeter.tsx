import { cn } from "@rach/ui/lib/utils";

interface UsageMeterProps {
  label: string;
  current: number;
  limit: number;
  unit?: string;
  formatValue?: (value: number) => string;
}

export function UsageMeter({ label, current, limit, unit = "", formatValue }: UsageMeterProps) {
  const percentage = Math.min((current / limit) * 100, 100);
  const fmt = formatValue || ((v: number) => `${v.toLocaleString()}${unit ? ` ${unit}` : ""}`);

  const barColor =
    percentage >= 90
      ? "bg-status-danger"
      : percentage >= 70
        ? "bg-status-warning"
        : "bg-status-info";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-dash-body font-medium">{label}</span>
        <span className="text-dash-muted">
          {fmt(current)} / {fmt(limit)} ({Math.round(percentage)}%)
        </span>
      </div>
      <div className="h-2 bg-neutral-border rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
