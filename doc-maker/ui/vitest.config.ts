import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@source2video/workflow-core": path.resolve(dirname, "../../packages/workflow-core/src"),
      "@source2video/observability": path.resolve(dirname, "../../packages/observability/src"),
      "@doc-maker/writing-domain": path.resolve(dirname, "../packages/writing-domain/src"),
      "@": dirname,
    },
  },
});
