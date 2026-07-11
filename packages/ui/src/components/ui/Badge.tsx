import { cn } from "../../lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "accent";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  const variants = {
    default: "border border-accent-line bg-accent-weak text-accent",
    accent: "border border-accent-line bg-accent-weak text-accent",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
