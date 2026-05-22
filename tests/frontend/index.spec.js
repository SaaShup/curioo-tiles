const { test, expect } = require("@playwright/test");
const { gotoHome } = require("./helpers");

test("homepage shows API navigation links", async ({ page }) => {
  await gotoHome(page);

  await expect(page.getByRole("link", { name: "Tile", exact: true })).toHaveAttribute("href", "#tile-api");
  await expect(page.getByRole("link", { name: "Editor", exact: true })).toHaveAttribute("href", "#editor-api");
  await expect(page.getByRole("link", { name: "Monitoring", exact: true })).toHaveAttribute("href", "#monitoring");
  await expect(page.getByRole("link", { name: "System", exact: true })).toHaveAttribute("href", "#system-api");
  await expect(page.getByRole("link", { name: "Auth", exact: true })).toHaveAttribute("href", "#auth-api");
});

test("homepage documents monitoring and system endpoints", async ({ page }) => {
  await gotoHome(page);

  await expect(page.getByText("/metrics", { exact: true })).toBeVisible();
  await expect(page.getByText("/healthz", { exact: true })).toBeVisible();
  await expect(page.getByText("/api/version", { exact: true })).toBeVisible();
  await expect(page.getByText("/api/config", { exact: true })).toBeVisible();
});

test("homepage documents auth endpoints", async ({ page }) => {
  await gotoHome(page);

  await expect(page.getByText("/api/login", { exact: true })).toBeVisible();
  await expect(page.getByText("/api/logout", { exact: true })).toBeVisible();
});