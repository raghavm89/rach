/**
 * RachBase wordmark — the official logo from /brand/, in a light/dark pair.
 *
 * The real asset finally landed (public/brand/rachbase-logo.png), replacing the inline-SVG
 * placeholder from the go-live audit (H1: the component used to point at a PNG that didn't
 * exist, so every surface rendered a broken image). The wordmark's "rach" is black, so a
 * recolored variant (rachbase-logo-dark.png, generated from the same file) swaps in under
 * Tailwind's class-based dark mode — same dimensions, so no layout shift on theme toggle.
 * Used in the shared Navbar/Footer/auth split via their `logo` prop.
 */
export function BrandLogo({ className = "h-8 w-auto" }: { className?: string } = {}) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, no optimization needed */}
      <img
        src="/brand/rachbase-logo.png"
        alt="RachBase"
        className={`${className} dark:hidden`}
        width={3427}
        height={698}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/rachbase-logo-dark.png"
        alt="RachBase"
        className={`${className} hidden dark:block`}
        width={3427}
        height={698}
      />
    </>
  );
}
