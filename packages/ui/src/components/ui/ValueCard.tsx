import { cn } from "../../lib/utils";
import { Card } from "./Card";

interface ValueCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  className?: string;
}

export function ValueCard({ icon: Icon, title, description, className }: ValueCardProps) {
  return (
    <Card className={cn(className)}>
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent-weak">
        <Icon className="h-5 w-5 text-accent" />
      </div>
      <h3 className="mt-4 font-display text-lg font-bold text-ink">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        {description}
      </p>
    </Card>
  );
}
