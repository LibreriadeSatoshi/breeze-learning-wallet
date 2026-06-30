import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { QueryProvider } from "@/providers/query-provider";
import { LocaleProvider } from "@/lib/i18n/provider";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Satoshi Scholar | Learn Bitcoin, Earn Rewards",
  description: "Your educational Bitcoin & Lightning wallet. Learn about Bitcoin while earning sats through interactive lessons and challenges.",
  keywords: ["Bitcoin", "Lightning Network", "Education", "Wallet", "Learn Bitcoin", "Cryptocurrency"],
  icons: {
    icon: "/icons/icon.png",
    apple: "/icons/icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Satoshi Scholar",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <LocaleProvider>
          <QueryProvider>{children}</QueryProvider>
        </LocaleProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
