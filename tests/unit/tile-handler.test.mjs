import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const loadThemes = vi.fn();
const generateTile = vi.fn();
const startTimer = vi.fn();
const inc = vi.fn();
const end = vi.fn();
let defaultThemeName = "forest";

function mockModule(modulePath, exports) {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports,
  };
}

function loadTileHandler() {
  delete require.cache[require.resolve("../../lib/tile-handler.js")];

  mockModule("../../lib/themes.js", {
    loadThemes,
  });

  mockModule("../../lib/config.js", {
    DEFAULT_THEME: defaultThemeName,
  });

  mockModule("../../lib/metrics.js", {
    tileRequests: { inc },
    tileRenderDuration: { startTimer },
  });

  mockModule("../../lib/renderer.js", {
    generateTile,
  });

  return require("../../lib/tile-handler.js");
}

function createReq(z = "18", x = "1", y = "2") {
  return { params: { z, x, y } };
}

function createRes() {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
  };
}

describe("tile-handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    startTimer.mockReturnValue(end);
    defaultThemeName = "forest";

    loadThemes.mockReturnValue({
      forest: { name: "forest" },
      city: { name: "city" },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 when tile coordinates are invalid", async () => {
    const { createTileHandler } = loadTileHandler();
    const res = createRes();
    const handler = createTileHandler({});

    await handler(createReq("18", "bad", "2"), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Invalid tile coordinates");
    expect(loadThemes).not.toHaveBeenCalled();
    expect(startTimer).not.toHaveBeenCalled();
    expect(generateTile).not.toHaveBeenCalled();
    expect(inc).not.toHaveBeenCalled();
  });

  it.each([
    ["z", createReq("bad", "1", "2")],
    ["y", createReq("18", "1", "bad")],
  ])("returns 400 when %s coordinate is invalid", async (_coordinate, req) => {
    const { createTileHandler } = loadTileHandler();
    const res = createRes();
    const handler = createTileHandler({});

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Invalid tile coordinates");
    expect(loadThemes).not.toHaveBeenCalled();
    expect(startTimer).not.toHaveBeenCalled();
    expect(generateTile).not.toHaveBeenCalled();
    expect(inc).not.toHaveBeenCalled();
  });

  it("returns 404 when zoom is not supported", async () => {
    const { createTileHandler } = loadTileHandler();
    const res = createRes();
    const handler = createTileHandler({});

    await handler(createReq("17", "1", "2"), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith("Only zoom 18 supported");
    expect(loadThemes).not.toHaveBeenCalled();
    expect(startTimer).not.toHaveBeenCalled();
    expect(generateTile).not.toHaveBeenCalled();
    expect(inc).not.toHaveBeenCalled();
  });

  it("renders a png tile with cache headers", async () => {
    const buffer = Buffer.from("fake-png");
    generateTile.mockResolvedValue(buffer);

    const { createTileHandler } = loadTileHandler();
    const res = createRes();
    const handler = createTileHandler({});

    await handler(createReq("18", "1", "2"), res);

    expect(generateTile).toHaveBeenCalledWith(18, 1, 2, { name: "forest" });
    expect(inc).toHaveBeenCalledWith({
      theme: "forest",
      status: "success",
    });
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "image/png");
    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "public, max-age=31536000, immutable"
    );
    expect(res.send).toHaveBeenCalledWith(buffer);
    expect(end).toHaveBeenCalled();
  });

  it("uses a preview theme when one is provided", async () => {
    const buffer = Buffer.from("fake-png");
    const previewTheme = { name: "preview-city" };
    generateTile.mockResolvedValue(buffer);

    const { createTileHandler } = loadTileHandler();
    const res = createRes();
    const handler = createTileHandler({
      city: previewTheme,
    });

    await handler(createReq("18", "1", "2"), res, "City");

    expect(generateTile).toHaveBeenCalledWith(18, 1, 2, previewTheme);
    expect(inc).toHaveBeenCalledWith({
      theme: "city",
      status: "success",
    });
    expect(res.send).toHaveBeenCalledWith(buffer);
    expect(end).toHaveBeenCalled();
  });

  it("uses a stored theme when no preview theme exists", async () => {
    const buffer = Buffer.from("fake-png");
    generateTile.mockResolvedValue(buffer);

    const { createTileHandler } = loadTileHandler();
    const res = createRes();
    const handler = createTileHandler({});

    await handler(createReq("18", "1", "2"), res, "City");

    expect(generateTile).toHaveBeenCalledWith(18, 1, 2, { name: "city" });
    expect(inc).toHaveBeenCalledWith({
      theme: "city",
      status: "success",
    });
    expect(end).toHaveBeenCalled();
  });

  it("falls back to forest when requested and default themes are missing", async () => {
    const buffer = Buffer.from("fake-png");
    const forestTheme = { name: "forest-fallback" };
    generateTile.mockResolvedValue(buffer);
    defaultThemeName = "default";
    loadThemes.mockReturnValue({
      forest: forestTheme,
    });

    const { createTileHandler } = loadTileHandler();
    const res = createRes();
    const handler = createTileHandler({});

    await handler(createReq("18", "1", "2"), res, "Unknown");

    expect(generateTile).toHaveBeenCalledWith(18, 1, 2, forestTheme);
    expect(inc).toHaveBeenCalledWith({
      theme: "unknown",
      status: "success",
    });
    expect(end).toHaveBeenCalled();
  });

  it("falls back to the default theme when requested theme is missing", async () => {
    const buffer = Buffer.from("fake-png");
    generateTile.mockResolvedValue(buffer);

    const { createTileHandler } = loadTileHandler();
    const res = createRes();
    const handler = createTileHandler({});

    await handler(createReq("18", "1", "2"), res, "Unknown");

    expect(generateTile).toHaveBeenCalledWith(18, 1, 2, { name: "forest" });
    expect(inc).toHaveBeenCalledWith({
      theme: "unknown",
      status: "success",
    });
    expect(end).toHaveBeenCalled();
  });

  it("returns 500 when tile rendering fails", async () => {
    generateTile.mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { createTileHandler } = loadTileHandler();
    const res = createRes();
    const handler = createTileHandler({});

    await handler(createReq(), res);

    expect(inc).toHaveBeenCalledWith({
      theme: "forest",
      status: "error",
    });

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith("Tile render failed");
    expect(end).toHaveBeenCalled();
  });
});
