import { cn } from '../../lib/utils';
import { TrendingUp } from "lucide-react";

export function MetricsMockup({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "w-[200px] overflow-hidden rounded-xl border border-neutral-border bg-white p-4 shadow-xl",
        className
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
        API Calls
      </p>
      <p className="mt-1 font-mono text-2xl font-bold text-text-primary">12,847</p>

      {/* Sparkline (CSS) */}
      <div className="mt-3 flex items-end gap-[3px]">
        {[40, 55, 35, 65, 50, 70, 45, 80, 60, 90, 75, 95].map((h, i) => (
          <div
            key={i}
            className="w-[6px] rounded-sm bg-gradient-to-t from-primary-blue to-accent-cyan"
            style={{ height: `${h * 0.3}px` }}
          />
        ))}
      </div>

      {/* Change */}
      <div className="mt-3 flex items-center gap-1">
        <TrendingUp size={12} className="text-green-500" />
        <span className="text-xs font-semibold text-green-500">+12.3%</span>
        <span className="text-[10px] text-text-muted">vs last week</span>
      </div>
    </div>
  );
}
