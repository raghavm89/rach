import Link from "next/link";
import { cn } from "../../lib/utils";

interface TOCItem {
  label: string;
  href: string;
  active?: boolean;
}

interface TOCSidebarProps {
  items: TOCItem[];
  className?: string;
}

export function TOCSidebar({ items, className }: TOCSidebarProps) {
  return (
    <nav
      className={cn("sticky top-24", className)}
      aria-label="Table of contents"
    >
      <p className="mb-4 text-xs font-bold uppercase tracking-wider text-text-muted">
        On this page
      </p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={cn(
                "block border-l-2 py-1.5 pl-4 text-sm transition-colors duration-200",
                item.active
                  ? "border-primary-blue font-semibold text-primary-blue"
                  : "border-transparent text-text-secondary hover:border-neutral-border hover:text-text-primary"
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
