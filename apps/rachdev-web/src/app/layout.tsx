import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
// Shared providers now come from the design-system package.
import { QueryProvider, AuthProvider } from "@rach/ui";
import { ChatProvider } from "@/contexts/ChatContext";
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
  metadataBase: new URL("https://rachdev.example"),
  title: {
    default: "RachDev — AI Agent Builder",
    template: "%s | RachDev",
  },
  description:
    "Design, run, and deploy autonomous AI agents. RachDev turns models into working software — running on managed infrastructure by RachBase.",
  openGraph: {
    type: "website",
    siteName: "RachDev",
  },
  twitter: { card: "summary_large_image" },
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
            <ChatProvider>{children}</ChatProvider>
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
