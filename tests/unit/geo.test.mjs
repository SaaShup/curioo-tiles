import { describe, it, expect } from "vitest";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const geo = require("../../lib/geo.js");
const config = require("../../lib/config.js");

const {
  tile2bbox,
  getZoneForLatLon,
  getZoneFromTile,
  getCachePathForZone,
  project,
} = geo;

const { TILE_SIZE, ZONE_SIZE_DEGREES, CACHE_DIR } = config;

describe("geo", () => {
  it("exports all functions", () => {
    expect(typeof tile2bbox).toBe("function");
    expect(typeof getZoneForLatLon).toBe("function");
    expect(typeof getZoneFromTile).toBe("function");
    expect(typeof getCachePathForZone).toBe("function");
    expect(typeof project).toBe("function");
  });

  it("tile2bbox returns expected world bbox at zoom 0", () => {
    const bbox = tile2bbox(0, 0, 0);

    expect(bbox.lonMin).toBeCloseTo(-180);
    expect(bbox.lonMax).toBeCloseTo(180);
    expect(bbox.latMin).toBeCloseTo(-85.05112878);
    expect(bbox.latMax).toBeCloseTo(85.05112878);
  });

  it("tile2bbox returns valid bbox for zoom 18", () => {
    const bbox = tile2bbox(135540, 90176, 18);

    expect(bbox.latMin).toBeLessThan(bbox.latMax);
    expect(bbox.lonMin).toBeLessThan(bbox.lonMax);
  });

  it("getZoneForLatLon snaps positive coordinates to zone grid", () => {
    const zone = getZoneForLatLon(48.692, 6.184);

    expect(zone.latMin).toBeLessThanOrEqual(48.692);
    expect(zone.latMax).toBeGreaterThan(48.692);
    expect(zone.lonMin).toBeLessThanOrEqual(6.184);
    expect(zone.lonMax).toBeGreaterThan(6.184);

    expect(zone.latMax - zone.latMin).toBeCloseTo(ZONE_SIZE_DEGREES);
    expect(zone.lonMax - zone.lonMin).toBeCloseTo(ZONE_SIZE_DEGREES);
  });

  it("getZoneForLatLon snaps negative coordinates to zone grid", () => {
    const zone = getZoneForLatLon(-48.692, -6.184);

    expect(zone.latMin).toBeLessThanOrEqual(-48.692);
    expect(zone.latMax).toBeGreaterThan(-48.692);
    expect(zone.lonMin).toBeLessThanOrEqual(-6.184);
    expect(zone.lonMax).toBeGreaterThan(-6.184);

    expect(zone.latMax - zone.latMin).toBeCloseTo(ZONE_SIZE_DEGREES);
    expect(zone.lonMax - zone.lonMin).toBeCloseTo(ZONE_SIZE_DEGREES);
  });

  it("getZoneFromTile returns zone containing tile center", () => {
    const z = 18;
    const x = 135540;
    const y = 90176;

    const bbox = tile2bbox(x, y, z);
    const centerLat = (bbox.latMin + bbox.latMax) / 2;
    const centerLon = (bbox.lonMin + bbox.lonMax) / 2;

    const zone = getZoneFromTile(z, x, y);

    expect(centerLat).toBeGreaterThanOrEqual(zone.latMin);
    expect(centerLat).toBeLessThan(zone.latMax);
    expect(centerLon).toBeGreaterThanOrEqual(zone.lonMin);
    expect(centerLon).toBeLessThan(zone.lonMax);
  });

  it("getCachePathForZone returns expected cache path", () => {
    const zone = {
      latMin: 48.6,
      lonMin: 6.1,
      latMax: 48.7,
      lonMax: 6.2,
    };

    expect(getCachePathForZone(zone)).toBe(
      path.join(CACHE_DIR, "zone_48.6000_6.1000.json")
    );
  });

  it("project maps top-left corner", () => {
    const bbox = {
      latMin: 0,
      lonMin: 0,
      latMax: 1,
      lonMax: 1,
    };

    expect(project(1, 0, bbox)).toEqual({ x: 0, y: 0 });
  });

  it("project maps bottom-right corner", () => {
    const bbox = {
      latMin: 0,
      lonMin: 0,
      latMax: 1,
      lonMax: 1,
    };

    expect(project(0, 1, bbox)).toEqual({
      x: TILE_SIZE,
      y: TILE_SIZE,
    });
  });

  it("project maps center", () => {
    const bbox = {
      latMin: 0,
      lonMin: 0,
      latMax: 1,
      lonMax: 1,
    };

    expect(project(0.5, 0.5, bbox)).toEqual({
      x: TILE_SIZE / 2,
      y: TILE_SIZE / 2,
    });
  });
});