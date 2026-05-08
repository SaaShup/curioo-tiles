import request from "supertest";
import { describe, it, expect } from "vitest";
import app from "../../server.js";

describe("Tile API", () => {
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