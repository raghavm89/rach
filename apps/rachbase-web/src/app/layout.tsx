import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import { QueryProvider, AuthProvider } from "@rach/ui";
import { SiteChrome } from "@/components/SiteChrome";
import { SITE_URL } from "@/config/site";
import "./globals.css";

const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["600", "700", "800"],
});

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "RachBase — Cloud Management & Backend-as-a-Service",
    template: "%s | RachBase",
  },
  description:
    "Deploy services from GitHub or Postgres, provision VMs, monitor in real time, and manage tenants and billing — from one dashboard.",
  openGraph: {
    type: "website",
    siteName: "RachBase",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        {/* Pre-hydration: apply saved/system dark theme on dashboard routes
            before first paint to avoid a light→dark flash. Mirrors ThemeProvider. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(location.pathname.indexOf('/dashboard')!==0)return;var s=localStorage.getItem('rachbase-theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${bricolageGrotesque.variable} ${hankenGrotesk.variable} ${jetbrainsMono.variable} font-body antialiased`}
      >
        <AuthProvider>
          <QueryProvider>
            <SiteChrome>{children}</SiteChrome>
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
