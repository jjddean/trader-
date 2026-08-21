import type { NextConfig } from "next";

/**
 * Content-Security-Policy, shipped REPORT-ONLY.
 *
 * The allow-lists below are best-effort for Clerk, Convex, Stripe and Mapbox.
 * Enforcing a wrong CSP breaks sign-in and checkout silently, so this reports
 * violations without blocking. Flip the header name to
 * "Content-Security-Policy" only after the browser console is quiet on a real
 * session covering sign-in, a declaration, an upload and checkout.
 */
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  // Clerk and Stripe inject scripts; 'unsafe-inline' stays until their nonces are wired.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://clerk.freightcode.co.uk https://js.stripe.com https://api.mapbox.com",
  "style-src 'self' 'unsafe-inline' https://api.mapbox.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.clerk.accounts.dev https://clerk.freightcode.co.uk https://api.stripe.com https://api.mapbox.com https://events.mapbox.com",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const SECURITY_HEADERS = [
  // Two years, preloadable. Vercel already redirects http→https.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
];

const CONSULTANT_REVIEW_HEADERS = [
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
];

const nextConfig: NextConfig = {
  trailingSlash: false,
  serverExternalPackages: ["@aws-sdk/client-textract"],
  // Applied to every route including /api. vercel.json is {} and stays that way:
  // App Router headers belong here so they survive local dev and preview builds.
  headers: async () => [
    { source: "/:path*", headers: SECURITY_HEADERS },
    { source: "/r/export/:path*", headers: CONSULTANT_REVIEW_HEADERS },
    { source: "/r/end-user/:path*", headers: CONSULTANT_REVIEW_HEADERS },
  ],
  redirects: async () => {
    return [
      {
        source: "/dashborad",
        destination: "/dashboard",
        permanent: false,
      },
      {
        source: "/dashboard/import/tre",
        destination: "/dashboard/tre-import",
        permanent: true,
      },
      // Force www for all non-www requests (http->https handled by Vercel)
      {
        source: "/:path*",
        destination: "https://www.freightcode.co.uk/:path*",
        basePath: false,
        permanent: true,
        has: [
          {
            type: "host",
            value: "freightcode.co.uk",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
