import { createRequire } from "node:module";
import request from "supertest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import app from "../../server.js";

const require = createRequire(import.meta.url);
const auth = require("../../lib/auth.js");

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
    expect(res.text).toContain("overpass_cache_total");
  });
});

describe("Tile API", () => {
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

  it("rejects invalid zoom", async () => {
    const res = await request(app).get("/17/135329/89901.png");

    expect(res.statusCode).toBe(404);
  });

  it("rejects invalid coordinates", async () => {
    await expectInvalidCoordinates("/18/abc/89901.png");
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