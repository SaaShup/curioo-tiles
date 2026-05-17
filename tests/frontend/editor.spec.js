const { test, expect } = require("@playwright/test");

test("editor page loads", async ({ page }) => {
  await page.goto("http://localhost:3000/editor");

  await expect(page).toHaveTitle(/CuriooCity Theme Editor/);
  await expect(page.getByText("CuriooCity Theme Editor")).toBeVisible();
  await expect(page.locator("#themeSelect")).toBeVisible();
  await expect(page.getByText("Log in to preview/save")).toBeVisible();
});

test("theme select changes editor colors", async ({ page }) => {
  await page.goto("http://localhost:3000/editor");

  await page.selectOption("#themeSelect", "space");

  await expect(page.locator("#themeSelect")).toHaveValue("space");
  await expect(page.locator(".color-row").first()).toBeVisible();
});

test("theme select loads options from API", async ({ page }) => {
  await page.route("**/api/themes", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        forest: { background: [255, 255, 255, 255], road: [0, 0, 0, 255] },
        desert: { background: [255, 244, 179, 255], road: [120, 87, 0, 255] },
      }),
    })
  );

  await page.goto("http://localhost:3000/editor");

  await expect(page.locator("#themeSelect option")).toHaveCount(2);
  await expect(page.locator("#themeSelect option").nth(0)).toHaveText("forest");
  await expect(page.locator("#themeSelect option").nth(1)).toHaveText("desert");
});

test("logout restores unauthenticated editor state", async ({ page }) => {
  let meCalls = 0;

  await page.route("**/api/me", route => {
    meCalls += 1;
    if (meCalls === 1) {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          authenticated: true,
          email: "tester@example.com",
          name: "Test User",
          initials: "TU",
        }),
      });
    } else {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ authenticated: false }),
      });
    }
  });

  await page.route("**/api/logout", route =>
    route.fulfill({
      status: 302,
      headers: { location: "/editor" },
    })
  );

  await page.goto("http://localhost:3000/editor");
  await expect(page.getByRole("link", { name: /logout/i })).toBeVisible();

  await Promise.all([
    page.waitForNavigation(),
    page.getByRole("link", { name: /logout/i }).click(),
  ]);

  await expect(page.getByRole("link", { name: /login/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview" })).toHaveCount(0);
  await expect(page.getByText("Log in to preview/save")).toBeVisible();
});

test("cache toggle adds cache-busting param to tile requests", async ({ page }) => {
  await page.route("**/api/me", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: true,
        email: "tester@example.com",
        name: "Test User",
        initials: "TU",
      }),
    })
  );

  await page.route("**/api/themes", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        forest: { background: [255, 255, 255, 255], road: [0, 0, 0, 255] },
      }),
    })
  );

  const cacheRequest = page.waitForRequest(request =>
    request.url().includes("/forest/18/") && request.url().includes("?v=")
  );

  await page.goto("http://localhost:3000/editor");
  await page.getByLabel(/Disable cache/i).click();

  const request = await cacheRequest;
  expect(request.url()).toContain("?v=");
});

test("location input moves map", async ({ page }) => {
  await page.goto("http://localhost:3000/editor");

  await page.fill("#latInput", "49.104053773378816");
  await page.fill("#lonInput", "6.186305864714493");
  await page.getByRole("button", { name: "Go" }).click();

  await expect(page.locator("#mapPreview")).toBeVisible();
});

test("editor shows login button when not authenticated", async ({ page }) => {
  await page.goto("/editor");

  await expect(page.locator("#authBox")).toBeVisible();
  await expect(page.getByRole("link", { name: /login/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save theme" })).toHaveCount(0);
  await expect(page.getByText("Log in to preview/save")).toBeVisible();
});

test("editor shows preview and save buttons when authenticated", async ({ page }) => {
  await page.route("**/api/me", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: true,
        email: "tester@example.com",
        name: "Test User",
        initials: "TU",
      }),
    })
  );

  await page.goto("http://localhost:3000/editor");

  await expect(page.getByRole("button", { name: "Preview" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save theme" })).toBeVisible();
  await expect(page.getByRole("link", { name: /logout/i })).toBeVisible();
});

test("authenticated preview button sends preview API and updates status", async ({ page }) => {
  await page.route("**/api/me", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: true,
        email: "tester@example.com",
        name: "Test User",
        initials: "TU",
      }),
    })
  );

  await page.route("**/api/themes", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        forest: {
          background: [255, 255, 255, 255],
          road: [0, 0, 0, 255],
        },
      }),
    })
  );

  await page.route("**/api/preview-theme/forest", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, preview: "forest" }),
    })
  );

  const previewRequestPromise = page.waitForRequest(request =>
    request.url().endsWith("/api/preview-theme/forest") && request.method() === "POST"
  );

  await page.goto("http://localhost:3000/editor");
  await page.getByRole("button", { name: "Preview" }).click();

  const previewRequest = await previewRequestPromise;
  expect(JSON.parse(previewRequest.postData())).toEqual({
    background: [255, 255, 255, 255],
    road: [0, 0, 0, 255],
  });

  await expect(page.locator("#status")).toHaveText("Preview updated 👀");
});

test("authenticated save button sends save API and shows save status", async ({ page }) => {
  await page.route("**/api/me", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: true,
        email: "tester@example.com",
        name: "Test User",
        initials: "TU",
      }),
    })
  );

  await page.route("**/api/themes", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        forest: {
          background: [255, 255, 255, 255],
          road: [0, 0, 0, 255],
        },
      }),
    })
  );

  await page.route("**/api/themes/forest", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, theme: "forest" }),
    })
  );

  const saveRequestPromise = page.waitForRequest(request =>
    request.url().endsWith("/api/themes/forest") && request.method() === "PUT"
  );

  await page.goto("http://localhost:3000/editor");
  await page.getByRole("button", { name: "Save theme" }).click();

  const saveRequest = await saveRequestPromise;
  expect(JSON.parse(saveRequest.postData())).toEqual({
    background: [255, 255, 255, 255],
    road: [0, 0, 0, 255],
  });

  await expect(page.locator("#status")).toHaveText("Theme saved ✅");
});

test("footer contains version", async ({ page }) => {
  await page.goto("http://localhost:3000");

  const version = page.locator("#version");

  await expect(version).toBeVisible();

  const text = await version.textContent();

  expect(text).toMatch(/^v\d+\.\d+\.\d+/);
});