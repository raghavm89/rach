import { cn } from "../../lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverLift?: boolean;
  gradientBorder?: boolean;
}

export function Card({
  children,
  className,
  hoverLift = true,
  gradientBorder = false,
}: CardProps) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-line bg-surface p-6 transition-all duration-300",
        hoverLift && "hover:-translate-y-1 hover:shadow-well",
        gradientBorder &&
          "before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:rounded-t-2xl before:bg-accent",
        className
      )}
    >
      {children}
    </div>
  );
}
