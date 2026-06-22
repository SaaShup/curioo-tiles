import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const require = createRequire(import.meta.url);

function loadConfig(env = {}) {
  const originalEnv = { ...process.env };

  delete process.env.PORT;
  delete process.env.DEBUG;
  delete process.env.KEYCLOAK_URL;
  delete process.env.KEYCLOAK_REALM;
  delete process.env.THEME;
  delete process.env.OVERPASS_URL;
  delete process.env.OVERPASS_CACHE_MAX_DISTANCE_METERS;
  delete process.env.TILE_ZOOM_RANGE;
  delete process.env.TILE_RUNTIME_CONFIG_FILE;
  delete process.env.TILE_API_KEYS;

  Object.assign(process.env, env);
  if (!process.env.TILE_RUNTIME_CONFIG_FILE) {
    process.env.TILE_RUNTIME_CONFIG_FILE = path.join(
      os.tmpdir(),
      `tiles-config-missing-${process.pid}-${Date.now()}-${crypto.randomUUID()}.json`
    );
  }

  delete require.cache[require.resolve("../../lib/config.js")];
  const config = require("../../lib/config.js");

  process.env = originalEnv;

  return config;
}

describe("config", () => {
  let tempDir;

  beforeEach(() => {
    vi.restoreAllMocks();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tiles-config-test-"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tempDir, { recursive: true, force: true });
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
    expect(config.OVERPASS_CACHE_MAX_DISTANCE_METERS).toBe(1000);
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
      OVERPASS_CACHE_MAX_DISTANCE_METERS: "2500",
      TILE_ZOOM_RANGE: "[16,19]",
      TILE_API_KEYS: '["key1","key2"]',
    });

    expect(config.PORT).toBe(4000);
    expect(config.DEBUG).toBe(true);
    expect(config.KEYCLOAK_URL).toBe("https://sso.example.com");
    expect(config.KEYCLOAK_REALM).toBe("demo");
    expect(config.DEFAULT_THEME).toBe("city");
    expect(config.OVERPASS_URL).toBe("https://overpass.example.com");
    expect(config.OVERPASS_CACHE_MAX_DISTANCE_METERS).toBe(2500);
    expect(config.TILE_ZOOM_RANGE).toEqual([16, 19]);
    expect(config.TILE_API_KEYS).toEqual(["key1", "key2"]);
  });

  it.each(["", "0", "-1", "not-a-number"])(
    "falls back to the default Overpass cache max distance for %s",
    (distance) => {
      const config = loadConfig({
        OVERPASS_CACHE_MAX_DISTANCE_METERS: distance,
      });

      expect(config.OVERPASS_CACHE_MAX_DISTANCE_METERS).toBe(1000);
    }
  );

  it("resolves TILE_RUNTIME_CONFIG_FILE as a directory or legacy file path", () => {
    const directoryConfig = loadConfig({
      TILE_RUNTIME_CONFIG_FILE: tempDir,
    });

    expect(directoryConfig.resolveRuntimeConfigPath()).toBe(
      path.join(process.cwd(), "data", "runtime-config.json")
    );
    expect(directoryConfig.TILE_RUNTIME_CONFIG_DIR).toBe(tempDir);
    expect(directoryConfig.TILE_RUNTIME_CONFIG_FILE).toBe(
      path.join(tempDir, "runtime-config.json")
    );

    const legacyFile = path.join(tempDir, "custom-runtime.json");
    const fileConfig = loadConfig({
      TILE_RUNTIME_CONFIG_FILE: legacyFile,
    });

    expect(fileConfig.TILE_RUNTIME_CONFIG_DIR).toBe(tempDir);
    expect(fileConfig.TILE_RUNTIME_CONFIG_FILE).toBe(legacyFile);
  });

  it.each([
    ["not-json"],
    ["[]"],
    ["[18]"],
    ["[18,17]"],
    ["[-1,18]"],
    ["[2,18]"],
    ["[18,21]"],
    ["[18,18.5]"],
    ['["18","19"]'],
  ])("rejects invalid TILE_ZOOM_RANGE %s", (range) => {
    expect(() => loadConfig({ TILE_ZOOM_RANGE: range })).toThrow(
      "TILE_ZOOM_RANGE must"
    );
  });

  it("updates the runtime tile zoom range", () => {
    const runtimeConfigFile = path.join(tempDir, "runtime-config.json");
    const config = loadConfig({
      TILE_ZOOM_RANGE: "[18,18]",
      TILE_RUNTIME_CONFIG_FILE: runtimeConfigFile,
    });

    expect(config.getTileZoomRange()).toEqual([18, 18]);
    expect(config.setTileZoomRange([18, 20])).toEqual([18, 20]);
    expect(config.TILE_ZOOM_RANGE).toEqual([18, 20]);
    expect(config.getTileZoomRange()).toEqual([18, 20]);
    expect(JSON.parse(fs.readFileSync(runtimeConfigFile, "utf8"))).toEqual({
      tileZoomRange: [18, 20],
    });
  });

  it("loads persisted tile zoom range before environment default", () => {
    const runtimeConfigFile = path.join(tempDir, "runtime-config.json");
    fs.writeFileSync(runtimeConfigFile, JSON.stringify({
      tileZoomRange: [17, 19],
    }));

    const config = loadConfig({
      TILE_ZOOM_RANGE: "[18,18]",
      TILE_RUNTIME_CONFIG_FILE: runtimeConfigFile,
    });

    expect(config.getTileZoomRange()).toEqual([17, 19]);
  });

  it("falls back to environment default when persisted tile zoom range is invalid", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const runtimeConfigFile = path.join(tempDir, "runtime-config.json");
    fs.writeFileSync(runtimeConfigFile, JSON.stringify({
      tileZoomRange: [19, 17],
    }));

    const config = loadConfig({
      TILE_ZOOM_RANGE: "[16,18]",
      TILE_RUNTIME_CONFIG_FILE: runtimeConfigFile,
    });

    expect(config.getTileZoomRange()).toEqual([16, 18]);
    expect(warn).toHaveBeenCalledWith(
      "Failed to load persisted tile zoom range:",
      expect.stringContaining("TILE_ZOOM_RANGE must")
    );
  });

  it("rejects invalid runtime tile zoom ranges", () => {
    const config = loadConfig();

    expect(() => config.setTileZoomRange([20, 18])).toThrow(
      "TILE_ZOOM_RANGE must"
    );
    expect(() => config.setTileZoomRange(undefined)).toThrow(
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
