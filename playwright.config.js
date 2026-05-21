import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_RUNTIME_CONFIG_DIR = path.join(os.tmpdir(), "tiles-playwright-runtime");

fs.rmSync(TEST_RUNTIME_CONFIG_DIR, { recursive: true, force: true });
fs.mkdirSync(TEST_RUNTIME_CONFIG_DIR, { recursive: true });

module.exports = defineConfig({
  testDir: "./tests/frontend",
  testMatch: "**/*.spec.js",
  webServer: {
    command: "npm run start",
    timeout: 120000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      TILE_RUNTIME_CONFIG_FILE: TEST_RUNTIME_CONFIG_DIR,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
