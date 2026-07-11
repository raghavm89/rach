import Link from "next/link";
import { cn } from "../../lib/utils";
import { Card } from "./Card";
import { Badge } from "./Badge";
import { ChevronRight } from "lucide-react";

interface TemplateCardProps {
  name: string;
  slug: string;
  industry: string;
  industrySlug: string;
  description: string;
  capabilities: string[];
  className?: string;
}

export function TemplateCard({
  name,
  slug,
  industry,
  industrySlug,
  description,
  capabilities,
  className,
}: TemplateCardProps) {
  return (
    <Link
      href={`/templates/${industrySlug}/${slug}`}
      className={cn("group block", className)}
    >
      <Card hoverLift className="flex h-full flex-col">
        {/* Industry badge */}
        <Badge variant="accent" className="mb-4 self-start">
          {industry}
        </Badge>

        {/* Name */}
        <h3 className="font-display text-lg font-bold text-ink group-hover:text-accent transition-colors duration-200">
          {name}
        </h3>

        {/* Description - truncated to 2 lines */}
        <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-2 line-clamp-2">
          {description}
        </p>

        {/* Capabilities tags */}
        {capabilities.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {capabilities.slice(0, 3).map((cap) => (
              <span
                key={cap}
                className="inline-block rounded-full bg-row px-2.5 py-1 text-xs font-medium text-ink-2"
              >
                {cap}
              </span>
            ))}
            {capabilities.length > 3 && (
              <span className="inline-block rounded-full bg-row px-2.5 py-1 text-xs font-medium text-ink-2">
                +{capabilities.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Arrow indicator */}
        <div className="mt-4 flex items-center text-sm font-medium text-accent opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          View template
          <ChevronRight className="ml-1 h-4 w-4" />
        </div>
      </Card>
    </Link>
  );
}
