import Link from "next/link";
import Image from "next/image";
import { cn } from "../../lib/utils";
import { ChevronRight } from "lucide-react";

interface FeatureDetailCardProps {
  name: string;
  slug: string;
  icon: React.ElementType;
  shortDescription: string;
  category: string;
  image?: string;
  className?: string;
}

export function FeatureDetailCard({
  name,
  slug,
  icon: Icon,
  shortDescription,
  image,
  className,
}: FeatureDetailCardProps) {
  return (
    <Link href={`/features/${slug}`} className={cn("group block h-full", className)}>
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-well-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-well">
        {image && (
          <div className="relative h-40 w-full border-b border-line bg-band">
            <Image src={image} alt={name} fill className="object-contain p-4" />
          </div>
        )}
        <div className="flex flex-1 flex-col p-6">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent-weak">
            <Icon className="h-5 w-5 text-accent" strokeWidth={1.8} />
          </div>
          <h3 className="font-display text-lg font-bold tracking-[-0.01em] text-ink transition-colors duration-200 group-hover:text-accent">
            {name}
          </h3>
          <p className="mt-2 flex-1 text-[14.5px] leading-[1.6] text-ink-2">{shortDescription}</p>
          <div className="mt-4 flex items-center text-sm font-medium text-accent opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            Learn more
            <ChevronRight className="ml-1 h-4 w-4" />
          </div>
        </div>
      </div>
    </Link>
  );
}
