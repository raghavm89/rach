import Image from "next/image";

/**
 * RachBase wordmark — the official bolt logo (blue mark + "Rach" in ink, "base"
 * in accent). Used in the shared Navbar/Footer/auth split via their `logo` prop.
 * The PNG has a transparent background and dark "Rach" text, so it is intended
 * for light surfaces (all current placements are white).
 *
 * Source aspect ratio ≈ 3427×698 (~4.91:1).
 */
export function BrandLogo({ className = "h-8 w-auto" }: { className?: string } = {}) {
  return (
    <Image
      src="/brand/rachbase-logo.png"
      alt="RachBase"
      width={3427}
      height={698}
      priority
      className={className}
    />
  );
}
