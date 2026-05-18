import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.mjs"],
    environment: "node",
    globals: false,
    coverage: {
      enabled: true,
      reporter: ["text", "lcovonly"],
      reportsDirectory: "./coverage/unit",
    }
  }
});
