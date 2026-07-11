"use client";

import { cn } from "../../lib/utils";
import { Badge } from "./Badge";

interface PricingToggleProps {
  isAnnual: boolean;
  onToggle: (value: boolean) => void;
}

export function PricingToggle({ isAnnual, onToggle }: PricingToggleProps) {
  return (
    <div className="inline-flex items-center rounded-full border border-line bg-band p-1">
      <button
        onClick={() => onToggle(false)}
        className={cn(
          "relative rounded-full px-5 py-2 text-sm font-medium transition-all duration-300",
          !isAnnual
            ? "bg-surface text-ink shadow-sm"
            : "text-ink-3 hover:text-ink-2"
        )}
      >
        Monthly
      </button>
      <button
        onClick={() => onToggle(true)}
        className={cn(
          "relative flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all duration-300",
          isAnnual
            ? "bg-surface text-ink shadow-sm"
            : "text-ink-3 hover:text-ink-2"
        )}
      >
        Annual
        <Badge className="px-2 py-0.5 text-xs">Save 15%</Badge>
      </button>
    </div>
  );
}
