import { cn } from "@rach/ui/lib/utils";
import { ArrowUp, ArrowDown } from "lucide-react";

interface StatsCardProps {
  label: string;
  value: string;
  trend?: { value: number; label: string };
  icon?: React.ElementType;
  className?: string;
}

export function StatsCard({ label, value, trend, icon: Icon, className }: StatsCardProps) {
  const isPositive = trend && trend.value >= 0;

  return (
    <div className={cn("bg-white rounded-lg border border-neutral-border p-6", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-dash-muted">{label}</p>
          <p className="text-3xl font-semibold text-dash-heading mt-1 font-display">{value}</p>
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              {isPositive ? (
                <ArrowUp className="w-3.5 h-3.5 text-status-success" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5 text-status-danger" />
              )}
              <span
                className={cn(
                  "text-xs font-medium",
                  isPositive ? "text-status-success" : "text-status-danger"
                )}
              >
                {Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-dash-muted">{trend.label}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className="p-2 rounded-lg bg-primary-blue/10">
            <Icon className="w-5 h-5 text-primary-blue" />
          </div>
        )}
      </div>
    </div>
  );
}
