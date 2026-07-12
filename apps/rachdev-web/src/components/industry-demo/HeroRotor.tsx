"use client";

import { useEffect, useState } from "react";
import { cn } from '@rach/ui/lib/utils';

/** The rotating hero phrase. Mirrors the home Hero's 2200ms cycle + reduced-motion guard. */
export function HeroRotor({ lead, words }: { lead: string; words: string[] }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setI((p) => (p + 1) % words.length), 2200);
    return () => clearInterval(id);
  }, [words.length]);

  return (
    <p className="mt-5 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 text-[clamp(17px,2.4vw,22px)] font-bold text-ink-2">
      <span>{lead}</span>
      <span className="relative inline-grid text-left">
        {words.map((w, k) => (
          <span
            key={w}
            aria-hidden={k !== i}
            className={cn(
              "col-start-1 row-start-1 bg-gradient-to-r from-primary-blue to-accent bg-clip-text font-extrabold text-transparent transition-all duration-500",
              k === i ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
            )}
          >
            {w}
          </span>
        ))}
      </span>
    </p>
  );
}
