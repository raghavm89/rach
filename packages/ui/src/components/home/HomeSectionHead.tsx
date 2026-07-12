import { Sparkles } from "lucide-react";

export function HomeSectionHead({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="text-center">
      <span className="inline-flex items-center gap-2 text-[12.5px] font-medium uppercase tracking-[0.05em] text-accent">
        <Sparkles className="h-[14px] w-[14px]" /> {eyebrow}
      </span>
      <h2 className="mt-[14px] font-display text-[clamp(32px,4vw,52px)] font-extrabold leading-none tracking-[-0.025em]">
        {title}
      </h2>
      {sub && (
        <p className="mx-auto mt-[18px] max-w-[540px] text-[17px] text-ink-2">{sub}</p>
      )}
    </div>
  );
}
