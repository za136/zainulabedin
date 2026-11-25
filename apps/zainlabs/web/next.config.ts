import path from "node:path";
import type { NextConfig } from "next";

const root = path.resolve(__dirname, "..");

const nextConfig: NextConfig = {
  transpilePackages: ["@zainlabs/content"],
  turbopack: { root },
  outputFileTracingRoot: root,
  poweredByHeader: false,
};

export default nextConfig;
