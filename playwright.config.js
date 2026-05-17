const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/frontend",
  testMatch: "**/*.spec.js",
  use: {
    baseURL: "http://localhost:3000",
  },
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    timeout: 120000,
    reuseExistingServer: true,
  },
});