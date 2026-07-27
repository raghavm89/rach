import Image from "next/image";
import { cn } from "../../lib/utils";
import { Card } from "./Card";

interface TeamCardProps {
  name: string;
  role: string;
  bio: string;
  image?: string;
  company?: string;
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function TeamCard({ name, role, bio, image, className, company = "Rach Dev LLP" }: TeamCardProps) {
  return (
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      {image ? (
        <div className="relative -mx-6 -mt-6 mb-6 aspect-[2/3] overflow-hidden border-b border-line bg-band">
          <Image
            src={image}
            alt={`${name}, ${role} at ${company}`}
            fill
            sizes="(max-width: 768px) 100vw, 384px"
            className="object-cover object-center"
          />
        </div>
      ) : (
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-accent">
          <span className="font-display text-xl font-bold text-white">
            {getInitials(name)}
          </span>
        </div>
      )}
      <h3 className="font-display text-xl font-bold text-ink">{name}</h3>
      <p className="mt-1 text-sm font-medium text-accent">{role}</p>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">{bio}</p>
    </Card>
  );
}
