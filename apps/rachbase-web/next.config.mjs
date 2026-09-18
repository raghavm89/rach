/** @type {import('next').NextConfig} */

// Security headers applied to every route. HSTS complements the platform TLS
// (Railway); the rest are standard hardening. CSP is intentionally omitted here —
// it needs testing against real script sources (Razorpay, GA) and is added separately.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig = {
  transpilePackages: ["@rach/ui"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // `output: "standalone"` is REQUIRED by the active deploy path: railway.json pins
  // `builder: DOCKERFILE`, and apps/rachbase-web/Dockerfile copies `.next/standalone`
  // and starts `node apps/rachbase-web/server.js`. (An earlier note removed this for a
  // Nixpacks + `next start` deploy — that contradiction meant the Docker image build
  // failed outright; go-live audit P0 #6. If you ever switch to Nixpacks, change
  // railway.json in the same commit.)
  output: "standalone",
};

export default nextConfig;
