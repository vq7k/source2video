import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(process.cwd(), ".."),
  reactStrictMode: true,
  // Keep node-postgres (native bindings) out of the server bundle; it must be
  // required at runtime, not webpack-bundled.
  serverExternalPackages: ["pg"],
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
