const { test, expect } = require("@playwright/test");

const EDITOR_URL = "http://localhost:3000/editor";

const authenticatedUser = {
  authenticated: true,
  email: "tester@example.com",
  name: "Test User",
  initials: "TU",
};

const defaultThemes = {
  forest: {
    background: [255, 255, 255, 255],
    road: [0, 0, 0, 255],
  },
};

async function mockApiMe(page, payload = authenticatedUser) {
  await page.route("**/api/me", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    })
  );
}

async function mockThemes(page, payload = defaultThemes) {
  await page.route("**/api/themes", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    })
  );
}

async function gotoEditor(page) {
  await page.goto(EDITOR_URL);
}

async function setupAuthenticatedEditor(page) {
  await mockApiMe(page);
  await mockThemes(page);
}

test("editor page loads", async ({ page }) => {
  await gotoEditor(page);

  await expect(page).toHaveTitle("Tile Editor");
  await expect(page.getByText("Tile Editor")).toBeVisible();
  await expect(page.locator("#themeSelect")).toBeVisible();
  await expect(page.getByText("Log in to preview/save")).toBeVisible();
});

test("theme select changes editor colors", async ({ page }) => {
  await gotoEditor(page);

  await page.getByRole("button", { name: "Show pickers" }).click();
  await page.selectOption("#themeSelect", "space");

  await expect(page.locator("#themeSelect")).toHaveValue("space");
  await expect(page.locator(".color-row").first()).toBeVisible();
});

test("theme select loads options from API", async ({ page }) => {
  await mockThemes(page, {
    forest: {
      background: [255, 255, 255, 255],
      road: [0, 0, 0, 255],
    },
    desert: {
      background: [255, 244, 179, 255],
      road: [120, 87, 0, 255],
    },
  });

  await gotoEditor(page);

  await expect(page.locator("#themeSelect option")).toHaveCount(2);
  await expect(page.locator("#themeSelect option").nth(0)).toHaveText("forest");
  await expect(page.locator("#themeSelect option").nth(1)).toHaveText("desert");
});

test("color picker updates rgb text and does not trigger preview automatically", async ({ page }) => {
  await setupAuthenticatedEditor(page);

  let previewRequestCount = 0;

  await page.route("**/api/preview-theme/*", route => {
    if (route.request().method() === "POST") {
      previewRequestCount += 1;
    }

    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        preview: "forest",
      }),
    });
  });

  await gotoEditor(page);

  const colorInput = page.locator('input[type="color"]').first();
  const rgbLabel = page.locator(".color-row .rgb").first();

  await colorInput.evaluate(el => {
    el.value = "#000000";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });

  await expect(rgbLabel).toHaveText("0, 0, 0, 255");

  await page.waitForTimeout(200);

  expect(previewRequestCount).toBe(0);

  await page.getByRole("button", { name: "Preview" }).click();

  expect(previewRequestCount).toBe(1);
});

test("logout restores unauthenticated editor state", async ({ page }) => {
  let meCalls = 0;

  await page.route("**/api/me", route => {
    meCalls += 1;

    const payload =
      meCalls === 1
        ? authenticatedUser
        : { authenticated: false };

    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });

  await page.route("**/api/logout", route =>
    route.fulfill({
      status: 302,
      headers: { location: "/editor" },
    })
  );

  await gotoEditor(page);

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
  await setupAuthenticatedEditor(page);

  const cacheRequest = page.waitForRequest(request =>
    request.url().includes("/forest/18/") &&
    request.url().includes("?v=")
  );

  await gotoEditor(page);

  await page.getByLabel(/Disable cache/i).click();

  const request = await cacheRequest;

  expect(request.url()).toContain("?v=");
});

test("location input moves map", async ({ page }) => {
  await gotoEditor(page);

  await page.fill("#latInput", "49.104053773378816");
  await page.fill("#lonInput", "6.186305864714493");

  await page.getByRole("button", { name: "Go" }).click();

  await expect(page.locator("#mapPreview")).toBeVisible();
});

test("editor shows login button when not authenticated", async ({ page }) => {
  await gotoEditor(page);

  await expect(page.locator("#authBox")).toBeVisible();
  await expect(page.getByRole("link", { name: /login/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save theme" })).toHaveCount(0);
  await expect(page.getByText("Log in to preview/save")).toBeVisible();
});

test("editor shows preview and save buttons when authenticated", async ({ page }) => {
  await mockApiMe(page);

  await gotoEditor(page);

  await expect(page.getByRole("button", { name: "Preview", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save theme", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /logout/i })).toBeVisible();
});

test("authenticated editor shows the hidden tile API key input", async ({ page }) => {
  await setupAuthenticatedEditor(page);

  await page.route("**/api/tile-api-keys", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        keys: ["secret123"],
      }),
    })
  );

  await gotoEditor(page);

  await expect(page.locator("#apiKeyRow")).toBeVisible();
  await expect(page.locator("#apiKeyInput")).toHaveAttribute("type", "text");
  await expect(page.locator("#apiKeyInput")).toHaveValue("*********");
  await expect(page.getByRole("button", { name: "Show", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Show", exact: true }).click();

  await expect(page.locator("#apiKeyInput")).toHaveValue("secret123");
  await expect(page.getByRole("button", { name: "Hide", exact: true })).toBeVisible();
});

test("authenticated editor shows an empty tile API key input when no keys are configured", async ({ page }) => {
  await setupAuthenticatedEditor(page);

  await page.route("**/api/tile-api-keys", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        keys: [],
      }),
    })
  );

  await gotoEditor(page);

  await expect(page.locator("#apiKeyRow")).toBeVisible();
  await expect(page.locator("#apiKeyInput")).toHaveValue("");
  await expect(page.getByText("No keys configured")).toBeVisible();
});

test("authenticated preview button sends preview API and updates status", async ({ page }) => {
  await setupAuthenticatedEditor(page);

  await page.route("**/api/preview-theme/forest", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        preview: "forest",
      }),
    })
  );

  const previewRequestPromise = page.waitForRequest(request =>
    request.url().endsWith("/api/preview-theme/forest") &&
    request.method() === "POST"
  );

  await gotoEditor(page);

  await page.getByRole("button", { name: "Preview" }).click();

  const previewRequest = await previewRequestPromise;

  expect(JSON.parse(previewRequest.postData())).toEqual({
    background: [255, 255, 255, 255],
    road: [0, 0, 0, 255],
  });

  await expect(page.getByText("Preview updated 👀")).toBeVisible();
});

test("authenticated save button sends save API and shows save status", async ({ page }) => {
  await setupAuthenticatedEditor(page);

  await page.route("**/api/themes/forest", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        theme: "forest",
      }),
    })
  );

  const saveRequestPromise = page.waitForRequest(request =>
    request.url().endsWith("/api/themes/forest") &&
    request.method() === "PUT"
  );

  await gotoEditor(page);

  await page.getByRole("button", { name: "Save theme", exact: true }).click();

  const saveRequest = await saveRequestPromise;

  expect(JSON.parse(saveRequest.postData())).toEqual({
    background: [255, 255, 255, 255],
    road: [0, 0, 0, 255],
  });

  await expect(page.getByText("Theme saved ✅")).toBeVisible();
});

[
  ["home", "http://localhost:3000"],
  ["editor", "http://localhost:3000/editor"],
].forEach(([name, url]) => {
  test(`footer contains version on ${name} page`, async ({ page }) => {
    await page.goto(url);

    const version = page.locator("#version");

    await expect(version).toBeVisible();

    const text = await version.textContent();

    expect(text).toMatch(/^v\d+\.\d+\.\d+/);
  });
});

test("toggle pickers button hides and shows the editor", async ({ page }) => {
  await page.goto("http://localhost:3000/editor");

  const editor = page.locator("#editor");
  const toggleButton = page.locator("#togglePickersBtn");

  await expect(editor).toBeHidden();
  await expect(toggleButton).toHaveText("Show pickers");

  await toggleButton.click();

  await expect(editor).toBeVisible();
  await expect(toggleButton).toHaveText("Hide pickers");

  await toggleButton.click();

  await expect(editor).toBeHidden();
  await expect(toggleButton).toHaveText("Show pickers");
});