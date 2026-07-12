'use client';

import { usePathname } from 'next/navigation';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

// Routes that should NOT have the marketing Navbar/Footer
const BARE_ROUTES = ['/login', '/register', '/dashboard'];

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isBare = BARE_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'));

  if (isBare) {
    return <>{children}</>;
  }

  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  );
}
