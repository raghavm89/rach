"use client";

import { usePathname } from "next/navigation";
import { TOCSidebar } from '@rach/ui/components/ui/TOCSidebar';

const legalNav = [
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Terms of Service", href: "/legal/terms" },
  { label: "Cookie Policy", href: "/legal/cookies" },
  { label: "Service Level Agreement", href: "/legal/sla" },
  { label: "Data Processing Agreement", href: "/legal/dpa" },
];

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const items = legalNav.map((item) => ({
    ...item,
    active: pathname === item.href,
  }));

  return (
    <div className="pt-28">
      <div className="mx-auto max-w-[1200px] px-6 pb-20 lg:grid lg:grid-cols-[250px_1fr] lg:gap-12">
        <aside className="hidden lg:block">
          <TOCSidebar items={items} />
        </aside>
        <article className="min-w-0">{children}</article>
      </div>
    </div>
  );
}
