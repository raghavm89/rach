import { cn } from '@rach/ui/lib/utils';
import { ICONS, type IconKey } from "@/lib/industries/icons";

export type PillTone = "live" | "muted" | "accent" | "active" | "ok" | "amber";

const TONES: Record<PillTone, string> = {
  live: "border-ok-line bg-ok-bg text-ok",
  ok: "border-ok-line bg-ok-bg text-ok",
  amber: "border-wait-line bg-wait-bg text-wait",
  accent: "border-accent-line bg-accent-weak text-accent",
  active: "border-accent-line bg-accent-weak text-accent",
  muted: "border-line-2 bg-row text-ink-3",
};

const DOTS: Record<PillTone, string> = {
  live: "bg-ok",
  ok: "bg-ok",
  amber: "bg-wait",
  accent: "bg-accent",
  active: "bg-accent",
  muted: "bg-ink-3",
};

/**
 * Small status pill used across the demo (domain tags + control-tower / relay
 * states). Pure presentational — safe in both server and client components.
 */
export function StatusPill({
  tone = "muted",
  dot = false,
  pulse = false,
  icon,
  children,
  className,
}: {
  tone?: PillTone;
  dot?: boolean;
  pulse?: boolean;
  icon?: IconKey;
  children: React.ReactNode;
  className?: string;
}) {
  const Icon = icon ? ICONS[icon] : null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.05em]",
        TONES[tone],
        className,
      )}
    >
      {dot && (
        <span className={cn("h-[6px] w-[6px] rounded-full", DOTS[tone], pulse && "motion-safe:animate-pulse2")} />
      )}
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  );
}
