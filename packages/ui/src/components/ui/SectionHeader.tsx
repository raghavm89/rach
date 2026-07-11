import { cn } from "../../lib/utils";
import { Sparkles } from "lucide-react";

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  centered?: boolean;
  className?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  centered = true,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("mb-14", centered && "text-center", className)}>
      {eyebrow && (
        <span className="inline-flex items-center gap-2 text-[12.5px] font-medium uppercase tracking-[0.05em] text-accent">
          <Sparkles className="h-[14px] w-[14px]" /> {eyebrow}
        </span>
      )}
      <h2 className="mt-[14px] font-display text-[clamp(32px,4vw,52px)] font-extrabold leading-[1.05] tracking-[-0.025em] text-ink">
        {title}
      </h2>
      {subtitle && (
        <p className={cn("mt-[18px] max-w-[540px] text-[17px] text-ink-2", centered && "mx-auto")}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
