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

test("homepage toggles and remembers dark mode", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await gotoHome(page);

  const toggle = page.getByRole("button", { name: "Switch to dark mode" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await toggle.click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Switch to light mode" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("tile_color_scheme"))).toBe("dark");

  await page.reload();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
