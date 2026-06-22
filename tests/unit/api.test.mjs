import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequire } from "node:module";
import express from "express";
import request from "supertest";

const require = createRequire(import.meta.url);

function mockModule(modulePath, exports) {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports,
  };
}

function loadApiRouter() {
  delete require.cache[require.resolve("../../routes/api.js")];

  const loadThemes = vi.fn(() => ({
    forest: {
      grass: [1, 2, 3, 255],
    },
  }));

  const saveThemes = vi.fn();
  const saveTheme = vi.fn();

  const metrics = vi.fn(async () => "fake_metrics 1\n");
  const getCachedOverpassDataForPoint = vi.fn();
  let tileZoomRange = [16, 19];

  mockModule("../../lib/themes.js", {
    loadThemes,
    saveTheme,
    saveThemes,
  });

  mockModule("../../lib/metrics.js", {
    client: {
      register: {
        contentType: "text/plain; version=0.0.4",
        metrics,
      },
    },
  });

  mockModule("../../lib/config.js", {
    KEYCLOAK_URL: "https://sso.example.com",
    KEYCLOAK_REALM: "curioo",
    OVERPASS_CACHE_MAX_DISTANCE_METERS: 1000,
    getTileZoomRange: vi.fn(() => tileZoomRange),
    setTileZoomRange: vi.fn((range) => {
      if (
        !Array.isArray(range) ||
        range.length !== 2 ||
        !Number.isInteger(range[0]) ||
        !Number.isInteger(range[1]) ||
        range[0] < 3 ||
        range[1] > 20 ||
        range[1] < range[0]
      ) {
        throw new Error("TILE_ZOOM_RANGE must be [from,to] with integers where from >= 3, to <= 20, and to >= from");
      }

      tileZoomRange = range;
      return tileZoomRange;
    }),
    getTileApiKeys: vi.fn(() => ["key-1", "key-2"]),
  });

  mockModule("../../lib/auth.js", {
    keycloak: {
      protect: vi.fn(() => (req, res, next) => next()),
    },
    requireAllowedEditorEmail: (req, res, next) => next(),
    makeInitials: vi.fn((name) =>
      name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .toUpperCase()
    ),
  });

  mockModule("../../lib/overpass.js", {
    getCachedOverpassDataForPoint,
  });

  const { createApiRouter } = require("../../routes/api.js");

  return {
    createApiRouter,
    loadThemes,
    saveThemes,
    saveTheme,
    metrics,
    getCachedOverpassDataForPoint,
  };
}

function createApp(options = {}) {
  const {
    middleware,
    previewThemes = {},
  } = options;

  const { createApiRouter, ...mocks } = loadApiRouter();

  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    req.session = {
      destroy: (cb) => cb(),
    };
    next();
  });

  if (middleware) {
    app.use(middleware);
  }

  app.use(createApiRouter(previewThemes));

  return { app, previewThemes, mocks };
}

describe("api router", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /metrics returns prometheus metrics", async () => {
    const { app, mocks } = createApp();

    const res = await request(app).get("/metrics");

    expect(res.status).toBe(200);
    expect(res.text).toBe("fake_metrics 1\n");
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(mocks.metrics).toHaveBeenCalled();
  });

  it("GET /api/version returns package version", async () => {
    const { app } = createApp();

    const res = await request(app).get("/api/version");

    expect(res.status).toBe(200);
    expect(res.body.version).toBeDefined();
  });

  it("GET /api/config returns public tile configuration", async () => {
    const { app } = createApp();

    const res = await request(app).get("/api/config");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      tileZoomRange: [16, 19],
    });
  });

  it("GET /api/overpass returns cached overpass data for lat lon and distance", async () => {
    const { app, mocks } = createApp();
    const cachedData = {
      elements: [
        { type: "way", id: 123 },
      ],
    };
    mocks.getCachedOverpassDataForPoint.mockReturnValue(cachedData);

    const res = await request(app).get("/api/overpass?lat=48.6&lon=6.1&d=250");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(cachedData);
    expect(mocks.getCachedOverpassDataForPoint).toHaveBeenCalledWith(48.6, 6.1, 250);
  });

  it("GET /api/overpass returns 404 when the cache is missing", async () => {
    const { app, mocks } = createApp();
    mocks.getCachedOverpassDataForPoint.mockReturnValue(null);

    const res = await request(app).get("/api/overpass?lat=48.6&lon=6.1&d=250");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Overpass cache not found" });
  });

  it("GET /api/overpass rejects invalid query parameters", async () => {
    const { app, mocks } = createApp();

    const res = await request(app).get("/api/overpass?lat=48.6&lon=oops&d=250");

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("lat and lon");
    expect(mocks.getCachedOverpassDataForPoint).not.toHaveBeenCalled();
  });

  it("GET /api/overpass uses the configured max distance when d is missing", async () => {
    const { app, mocks } = createApp();
    const cachedData = {
      elements: [
        { type: "way", id: 123 },
      ],
    };
    mocks.getCachedOverpassDataForPoint.mockReturnValue(cachedData);

    const res = await request(app).get("/api/overpass?lat=48.6&lon=6.1");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(cachedData);
    expect(mocks.getCachedOverpassDataForPoint).toHaveBeenCalledWith(48.6, 6.1, 1000);
  });

  it("GET /api/overpass filters cached elements by tag pairs", async () => {
    const { app, mocks } = createApp();
    mocks.getCachedOverpassDataForPoint.mockReturnValue({
      elements: [
        { type: "node", id: 1, tags: { natural: "tree" } },
        { type: "way", id: 2, tags: { building: "church" } },
        { type: "way", id: 3, tags: { building: "yes" } },
        { type: "node", id: 4 },
      ],
    });

    const res = await request(app)
      .get("/api/overpass?lat=48.6&lon=6.1&f=[natural:tree,building:church]");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      elements: [
        { type: "node", id: 1, tags: { natural: "tree" } },
        { type: "way", id: 2, tags: { building: "church" } },
      ],
    });
  });

  it("GET /api/overpass accepts filters without brackets", async () => {
    const { app, mocks } = createApp();
    mocks.getCachedOverpassDataForPoint.mockReturnValue({
      elements: [
        { type: "way", id: 1, tags: { building: "church" } },
        { type: "way", id: 2, tags: { building: "yes" } },
      ],
    });

    const res = await request(app)
      .get("/api/overpass?lat=48.6&lon=6.1&f=building:church");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      elements: [
        { type: "way", id: 1, tags: { building: "church" } },
      ],
    });
  });

  it("GET /api/overpass ignores empty filters", async () => {
    const { app, mocks } = createApp();
    const cachedData = {
      elements: [
        { type: "way", id: 123, tags: { building: "yes" } },
      ],
    };
    mocks.getCachedOverpassDataForPoint.mockReturnValue(cachedData);

    const res = await request(app).get("/api/overpass?lat=48.6&lon=6.1&f=[]");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(cachedData);
  });

  it("GET /api/overpass rejects missing coordinates", async () => {
    const { app, mocks } = createApp();

    const res = await request(app).get("/api/overpass?lat=48.6");

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("lat and lon");
    expect(mocks.getCachedOverpassDataForPoint).not.toHaveBeenCalled();
  });

  it("GET /api/overpass rejects distances outside the configured range", async () => {
    const { app, mocks } = createApp();

    const tooSmall = await request(app).get("/api/overpass?lat=48.6&lon=6.1&d=0");
    const tooLarge = await request(app).get("/api/overpass?lat=48.6&lon=6.1&d=1001");

    expect(tooSmall.status).toBe(400);
    expect(tooLarge.status).toBe(400);
    expect(tooLarge.body.error).toContain("between 1 and 1000 meters");
    expect(mocks.getCachedOverpassDataForPoint).not.toHaveBeenCalled();
  });

  it("PUT /api/config/tile-zoom-range updates public tile configuration", async () => {
    const { app } = createApp();

    const res = await request(app)
      .put("/api/config/tile-zoom-range")
      .send({ tileZoomRange: [18, 20] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      tileZoomRange: [18, 20],
    });

    const configRes = await request(app).get("/api/config");
    expect(configRes.body).toEqual({
      tileZoomRange: [18, 20],
    });
  });

  it("PUT /api/config/tile-zoom-range rejects invalid ranges", async () => {
    const { app } = createApp();

    const res = await request(app)
      .put("/api/config/tile-zoom-range")
      .send({ tileZoomRange: [20, 18] });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toContain("TILE_ZOOM_RANGE must");
  });

  it("GET /api/login redirects to editor", async () => {
    const { app } = createApp();

    const res = await request(app).get("/api/login");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/editor");
  });

  it("GET /api/logout redirects locally when no id token", async () => {
    const { app } = createApp();

    const res = await request(app).get("/api/logout");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/editor");
  });

  it("GET /api/logout redirects to Keycloak logout when id token exists", async () => {
    const { app } = createApp({
      middleware: (req, res, next) => {
        req.kauth = {
          grant: {
            id_token: {
              token: "id-token-123",
            },
          },
        };
        next();
      }
    });

    const res = await request(app)
      .get("/api/logout")
      .set("host", "tiles.example.com");

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain(
      "https://sso.example.com/realms/curioo/protocol/openid-connect/logout"
    );
    expect(res.headers.location).toContain("id_token_hint=id-token-123");
    expect(res.headers.location).toContain("post_logout_redirect_uri=");
  });

  it("GET /api/me returns unauthenticated when no token exists", async () => {
    const { app } = createApp();

    const res = await request(app).get("/api/me");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ authenticated: false });
  });

  it("GET /api/me returns authenticated user", async () => {
    const { app } = createApp({
      middleware: (req, res, next) => {
          req.kauth = {
            grant: {
              access_token: {
                content: {
                  email: "user@example.com",
                  name: "Curioo User",
                },
              },
            },
          };
          next();
        }
    });

    const res = await request(app).get("/api/me");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      authenticated: true,
      email: "user@example.com",
      name: "Curioo User",
      initials: "CU",
    });
  });

  it.each([
    [
      "preferred username",
      {
        email: "user@example.com",
        preferred_username: "editor",
      },
      {
        email: "user@example.com",
        name: "editor",
        initials: "E",
      },
    ],
    [
      "email",
      {
        email: "user@example.com",
      },
      {
        email: "user@example.com",
        name: "user@example.com",
        initials: "U",
      },
    ],
    [
      "generic user",
      {},
      {
        name: "User",
        initials: "U",
      },
    ],
  ])("GET /api/me uses %s when name is missing", async (_label, token, expected) => {
    const { app } = createApp({
      middleware: (req, res, next) => {
        req.kauth = {
          grant: {
            access_token: {
              content: token,
            },
          },
        };
        next();
      },
    });

    const res = await request(app).get("/api/me");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      authenticated: true,
      ...expected,
    });
  });

  it("GET /api/tile-api-keys returns configured keys", async () => {
    const { app } = createApp();

    const res = await request(app).get("/api/tile-api-keys");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      keys: ["key-1", "key-2"],
    });
  });

  it("GET /api/themes returns themes", async () => {
    const { app } = createApp();

    const res = await request(app).get("/api/themes");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      forest: {
        grass: [1, 2, 3, 255],
      },
    });
  });

  it("PUT /api/themes/:theme saves theme and clears preview theme", async () => {
    const previewThemes = {
      forest: {
        grass: [9, 9, 9, 255],
      },
    };

    const { app, mocks } = createApp({
      previewThemes,
    });

    const res = await request(app)
      .put("/api/themes/Forest")
      .send({
        grass: [10, 20, 30, 255],
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      theme: "forest",
    });

    expect(mocks.saveTheme).toHaveBeenCalledWith("forest", {
      grass: [10, 20, 30, 255],
    });
    expect(mocks.saveThemes).not.toHaveBeenCalled();

    expect(previewThemes.forest).toBeUndefined();
  });

  it("POST /api/preview-theme/:theme stores preview theme", async () => {
    const previewThemes = {};
    const { app } = createApp({
      previewThemes,
    });

    const res = await request(app)
      .post("/api/preview-theme/Forest")
      .send({
        grass: [10, 20, 30, 255],
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      preview: "forest",
    });

    expect(previewThemes.forest).toEqual({
      grass: [10, 20, 30, 255],
    });
  });

  it("DELETE /api/preview-theme/:theme clears preview theme", async () => {
    const previewThemes = {
      forest: {
        grass: [10, 20, 30, 255],
      },
    };

    const { app } = createApp({
      previewThemes,
    });

    const res = await request(app).delete("/api/preview-theme/Forest");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      cleared: "forest",
    });

    expect(previewThemes.forest).toBeUndefined();
  });
});
