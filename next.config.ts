import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse reads files from disk at runtime; keep it out of the bundle.
  serverExternalPackages: ["pdf-parse", "@prisma/client"],
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    // Next's dev server needs eval and a websocket for hot reload. Production stays strict.
    const dev = process.env.NODE_ENV !== "production";
    const csp = [
      "default-src 'self'",
      "img-src 'self' data: blob:",
      "style-src 'self' 'unsafe-inline'",
      `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
      `connect-src 'self'${dev ? " ws: wss:" : ""}`,
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
