import { cn } from "../../lib/utils";

interface SectionWrapperProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
  dotPattern?: boolean;
  dark?: boolean;
  band?: boolean;
}

export function SectionWrapper({
  children,
  className,
  id,
  dotPattern = false,
  dark = false,
  band = false,
}: SectionWrapperProps) {
  return (
    <section
      id={id}
      className={cn(
        "py-20 lg:py-28",
        dark && "bg-ink text-white",
        band && !dark && "bg-band",
        dotPattern && "dot-pattern",
        className
      )}
    >
      <div className="mx-auto max-w-site px-8">{children}</div>
    </section>
  );
}
