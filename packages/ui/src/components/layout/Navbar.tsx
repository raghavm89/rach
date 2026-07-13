"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, ChevronDown } from "lucide-react";
import { cn } from '../../lib/utils';
import { HomeButton } from '../home/HomeButton';
import { useAuth } from '../../contexts/AuthContext';

interface NavLink {
  label: string;
  href: string;
}

interface NavGroup {
  label: string;
  links: NavLink[];
}

export interface NavbarProps {
  /** Mega-menu groups. Each brand passes its own; defaults to the combined set. */
  navGroups?: NavGroup[];
  logoSrc?: string;
  logoAlt?: string;
  /** Custom logo node — overrides the image logo when provided (e.g. a wordmark). */
  logo?: React.ReactNode;
}

const DEFAULT_NAV_GROUPS: NavGroup[] = [
  {
    label: "Products",
    links: [
      { label: "BaaS Platform", href: "/products/baas" },
      { label: "Agent Builder", href: "/products/agent-builder" },
      { label: "Integrations", href: "/integrations" },
    ],
  },
  {
    label: "Solutions",
    links: [
      { label: "AI Agents", href: "/agents" },
      { label: "By Industry", href: "/industries" },
      { label: "Templates Library", href: "/templates" },
    ],
  },
  {
    label: "Resources",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "Security", href: "/security" },
      { label: "Blog", href: "/blog" },
      { label: "Changelog", href: "/changelog" },
      { label: "Why Us", href: "/why-rach-dev" },
    ],
  },
  {
    label: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

function DesktopDropdown({ group }: { group: NavGroup }) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleMouseEnter() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  }

  function handleMouseLeave() {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  }

  return (
    <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        type="button"
        className="flex items-center gap-[5px] text-[14.5px] text-ink-2 transition-colors hover:text-ink"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {group.label}
        <ChevronDown
          className={cn("h-[14px] w-[14px] opacity-60 transition-transform duration-200", open && "rotate-180")}
          strokeWidth={2.5}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 min-w-[210px] rounded-xl border border-line bg-surface p-2 shadow-well">
          {group.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block rounded-lg px-4 py-2.5 text-[14px] text-ink-2 transition-colors hover:bg-row hover:text-ink"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function MobileAccordion({ group, onLinkClick }: { group: NavGroup; onLinkClick: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full border-b border-line">
      <button
        type="button"
        className="flex w-full items-center justify-between py-3 text-lg font-medium text-ink-2 transition-colors hover:text-ink"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {group.label}
        <ChevronDown
          className={cn("h-[18px] w-[18px] transition-transform duration-200", open && "rotate-180")}
          strokeWidth={2.5}
        />
      </button>

      {open && (
        <div className="ml-4 space-y-1 pb-2">
          {group.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block py-2 text-base text-ink-3 transition-colors hover:text-ink"
              onClick={onLinkClick}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function Navbar({
  navGroups = DEFAULT_NAV_GROUPS,
  logoSrc = "/brand/rach-dev-logo-side.svg",
  logoAlt = "Rach Dev LLP",
  logo,
}: NavbarProps = {}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const isLoggedIn = !!user;

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-page/80 backdrop-blur-md backdrop-saturate-150">
      <nav className="mx-auto flex h-16 max-w-site items-center gap-[34px] px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center" aria-label={`${logoAlt} home`}>
          {logo ?? (
            <Image
              src={logoSrc}
              alt={logoAlt}
              width={172}
              height={32}
              priority
              className="h-8 w-auto"
            />
          )}
        </Link>

        {/* Desktop Nav — Mega Menu */}
        <div className="ml-2 hidden items-center gap-[26px] min-[860px]:flex">
          {navGroups.map((group) => (
            <DesktopDropdown key={group.label} group={group} />
          ))}
          {/* Pricing as standalone top-level link */}
          <Link
            href="/pricing"
            className="text-[14.5px] text-ink-2 transition-colors hover:text-ink"
          >
            Pricing
          </Link>
        </div>

        {/* Desktop CTA */}
        <div className="ml-auto hidden items-center gap-[14px] min-[860px]:flex">
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-accent px-[18px] py-[10px] text-[14.5px] font-medium text-white transition-all duration-200 hover:-translate-y-px hover:shadow-[0_8px_20px_-8px_rgba(37,99,235,0.5)]"
            >
              Dashboard
              <span className="transition-transform duration-200 group-hover:translate-x-[3px]">&#8594;</span>
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg border border-line px-4 py-1.5 text-[14.5px] text-ink-2 transition-colors hover:bg-row hover:text-ink"
              >
                Sign in
              </Link>
              <HomeButton variant="primary" href="/signup" arrow>
                Get started
              </HomeButton>
            </>
          )}
        </div>

        {/* Mobile Hamburger */}
        <button
          type="button"
          className="ml-auto text-ink min-[860px]:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="fixed inset-0 top-16 z-40 overflow-y-auto bg-page min-[860px]:hidden">
          <div className="flex flex-col items-start px-8 pt-4">
            {navGroups.map((group) => (
              <MobileAccordion key={group.label} group={group} onLinkClick={() => setMobileOpen(false)} />
            ))}
            {/* Pricing standalone in mobile */}
            <div className="w-full border-b border-line">
              <Link
                href="/pricing"
                className="block py-3 text-lg font-medium text-ink-2 transition-colors hover:text-ink"
                onClick={() => setMobileOpen(false)}
              >
                Pricing
              </Link>
            </div>
            <div className="mt-6 flex w-full flex-col gap-3">
              {isLoggedIn ? (
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-[18px] py-[10px] text-[14.5px] font-medium text-white transition-all duration-200"
                >
                  Dashboard
                  <span className="transition-transform duration-200 group-hover:translate-x-[3px]">&#8594;</span>
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="rounded-lg border border-line px-4 py-2.5 text-center text-[15px] text-ink-2 transition-colors hover:bg-row"
                    onClick={() => setMobileOpen(false)}
                  >
                    Sign in
                  </Link>
                  <HomeButton variant="primary" href="/signup" arrow className="w-full justify-center">
                    Get started
                  </HomeButton>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
