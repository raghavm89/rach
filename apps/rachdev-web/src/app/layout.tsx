import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import { QueryProvider, AuthProvider } from "@rach/ui";
import { ChatProvider } from "@/contexts/ChatContext";
import { SiteChrome } from "@/components/SiteChrome";
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
  metadataBase: new URL("https://rach.dev"),
  title: {
    default: "RachDev — AI Agent Builder",
    template: "%s | RachDev",
  },
  description:
    "Deploy intelligent AI agents in minutes. 60 production-tested templates across 15 industries. Configure via natural language, test in a sandbox, and deploy with one click.",
  openGraph: {
    type: "website",
    siteName: "RachDev",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
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
      <body
        className={`${bricolageGrotesque.variable} ${hankenGrotesk.variable} ${jetbrainsMono.variable} font-body antialiased`}
      >
        <AuthProvider>
          <QueryProvider>
            <ChatProvider>
              <SiteChrome>{children}</SiteChrome>
            </ChatProvider>
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
