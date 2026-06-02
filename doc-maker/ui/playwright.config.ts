import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

const e2eRunStore = path.join(process.cwd(), ".test-artifacts", "e2e-writing-runs");

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3911",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "rm -rf .test-artifacts/e2e-writing-runs && pnpm exec next dev -p 3911",
    url: "http://127.0.0.1:3911/writing",
    reuseExistingServer: false,
    timeout: 90_000,
    env: {
      DOC_MAKER_LLM_PROVIDER: "mock",
      DOC_MAKER_RUN_STORE_DIR: e2eRunStore,
      NO_PROXY: "127.0.0.1,localhost",
      no_proxy: "127.0.0.1,localhost",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
});
