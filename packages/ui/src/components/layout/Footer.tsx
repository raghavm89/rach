import Link from "next/link";
import Image from "next/image";

interface FooterLink { label: string; href: string; }
interface FooterColumn { title: string; links: FooterLink[]; }

export interface FooterProps {
  /** Link columns. Each brand passes its own; defaults to the combined set. */
  columns?: FooterColumn[];
  tagline?: string;
  logoSrc?: string;
  logoAlt?: string;
  /** Custom logo node — overrides the image logo when provided (e.g. a wordmark). */
  logo?: React.ReactNode;
}

const DEFAULT_COLUMNS: FooterColumn[] = [
  {
    title: "Product",
    links: [
      { label: "BaaS Platform", href: "/products/baas" },
      { label: "Agent Builder", href: "/products/agent-builder" },
      { label: "Integrations", href: "/integrations" },
      { label: "Pricing", href: "/pricing" },
      { label: "Features", href: "/features" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "By Industry", href: "/industries" },
      { label: "Templates", href: "/templates" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "Security", href: "/security" },
      { label: "Blog", href: "/blog" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "Contact", href: "/contact" },
      { label: "Legal", href: "/legal/privacy" },
    ],
  },
];

export function Footer({
  columns = DEFAULT_COLUMNS,
  tagline = "Backend + AI Agents. One Platform.",
  logoSrc = "/brand/rach-dev-logo-side.svg",
  logoAlt = "Rach Dev LLP",
  logo,
}: FooterProps = {}) {
  return (
    <footer className="border-t border-line pb-10 pt-16">
      <div className="mx-auto grid max-w-site grid-cols-2 gap-8 px-8 min-[900px]:grid-cols-[1.6fr_1fr_1fr_1fr_1fr]">
        <div className="col-span-2 min-[900px]:col-span-1">
          <Link href="/" className="inline-flex items-center" aria-label={`${logoAlt} home`}>
            {logo ?? (
              <Image
                src={logoSrc}
                alt={logoAlt}
                width={194}
                height={36}
                className="h-9 w-auto"
              />
            )}
          </Link>
          <p className="mt-3 max-w-[240px] text-[14px] text-ink-2">
            {tagline}
          </p>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <h5 className="mb-[14px] text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3">
              {col.title}
            </h5>
            {col.links.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="mb-[10px] block text-[14px] text-ink-2 transition-colors hover:text-ink"
              >
                {l.label}
              </Link>
            ))}
          </div>
        ))}
      </div>

      <div className="mx-auto mt-10 flex max-w-site flex-wrap justify-between gap-3 border-t border-line px-8 pt-[22px] text-[13px] text-ink-3">
        <span>&copy; {new Date().getFullYear()} Rach Dev LLP. All rights reserved.</span>
        <span className="flex flex-wrap gap-x-2">
          <a href="mailto:social@rachdev.com" className="transition-colors hover:text-ink">
            social@rachdev.com
          </a>
          &middot;
          <Link href="/legal/privacy" className="transition-colors hover:text-ink">
            Privacy
          </Link>
          &middot;
          <Link href="/legal/terms" className="transition-colors hover:text-ink">
            Terms
          </Link>
        </span>
      </div>
    </footer>
  );
}