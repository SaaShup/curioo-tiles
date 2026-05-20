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

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lZ0Z5wAAAABJRU5ErkJggg==",
  "base64"
);
const forestTileZoomPathPattern = /^\/forest\/(\d+)\//;

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

async function mockConfig(page, payload = { tileZoomRange: [18, 18] }) {
  let config = payload;

  await page.route("**/api/config/tile-zoom-range", async route => {
    const body = route.request().postDataJSON();
    config = {
      tileZoomRange: body.tileZoomRange,
    };

    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        tileZoomRange: config.tileZoomRange,
      }),
    });
  });

  await page.route("**/api/config", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(config),
    })
  );
}

async function gotoEditor(page) {
  await page.goto(EDITOR_URL);
}

async function setupAuthenticatedEditor(page) {
  await mockConfig(page);
  await mockApiMe(page);
  await mockThemes(page);
}

function fullscreenControl(page) {
  return page.locator([
    ".leaflet-control-fullscreen a",
    ".leaflet-control-zoom-fullscreen",
    "a[title*='Full Screen']",
    "a[title*='Fullscreen']",
  ].join(", ")).first();
}

async function mockFullscreenApi(page) {
  await page.addInitScript(() => {
    let fullscreenElement = null;

    function emitFullscreenChange() {
      document.dispatchEvent(new Event("fullscreenchange"));
      document.dispatchEvent(new Event("webkitfullscreenchange"));
    }

    Object.defineProperty(document, "fullscreenEnabled", {
      configurable: true,
      get: () => true,
    });

    Object.defineProperty(document, "webkitFullscreenEnabled", {
      configurable: true,
      get: () => true,
    });

    Object.defineProperty(document, "mozFullScreenEnabled", {
      configurable: true,
      get: () => true,
    });

    Object.defineProperty(document, "msFullscreenEnabled", {
      configurable: true,
      get: () => true,
    });

    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => fullscreenElement,
    });

    Object.defineProperty(document, "webkitFullscreenElement", {
      configurable: true,
      get: () => fullscreenElement,
    });

    Object.defineProperty(document, "mozFullScreenElement", {
      configurable: true,
      get: () => fullscreenElement,
    });

    Object.defineProperty(document, "msFullscreenElement", {
      configurable: true,
      get: () => fullscreenElement,
    });

    Object.defineProperty(document, "webkitIsFullScreen", {
      configurable: true,
      get: () => Boolean(fullscreenElement),
    });

    function setFullscreenElement(element) {
      fullscreenElement = element;
      globalThis.__fullscreenRequestedElement = element;
      emitFullscreenChange();
      return Promise.resolve();
    }

    function requestFullscreen() {
      return setFullscreenElement(this);
    }

    [Element.prototype, HTMLElement.prototype, SVGElement.prototype].forEach((prototype) => {
      Object.defineProperty(prototype, "requestFullscreen", {
        configurable: true,
        value: requestFullscreen,
      });
      Object.defineProperty(prototype, "webkitRequestFullscreen", {
        configurable: true,
        value: requestFullscreen,
      });
      Object.defineProperty(prototype, "webkitRequestFullScreen", {
        configurable: true,
        value: requestFullscreen,
      });
      Object.defineProperty(prototype, "mozRequestFullScreen", {
        configurable: true,
        value: requestFullscreen,
      });
      Object.defineProperty(prototype, "msRequestFullscreen", {
        configurable: true,
        value: requestFullscreen,
      });
    });

    document.exitFullscreen = function exitFullscreen() {
      fullscreenElement = null;
      emitFullscreenChange();
      return Promise.resolve();
    };

    document.webkitExitFullscreen = document.exitFullscreen;
    document.mozCancelFullScreen = document.exitFullscreen;
    document.msExitFullscreen = document.exitFullscreen;
  });
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
  await mockConfig(page);
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

test("editor uses configured tile zoom range", async ({ page }) => {
  await mockConfig(page, { tileZoomRange: [16, 19] });
  await mockApiMe(page);
  await mockThemes(page);

  let requestedZoom;
  await page.route("**/forest/*/*/*.png*", route => {
    const match = forestTileZoomPathPattern.exec(new URL(route.request().url()).pathname);
    requestedZoom = match?.[1];
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: tinyPng,
    });
  });

  await gotoEditor(page);

  await expect(page.locator("#zoomFromInput")).toHaveValue("16");
  await expect(page.locator("#zoomFromInput")).toBeEnabled();
  await expect(page.locator("#zoomToInput")).toHaveValue("19");
  await expect(page.locator("#zoomToInput")).toBeEnabled();
  await expect(page.locator("#currentZoomInput")).toHaveValue("19");
  await expect(page.locator("#currentZoomInput")).toBeDisabled();
  await expect.poll(() => requestedZoom).toBe("19");
});

test("editor can apply a changed preview zoom range", async ({ page }) => {
  await mockConfig(page, { tileZoomRange: [18, 19] });
  await mockApiMe(page);
  await mockThemes(page);

  const requestedZooms = [];
  await page.route("**/forest/*/*/*.png*", route => {
    const match = forestTileZoomPathPattern.exec(new URL(route.request().url()).pathname);
    if (match?.[1]) {
      requestedZooms.push(match[1]);
    }
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: tinyPng,
    });
  });

  await gotoEditor(page);
  await expect.poll(() => requestedZooms.includes("19")).toBe(true);

  requestedZooms.length = 0;
  await page.fill("#zoomFromInput", "17");
  await page.fill("#zoomToInput", "18");
  await page.getByRole("button", { name: "Apply" }).click();

  await expect(page.locator("#currentZoomInput")).toHaveValue("18");
  await expect.poll(() => requestedZooms.includes("18")).toBe(true);
});

test("zoom range inputs keep from and to in order", async ({ page }) => {
  await mockConfig(page, { tileZoomRange: [18, 19] });
  await mockApiMe(page);
  await mockThemes(page);
  await page.route("**/forest/*/*/*.png*", route =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: tinyPng,
    })
  );

  await gotoEditor(page);

  await page.fill("#zoomFromInput", "20");
  await expect(page.locator("#zoomFromInput")).toHaveValue("20");
  await expect(page.locator("#zoomToInput")).toHaveValue("20");

  await page.fill("#zoomToInput", "17");
  await expect(page.locator("#zoomFromInput")).toHaveValue("17");
  await expect(page.locator("#zoomToInput")).toHaveValue("17");
});

test("map shows a loader while tiles are being fetched", async ({ page }) => {
  await mockConfig(page);
  await mockApiMe(page);
  await mockThemes(page);

  let resolveTile;
  const tileResponse = new Promise(resolve => {
    resolveTile = resolve;
  });
  let resolveTileStarted;
  const tileStarted = new Promise(resolve => {
    resolveTileStarted = resolve;
  });

  await page.route("**/forest/*/*/*.png*", async route => {
    resolveTileStarted();
    await tileResponse;
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: tinyPng,
    });
  });

  await gotoEditor(page);
  await tileStarted;

  await expect(page.locator("#mapLoadingOverlay")).toBeVisible();
  await expect(page.locator("#mapTileCounter")).toContainText("/");

  resolveTile();

  await expect(page.locator("#mapLoadingOverlay")).toBeHidden();
});

test("map shows an authorization message when tile requests are unauthorized", async ({ page }) => {
  await mockConfig(page);
  await mockApiMe(page);
  await mockThemes(page);

  await page.route("**/forest/*/*/*.png*", route =>
    route.fulfill({
      status: 401,
      contentType: "text/plain",
      body: "Unauthorized API key",
    })
  );

  await gotoEditor(page);

  await expect(page.locator("#mapUnauthorizedOverlay")).toBeVisible();
  await expect(page.getByText("Tile access denied")).toBeVisible();
  await expect(page.locator("#mapPreview")).toHaveAttribute("aria-hidden", "true");
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
  await expect(page.getByLabel(/Disable cache/i)).toBeHidden();
  await expect(page.getByText("Log in to preview/save")).toBeVisible();
});

test("editor shows preview and save buttons when authenticated", async ({ page }) => {
  await mockApiMe(page);

  await gotoEditor(page);

  await expect(page.getByRole("button", { name: "Preview", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save theme", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /logout/i })).toBeVisible();
  await expect(page.getByLabel(/Disable cache/i)).toBeVisible();
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

test("map fullscreen control is visible", async ({ page }) => {
  await page.goto("http://localhost:3000/editor");

  const fullscreenButton = fullscreenControl(page);

  await expect(fullscreenButton).toBeVisible();
});

test("map can enter fullscreen mode", async ({ page }) => {
  await mockFullscreenApi(page);
  await page.goto("http://localhost:3000/editor");

  const fullscreenButton = fullscreenControl(page);

  await expect(fullscreenButton).toBeVisible();
  await fullscreenButton.click();

  await expect(page.locator("#mapPreview")).toBeVisible();

  await expect.poll(() =>
    page.evaluate(() => {
      const map = document.getElementById("mapPreview");
      const mapContainer = map?.closest(".leaflet-container");
      const fullscreenButton = document.querySelector(
        ".leaflet-control-fullscreen a, .leaflet-control-zoom-fullscreen, a[title*='Full Screen'], a[title*='Fullscreen'], a[title*='Exit']"
      );
      const requested = globalThis.__fullscreenRequestedElement || document.fullscreenElement;

      return Boolean(
        requested ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement ||
        document.webkitIsFullScreen ||
        map?.classList.contains("leaflet-fullscreen-on") ||
        mapContainer?.classList.contains("leaflet-fullscreen-on") ||
        fullscreenButton?.getAttribute("title")?.toLowerCase().includes("exit")
      );
    })
  ).toBe(true);
});
