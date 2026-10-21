import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { QueryProvider } from "@/providers/query-provider";
import { LocaleProvider } from "@/lib/i18n/provider";
import { PwaRegister } from "@/components/pwa-register";
import { ThemeSync } from "@/components/theme-sync";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { STORAGE_MIGRATION_SCRIPT } from "@/lib/storage/storage-keys";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

const literata = localFont({
  variable: "--font-serif",
  display: "swap",
  src: [
    { path: "./fonts/Literata-latin.woff2", weight: "300 600", style: "normal" },
    { path: "./fonts/Literata-Italic-latin.woff2", weight: "400", style: "italic" },
  ],
});

const plexSans = localFont({
  variable: "--font-sans",
  display: "swap",
  src: [
    { path: "./fonts/IBMPlexSans-latin.woff2", weight: "400 600", style: "normal" },
    { path: "./fonts/IBMPlexSans-Italic-latin.woff2", weight: "400", style: "italic" },
  ],
});

const plexMono = localFont({
  variable: "--font-mono",
  display: "swap",
  src: [
    { path: "./fonts/IBMPlexMono-Regular-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexMono-Medium-latin.woff2", weight: "500", style: "normal" },
    { path: "./fonts/IBMPlexMono-SemiBold-latin.woff2", weight: "600", style: "normal" },
  ],
});

const bricolage = localFont({
  variable: "--font-wordmark",
  display: "swap",
  src: [{ path: "./fonts/BricolageGrotesque-latin.woff2", weight: "400 600", style: "normal" }],
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "A Bitcoin and Lightning wallet that runs in your browser. Your keys stay with you.",
  keywords: ["Bitcoin", "Lightning Network", "Education", "Wallet", "Learn Bitcoin", "Cryptocurrency"],
  icons: {
    icon: "/icons/icon.png",
    apple: "/icons/icon.png",
  },
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: STORAGE_MIGRATION_SCRIPT + THEME_INIT_SCRIPT }} />
      </head>
      <body
        className={`${literata.variable} ${plexSans.variable} ${plexMono.variable} ${bricolage.variable} antialiased`}
      >
        <LocaleProvider>
          <QueryProvider>{children}</QueryProvider>
        </LocaleProvider>
        <PwaRegister />
        <ThemeSync />
      </body>
    </html>
  );
}
