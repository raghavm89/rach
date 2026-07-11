import Link from "next/link";
import { cn } from "../../lib/utils";
import { Card } from "./Card";
import { Badge } from "./Badge";

interface BlogPostCardProps {
  title: string;
  slug: string;
  excerpt: string;
  date: string;
  author: string;
  tags?: string[];
  className?: string;
}

export function BlogPostCard({
  title,
  slug,
  excerpt,
  date,
  author,
  tags,
  className,
}: BlogPostCardProps) {
  return (
    <Link href={`/blog/${slug}`} className={cn("group block", className)}>
      <Card hoverLift className="flex h-full flex-col overflow-hidden p-0">
        {/* Placeholder image area */}
        <div className="h-48 w-full bg-gradient-to-br from-primary-blue/10 via-primary-purple/10 to-accent-cyan/10" />

        {/* Content */}
        <div className="flex flex-1 flex-col p-6">
          {/* Title */}
          <h3 className="font-display text-lg font-bold leading-snug text-text-primary group-hover:text-primary-blue transition-colors duration-200 line-clamp-2">
            {title}
          </h3>

          {/* Excerpt - truncated to 2 lines */}
          <p className="mt-2 flex-1 text-sm leading-relaxed text-text-secondary line-clamp-2">
            {excerpt}
          </p>

          {/* Tags */}
          {tags && tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  className="px-2.5 py-0.5 text-xs"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Date & Author */}
          <div className="mt-4 flex items-center gap-2 text-xs text-text-muted">
            <time dateTime={date}>
              {new Date(date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </time>
            <span>&middot;</span>
            <span>{author}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
