import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import request from "supertest";
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";

const require = createRequire(import.meta.url);
const runtimeConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), "tiles-api-test-"));

process.env.TILE_ZOOM_RANGE = "[18,18]";
process.env.TILE_RUNTIME_CONFIG_FILE = path.join(runtimeConfigDir, "runtime-config.json");

const { default: app } = await import("../../server.js");
const auth = require("../../lib/auth.js");
const { getZoneForLatLon, getCachePathForZone } = require("../../lib/geo.js");

afterAll(() => {
  fs.rmSync(runtimeConfigDir, { recursive: true, force: true });
});

function createMockRes() {
  return {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
    },
  };
}

function createAuthReq(email) {
  return {
    kauth: {
      grant: {
        access_token: {
          content: email ? { email } : {},
        },
      },
    },
  };
}

async function expectUnauthorized(url) {
  const res = await request(app).get(url);

  expect(res.statusCode).toBe(401);
  expect(res.text).toContain("Unauthorized API key");
}

async function expectInvalidCoordinates(url) {
  const res = await request(app).get(url);

  expect(res.statusCode).toBe(400);
  expect(res.text).toContain("Invalid tile coordinates");
}

async function expectUnsupportedZoom(url) {
  const res = await request(app).get(url);

  expect(res.statusCode).toBe(404);
  expect(res.text).toContain("Unsupported zoom level");
}

function withOverpassCache(lat, lon, data) {
  const zone = getZoneForLatLon(lat, lon);
  const brFile = `${getCachePathForZone(zone)}.br`;
  const existing = fs.existsSync(brFile) ? fs.readFileSync(brFile) : null;

  fs.mkdirSync(path.dirname(brFile), { recursive: true });
  fs.writeFileSync(
    brFile,
    zlib.brotliCompressSync(Buffer.from(JSON.stringify(data)))
  );

  return () => {
    if (existing) {
      fs.writeFileSync(brFile, existing);
      return;
    }

    fs.rmSync(brFile, { force: true });
  };
}

function withoutOverpassCache(lat, lon) {
  const zone = getZoneForLatLon(lat, lon);
  const brFile = `${getCachePathForZone(zone)}.br`;
  const existing = fs.existsSync(brFile) ? fs.readFileSync(brFile) : null;

  fs.rmSync(brFile, { force: true });

  return () => {
    if (existing) {
      fs.mkdirSync(path.dirname(brFile), { recursive: true });
      fs.writeFileSync(brFile, existing);
    }
  };
}

describe("Health API", () => {
  it("should return healthy status", async () => {
    const res = await request(app).get("/healthz");

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe("Metrics API", () => {
  it("should expose Prometheus metrics", async () => {
    const res = await request(app).get("/metrics");

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.text).toContain("tile_requests_total");
    expect(res.text).toContain("tile_memory_tiles");
    expect(res.text).toContain("overpass_cache_total");
  });
});

describe("Tile API", () => {
  const originalTileApiKeys = process.env.TILE_API_KEYS;

  beforeEach(() => {
    process.env.TILE_API_KEYS = "";
  });

  afterEach(() => {
    process.env.TILE_API_KEYS = originalTileApiKeys;
  });

  it("should return app version", async () => {
    const res = await request(app).get("/api/version");

    expect(res.statusCode).toBe(200);
    expect(res.body.version).toBeDefined();
    expect(typeof res.body.version).toBe("string");
  });

  it("returns themes", async () => {
    const res = await request(app).get("/api/themes");

    expect(res.statusCode).toBe(200);
    expect(res.body.forest).toBeDefined();
  });

  it("returns public config", async () => {
    const res = await request(app).get("/api/config");

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ tileZoomRange: [18, 18] });
  });

  it.each([
    ["/17/135329/89901.png"],
    ["/forest/17/135329/89901.png"],
  ])("rejects zoom outside the default tile range %s", async url => {
    await expectUnsupportedZoom(url);
  });

  it("rejects invalid coordinates", async () => {
    await expectInvalidCoordinates("/18/abc/89901.png");
  });
});

describe("Overpass cache API", () => {
  const lat = 12.345;
  const lon = 45.678;
  const cachedData = {
    elements: [
      { type: "node", id: 1, tags: { natural: "tree" } },
      { type: "way", id: 2, tags: { building: "church" } },
      { type: "way", id: 3, tags: { building: "yes" } },
    ],
  };

  it("returns cached Overpass JSON with the default distance", async () => {
    const restoreCache = withOverpassCache(lat, lon, cachedData);

    try {
      const res = await request(app).get(`/api/overpass?lat=${lat}&lon=${lon}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(cachedData);
    } finally {
      restoreCache();
    }
  });

  it("filters cached Overpass elements by tag pairs", async () => {
    const restoreCache = withOverpassCache(lat, lon, cachedData);

    try {
      const res = await request(app)
        .get(`/api/overpass?lat=${lat}&lon=${lon}&f=[natural:tree,building:church]`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        elements: [
          { type: "node", id: 1, tags: { natural: "tree" } },
          { type: "way", id: 2, tags: { building: "church" } },
        ],
      });
    } finally {
      restoreCache();
    }
  });

  it("returns 404 when no matching cache is available", async () => {
    const missingLat = -78.765;
    const missingLon = -144.321;
    const restoreCache = withoutOverpassCache(missingLat, missingLon);

    try {
      const res = await request(app)
        .get(`/api/overpass?lat=${missingLat}&lon=${missingLon}&d=1`);

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ error: "Overpass cache not found" });
    } finally {
      restoreCache();
    }
  });

  it("rejects invalid distance values", async () => {
    const res = await request(app).get(`/api/overpass?lat=${lat}&lon=${lon}&d=1001`);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("between 1 and 1000 meters");
  });
});

describe("Tile API key protection", () => {
  const originalTileApiKeys = process.env.TILE_API_KEYS;

  beforeEach(() => {
    process.env.TILE_API_KEYS = JSON.stringify(["secret123"]);
  });

  afterEach(() => {
    process.env.TILE_API_KEYS = originalTileApiKeys;
  });

  it.each([
    ["/18/abc/89901.png"],
    ["/18/abc/89901.png?key=badkey"],
    ["/forest/18/abc/89901.png?key=badkey"],
  ])("rejects unauthorized tile request %s", async url => {
    await expectUnauthorized(url);
  });

  it.each([
    ["/18/abc/89901.png?key=secret123"],
    ["/forest/18/abc/89901.png?key=secret123"],
  ])("accepts authorized tile request %s", async url => {
    await expectInvalidCoordinates(url);
  });
});

describe("Editor route alias", () => {
  it("serves the editor page at /editor", async () => {
    const res = await request(app).get("/editor");

    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("Tile Editor");
  });
});
describe("Auth helper utilities", () => {
  const originalEnv = process.env.ALLOWED_EDITOR_EMAILS;

  beforeEach(() => {
    process.env.ALLOWED_EDITOR_EMAILS = "allowed@example.com";
  });

  afterEach(() => {
    process.env.ALLOWED_EDITOR_EMAILS = originalEnv;
  });

  it("allows requests without an email", () => {
    const res = createMockRes();
    const next = vi.fn();

    auth.requireAllowedEditorEmail(createAuthReq(undefined), res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBeUndefined();
    expect(res.body).toBeUndefined();
  });

  it("blocks requests for disallowed email addresses", () => {
    const res = createMockRes();
    const next = vi.fn();

    auth.requireAllowedEditorEmail(createAuthReq("blocked@example.com"), res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      ok: false,
      error: "Email not allowed: blocked@example.com",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("allows requests when no allowed list is configured", () => {
    process.env.ALLOWED_EDITOR_EMAILS = "";

    const res = createMockRes();
    const next = vi.fn();

    auth.requireAllowedEditorEmail(createAuthReq("blocked@example.com"), res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBeUndefined();
    expect(res.body).toBeUndefined();
  });

  it("allows requests when the email is in the allowed list", () => {
    const res = createMockRes();
    const next = vi.fn();

    auth.requireAllowedEditorEmail(createAuthReq("allowed@example.com"), res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBeUndefined();
    expect(res.body).toBeUndefined();
  });
});
