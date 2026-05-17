import { createRequire } from "module";
import request from "supertest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import app from "../../server.js";

const require = createRequire(import.meta.url);
const auth = require("../../lib/auth.js");

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
    const res = await request(app).get("/18/abc/89901.png");

    expect(res.statusCode).toBe(400);
  });
});

describe("Editor route alias", () => {
  it("serves the editor page at /editor", async () => {
    const res = await request(app).get("/editor");

    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("CuriooCity Theme Editor");
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

  it("blocks requests without an email", () => {
    const req = { kauth: { grant: { access_token: { content: {} } } } };
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
      },
    };
    const next = vi.fn();

    auth.requireAllowedEditorEmail(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ ok: false, error: "No email found in Keycloak token" });
    expect(next).not.toHaveBeenCalled();
  });

  it("blocks requests for disallowed email addresses", () => {
    const req = { kauth: { grant: { access_token: { content: { email: "blocked@example.com" } } } } };
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
      },
    };
    const next = vi.fn();

    auth.requireAllowedEditorEmail(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ ok: false, error: "Email not allowed: blocked@example.com" });
    expect(next).not.toHaveBeenCalled();
  });

  it("allows requests when the email is in the allowed list", () => {
    const req = { kauth: { grant: { access_token: { content: { email: "allowed@example.com" } } } } };
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
      },
    };
    const next = vi.fn();

    auth.requireAllowedEditorEmail(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBeUndefined();
    expect(res.body).toBeUndefined();
  });
});