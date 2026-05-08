const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/frontend",
  testMatch: "**/*.spec.js",
  use: {
    baseURL: "http://localhost:3000"
  }
});