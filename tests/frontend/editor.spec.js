const { test, expect } = require("@playwright/test");

test("editor page loads", async ({ page }) => {
  await page.goto("http://localhost:3000/editor.html");

  await expect(page).toHaveTitle(/CuriooCity Theme Editor/);
  await expect(page.getByText("CuriooCity Theme Editor")).toBeVisible();
  await expect(page.locator("#themeSelect")).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save theme" })).toBeVisible();
});

test("theme select changes editor colors", async ({ page }) => {
  await page.goto("http://localhost:3000/editor.html");

  await page.selectOption("#themeSelect", "space");

  await expect(page.locator("#themeSelect")).toHaveValue("space");
  await expect(page.locator(".color-row").first()).toBeVisible();
});

test("location input moves map", async ({ page }) => {
  await page.goto("http://localhost:3000/editor.html");

  await page.fill("#latInput", "49.104053773378816");
  await page.fill("#lonInput", "6.186305864714493");
  await page.getByRole("button", { name: "Go" }).click();

  await expect(page.locator("#mapPreview")).toBeVisible();
});

test("editor shows login button when not authenticated", async ({ page }) => {
  await page.goto("/editor.html");

  await expect(page.locator("#authBox")).toBeVisible();
  await expect(page.getByRole("link", { name: /login/i })).toBeVisible();
});

test("footer contains version", async ({ page }) => {
  await page.goto("http://localhost:3000");

  const version = page.locator("#version");

  await expect(version).toBeVisible();

  const text = await version.textContent();

  expect(text).toMatch(/^v\d+\.\d+\.\d+/);
});