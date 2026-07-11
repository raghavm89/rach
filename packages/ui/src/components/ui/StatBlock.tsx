import { cn } from "../../lib/utils";

interface StatBlockProps {
  value: string;
  label: string;
  className?: string;
}

export function StatBlock({ value, label, className }: StatBlockProps) {
  return (
    <div className={cn("text-center", className)}>
      <p className="font-display text-5xl font-extrabold tracking-[-0.02em] lg:text-6xl">
        {value}
      </p>
      <p className="mt-2 text-sm font-medium opacity-70">{label}</p>
    </div>
  );
}
