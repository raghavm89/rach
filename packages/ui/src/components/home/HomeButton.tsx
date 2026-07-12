import { cn } from '../../lib/utils';

type Variant = "primary" | "dark" | "ghost";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-white hover:-translate-y-px hover:shadow-[0_8px_20px_-8px_rgba(37,99,235,0.5)]",
  dark: "bg-ink text-white hover:-translate-y-px hover:shadow-[0_8px_20px_-8px_rgba(11,11,12,0.5)]",
  ghost: "bg-surface text-ink border-line-2 hover:border-ink-3",
};

export function HomeButton({
  children,
  variant = "primary",
  href = "#",
  arrow = false,
  className,
}: {
  children: React.ReactNode;
  variant?: Variant;
  href?: string;
  arrow?: boolean;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={cn(
        "group inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-transparent px-[18px] py-[10px] text-[14.5px] font-medium transition-all duration-200",
        variants[variant],
        className,
      )}
    >
      {children}
      {arrow && (
        <span className="transition-transform duration-200 group-hover:translate-x-[3px]">
          &#8594;
        </span>
      )}
    </a>
  );
}
