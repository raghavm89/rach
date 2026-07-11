import { cn } from "../../lib/utils";

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
}

export function GradientText({ children, className }: GradientTextProps) {
  return (
    <span
      className={cn(
        "inline-block bg-gradient-to-r from-primary-blue via-primary-purple to-accent-cyan bg-clip-text text-transparent",
        className
      )}
    >
      {children}
    </span>
  );
}
