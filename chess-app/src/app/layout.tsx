import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { themeBootScript } from "@/lib/theme/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://chess-bigtech-prep.vercel.app";
const ogTitle = "chess·prep — Personal AI chess tutor";
const ogDescription =
  "An AI chess tutor that remembers your puzzle results, finds weak spots, and turns them into focused training missions. Built for engineers prepping BigTech interviews.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "chess·prep — Personal AI chess tutor",
    template: "%s · chess·prep",
  },
  description: ogDescription,
  applicationName: "chess·prep",
  authors: [{ name: "almacho04" }],
  keywords: [
    "chess",
    "chess tutor",
    "ai chess",
    "stockfish",
    "puzzles",
    "spaced repetition",
    "leetcode",
    "interview prep",
    "next.js",
    "supabase",
  ],
  openGraph: {
    type: "website",
    siteName: "chess·prep",
    url: siteUrl,
    title: ogTitle,
    description: ogDescription,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "chess·prep — Personal AI chess tutor landing page",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: ogTitle,
    description: ogDescription,
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // `data-theme` is set synchronously by the boot script before hydration.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body
        // Suppress hydration mismatch from browser extensions (Grammarly,
        // LastPass, etc.) that inject data-* attributes onto <body>.
        suppressHydrationWarning
        className="min-h-full flex flex-col"
      >
        {children}
      </body>
    </html>
  );
}
