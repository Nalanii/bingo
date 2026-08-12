import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";
import { BackgroundOrbs } from "@/components/background-orbs";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const display = Fredoka({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Nunito({
  variable: "--font-body",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bingo-psi-liart.vercel.app";
const title = "Bingoal — goal & event bingo";
const description =
  "Turn anything into a BINGO — a reading list, a bucket list, a year of adventures. Check squares off, count reps up, celebrate every line.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s — Bingoal",
  },
  description,
  applicationName: "Bingoal",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "Bingoal",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#e60053",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="relative flex min-h-full flex-col">
        <a
          href="#main-content"
          className="bg-primary text-primary-foreground sr-only rounded-[var(--radius-sm)] text-sm font-semibold focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2"
        >
          Skip to main content
        </a>
        <BackgroundOrbs />
        <div className="relative z-0 flex min-h-full flex-1 flex-col">
          <SiteHeader />
          {children}
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
