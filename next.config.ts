import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// connect-src stays open to any https/wss host: LNURL-pay fetches the payee's
// own domain, and the SDK reaches Nostr relays and DNS-over-HTTPS. Inline
// scripts are allowed because Next.js and the theme script inline them into
// statically rendered pages, where per-request nonces aren't possible.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""} https://accounts.google.com/gsi/client`,
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https: wss:",
  "frame-src https://accounts.google.com/gsi/",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // Google's sign-in window reports back to this page, which a stricter
  // opener policy would cut off.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
