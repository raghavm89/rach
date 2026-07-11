import Link from "next/link";
import Image from "next/image";
import { cn } from "../../lib/utils";
import { Badge } from "./Badge";
import { ChevronRight, PlayCircle } from "lucide-react";

interface IndustryCardProps {
  name: string;
  slug: string;
  icon: React.ElementType;
  description: string;
  templateCount: number;
  image?: string;
  hasDemo?: boolean;
  className?: string;
}

export function IndustryCard({
  name,
  slug,
  icon: Icon,
  description,
  templateCount,
  image,
  hasDemo = false,
  className,
}: IndustryCardProps) {
  return (
    <Link href={`/industries/${slug}`} className={cn("group block h-full", className)}>
      <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-well-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-well">
        {hasDemo && (
          <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-ok-line bg-ok-bg px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.04em] text-ok">
            <PlayCircle className="h-3 w-3" /> Live demo
          </span>
        )}
        {image && (
          <div className="relative h-40 w-full border-b border-line bg-band">
            <Image src={image} alt={name} fill className="object-contain p-4" />
          </div>
        )}
        <div className="flex flex-1 flex-col p-6">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent-weak">
            <Icon className="h-5 w-5 text-accent" strokeWidth={1.8} />
          </div>
          <h3 className="font-display text-lg font-bold text-ink transition-colors duration-200 group-hover:text-accent">
            {name}
          </h3>
          <p className="mt-2 flex-1 text-[14.5px] leading-relaxed text-ink-2 line-clamp-2">
            {description}
          </p>
          <div className="mt-4 flex items-center justify-between">
            <Badge className="text-xs">
              {templateCount} template{templateCount !== 1 ? "s" : ""}
            </Badge>
            <ChevronRight className="h-4 w-4 text-ink-3 transition-colors duration-200 group-hover:text-accent" />
          </div>
        </div>
      </div>
    </Link>
  );
}
