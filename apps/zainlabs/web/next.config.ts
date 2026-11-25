import path from "node:path";
import type { NextConfig } from "next";

const root = path.resolve(__dirname, "..");

// The backend is a separate service (apps/zainlabs/api). Browser requests to /api/* are proxied to it,
// so the website and the API share one origin (no CORS, cookies possible later).
const API_INTERNAL_URL = (process.env.API_INTERNAL_URL ?? "http://localhost:8100").replace(/\/$/, "");

const nextConfig: NextConfig = {
  transpilePackages: ["@zainlabs/content"],
  turbopack: { root },
  outputFileTracingRoot: root,
  poweredByHeader: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_INTERNAL_URL}/api/:path*` }];
  },
};

export default nextConfig;
