import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

function loadConfig(env = {}) {
  const originalEnv = { ...process.env };

  delete process.env.PORT;
  delete process.env.DEBUG;
  delete process.env.KEYCLOAK_URL;
  delete process.env.KEYCLOAK_REALM;
  delete process.env.THEME;
  delete process.env.OVERPASS_URL;
  delete process.env.TILE_ZOOM_RANGE;
  delete process.env.TILE_API_KEYS;

  Object.assign(process.env, env);

  delete require.cache[require.resolve("../../lib/config.js")];
  const config = require("../../lib/config.js");

  process.env = originalEnv;

  return config;
}

describe("config", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads default values", () => {
    const config = loadConfig();

    expect(config.TILE_SIZE).toBe(256);
    expect(config.PORT).toBe(3000);
    expect(config.CACHE_DIR).toBe(path.join(process.cwd(), "cache"));
    expect(config.DEBUG).toBe(false);
    expect(config.KEYCLOAK_URL).toBe("https://connect.curioo.city");
    expect(config.KEYCLOAK_REALM).toBe("curioo");
    expect(config.DEFAULT_THEME).toBe("forest");
    expect(config.ZONE_SIZE_DEGREES).toBe(0.02);
    expect(config.OVERPASS_URL).toBe("https://overpass");
    expect(config.TILE_ZOOM_RANGE).toEqual([18, 18]);
    expect(config.TILE_API_KEYS).toEqual([]);
  });

  it("loads values from environment", () => {
    const config = loadConfig({
      PORT: "4000",
      DEBUG: "true",
      KEYCLOAK_URL: "https://sso.example.com",
      KEYCLOAK_REALM: "demo",
      THEME: "CITY",
      OVERPASS_URL: "https://overpass.example.com",
      TILE_ZOOM_RANGE: "[16,19]",
      TILE_API_KEYS: '["key1","key2"]',
    });

    expect(config.PORT).toBe(4000);
    expect(config.DEBUG).toBe(true);
    expect(config.KEYCLOAK_URL).toBe("https://sso.example.com");
    expect(config.KEYCLOAK_REALM).toBe("demo");
    expect(config.DEFAULT_THEME).toBe("city");
    expect(config.OVERPASS_URL).toBe("https://overpass.example.com");
    expect(config.TILE_ZOOM_RANGE).toEqual([16, 19]);
    expect(config.TILE_API_KEYS).toEqual(["key1", "key2"]);
  });

  it.each([
    ["not-json"],
    ["[]"],
    ["[18]"],
    ["[18,17]"],
    ["[-1,18]"],
    ["[18,18.5]"],
    ['["18","19"]'],
  ])("rejects invalid TILE_ZOOM_RANGE %s", (range) => {
    expect(() => loadConfig({ TILE_ZOOM_RANGE: range })).toThrow(
      "TILE_ZOOM_RANGE must"
    );
  });

  it("parses TILE_API_KEYS from JSON array", () => {
    const config = loadConfig({
      TILE_API_KEYS: '[" abc ","","def",null,123]',
    });

    expect(config.TILE_API_KEYS).toEqual(["abc", "def", "123"]);
  });

  it("parses TILE_API_KEYS from CSV when JSON parsing fails", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const config = loadConfig({
      TILE_API_KEYS: "key1, key2, ,key3",
    });

    expect(config.TILE_API_KEYS).toEqual(["key1", "key2", "key3"]);
    expect(warn).toHaveBeenCalled();
  });

  it("returns fresh API keys from getTileApiKeys", () => {
    const config = loadConfig({
      TILE_API_KEYS: '["first"]',
    });

    process.env.TILE_API_KEYS = '["second", "third"]';

    expect(config.TILE_API_KEYS).toEqual(["first"]);
    expect(config.getTileApiKeys()).toEqual(["second", "third"]);
  });

  it("debugLog writes only when DEBUG is true", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const debugConfig = loadConfig({
      DEBUG: "true",
    });

    debugConfig.debugLog("hello", "world");
    expect(log).toHaveBeenCalledWith("hello", "world");

    log.mockClear();

    const normalConfig = loadConfig({
      DEBUG: "false",
    });

    normalConfig.debugLog("hidden");
    expect(log).not.toHaveBeenCalled();
  });
});
