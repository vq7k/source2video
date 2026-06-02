import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(process.cwd(), ".."),
  reactStrictMode: true,
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
