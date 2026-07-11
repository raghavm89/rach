import { cn } from "../../lib/utils";

interface Stat {
  value: string;
  label: string;
}

interface StatsRowProps {
  stats: Stat[];
  className?: string;
}

export function StatsRow({ stats, className }: StatsRowProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-y-4",
        className
      )}
    >
      {stats.map((stat, index) => (
        <div key={index} className="flex items-center">
          {index > 0 && (
            <div className="mx-6 h-10 w-px bg-neutral-border lg:mx-8" />
          )}
          <div className="text-center">
            <p className="font-mono text-xl font-bold text-text-primary">
              {stat.value}
            </p>
            <p className="mt-0.5 text-xs text-text-muted">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
