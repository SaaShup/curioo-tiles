import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/api/**/*.test.mjs"],
    exclude: ["tests/frontend/**", "node_modules/**"],
    environment: "node",
    globals: false
  }
});