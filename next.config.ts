import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // ── Security Headers ──────────────────────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src 'self'${isDev ? " 'unsafe-eval'" : ""} 'unsafe-inline' https://api.mapbox.com https://js.stripe.com`,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.mapbox.com",
              `img-src 'self' blob: data: https://*.supabase.co${isDev ? " http://127.0.0.1:*" : ""} https://api.mapbox.com https://*.mapbox.com https://*.stripe.com https://lh3.googleusercontent.com https://*.googleusercontent.com`,
              "font-src 'self' https://fonts.gstatic.com",
              `connect-src 'self' https://*.supabase.co wss://*.supabase.co${isDev ? " http://127.0.0.1:* ws://127.0.0.1:*" : ""} https://api.resend.com https://api.mapbox.com https://*.mapbox.com https://events.mapbox.com https://api.stripe.com`,
              "frame-src 'self' https://accounts.google.com https://js.stripe.com https://*.stripe.com",
              "worker-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
      // Cache static assets
      {
        source: "/(.*)\\.(ico|png|jpg|jpeg|gif|svg|woff|woff2)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },

  // ── Image Optimization ────────────────────────────────
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },

  // ── Build Optimization ────────────────────────────────
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "@supabase/supabase-js",
    ],
  },

  // ── Redirects ─────────────────────────────────────────
  // Project Yggdrasil: Old flat URLs → new nested IA routes (301)
  async redirects() {
    return [
      { source: "/app", destination: "/dashboard", permanent: true },

      // ── Care: Old flat routes → Yggdrasil pillars ──
      // Participants pillar
      { source: "/dashboard/care/clinical-timeline", destination: "/dashboard/care/plans", permanent: true },

      // Rostering & Ops pillar
      { source: "/dashboard/roster/master", destination: "/dashboard/schedule", permanent: true },
      { source: "/dashboard/care/routines", destination: "/dashboard/schedule", permanent: true },

      // Clinical & Safety pillar — consolidated routes
      { source: "/dashboard/care/progress-notes", destination: "/dashboard/care/notes", permanent: true },
      { source: "/dashboard/care/comms", destination: "/dashboard/care/notes", permanent: true },
      { source: "/dashboard/care/note-review", destination: "/dashboard/care/notes", permanent: true },
      { source: "/dashboard/care/medications/asclepius", destination: "/dashboard/care/medications", permanent: true },
      { source: "/dashboard/care/behaviour", destination: "/dashboard/care/incidents", permanent: true },
      { source: "/dashboard/care/observations", destination: "/dashboard/care/incidents", permanent: true },

      // Financials & PRODA pillar — legacy aliases
      { source: "/dashboard/care/funding-engine", destination: "/dashboard/care/proda-claims", permanent: true },
      { source: "/dashboard/care/sil-quoting/variance", destination: "/dashboard/care/sil-quoting", permanent: true },

      // Fleet consolidation
      { source: "/dashboard/fleet/vehicles", destination: "/dashboard/fleet/overview", permanent: true },

      // Governance pillar
      { source: "/dashboard/governance/policies", destination: "/dashboard/compliance/readiness", permanent: true },
      { source: "/dashboard/compliance/policies", destination: "/dashboard/compliance/readiness", permanent: true },
    ];
  },
};

export default nextConfig;
