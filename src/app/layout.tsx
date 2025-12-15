import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { QueryProvider } from "@/providers/query-provider";
import { AuthRedirect } from "@/components/auth/auth-redirect";
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script src="https://apis.google.com/js/api.js" async defer></script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="bg-gradient-to-r from-red-600 via-orange-600 to-red-600 text-white py-2 px-4 text-center sticky top-0 z-50 shadow-lg">
          <div className="flex items-center justify-center gap-2 text-sm font-semibold">
            <span className="text-lg">⚠️</span>
            <span>UNDER CONSTRUCTION - DO NOT USE WITH REAL FUNDS - BREEZ REGTEST ONLY</span>
            <span className="text-lg">⚠️</span>
          </div>
        </div>
        <QueryProvider>
          <AuthRedirect />
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
