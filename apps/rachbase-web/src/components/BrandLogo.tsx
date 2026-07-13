import { Database } from "lucide-react";

/**
 * RachBase wordmark — used in the shared Navbar/Footer via their `logo` prop,
 * so RachBase shows its own brand instead of the default Rach Dev image logo.
 */
export function BrandLogo() {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-white">
        <Database className="h-[17px] w-[17px]" />
      </span>
      <span className="font-display text-[19px] font-extrabold tracking-[-0.02em] text-ink">
        Rach<span className="text-accent">Base</span>
      </span>
    </span>
  );
}
