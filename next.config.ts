import type { NextConfig } from "next";

/**
 * Security headers applied to every response.
 *
 * Content-Security-Policy moved to `middleware.ts` (R12 §1H) so each
 * request gets a fresh per-request nonce — `unsafe-inline` is no longer
 * in the script-src. The static headers below still apply globally.
 */

const isDev = process.env.NODE_ENV === "development";

const SECURITY_HEADERS = [
  // CSP is set per-request in middleware.ts so the nonce changes every
  // page load. See R12 §1H for the rationale.
  // Clickjacking protection: nobody can iframe our site.
  { key: "X-Frame-Options", value: "DENY" },
  // Stops MIME-type sniffing attacks.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak full URLs to other origins.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable powerful APIs we never use.
  {
    key: "Permissions-Policy",
    value: [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "interest-cohort=()",
      "payment=()",
      "usb=()",
      "magnetometer=()",
      "gyroscope=()",
      "accelerometer=()",
    ].join(", "),
  },
  // HTTPS-only for the next 2 years (production only).
  ...(isDev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
  // Limit cross-origin embedding/opening.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // Don't advertise that we run Next.js (small recon hardening).
  poweredByHeader: false,

  // R29 — guarantee the Hebrew OG fonts (assets/Heebo-*.ttf, ~33KB) are
  // traced into the serverless bundle for the /i/[token]/opengraph-image
  // route. Without this Vercel may omit them → readFile throws (now
  // caught, but then Hebrew renders as boxes). Broad route glob keeps it
  // correct regardless of how the metadata route path is matched; the
  // payload is tiny so the over-inclusion cost is negligible.
  outputFileTracingIncludes: {
    "/**": ["./assets/**/*"],
  },

  // R112 — Next.js Image needs to know every remote host it's allowed
  // to optimize. Pre-R112 only Unsplash was listed, so when VendorCard
  // started rendering vendor-uploaded photos via <Image /> their URLs
  // (Supabase Storage public objects) got blocked and the catalog tile
  // showed Next's broken-image fallback (the small "?" tile we saw on
  // מטעמי שרביט's card).
  //
  // The Supabase pattern is scoped to the public Storage path so this
  // can't be abused as an open image proxy — only objects already
  // exposed via the `public/...` Storage policy are reachable.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
      {
        // *.supabase.co covers every Supabase project; the pathname
        // restriction confines us to public Storage objects (the
        // `/storage/v1/object/public/...` prefix is what Supabase
        // serves the bucket's public files under).
        protocol: "https",
        hostname: "*.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  // Allow HMR / dev assets to be fetched when the app is reached via a
  // cloudflared tunnel (or any LAN host). Required as of Next.js 16+, which
  // blocks cross-origin dev resources by default.
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "*.ngrok-free.app",
    "*.ngrok.io",
    "192.168.1.34",
    "192.168.0.0/16",
  ],

  async headers() {
    return [
      {
        // Apply security headers to every route.
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
