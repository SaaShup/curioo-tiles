import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequire } from "node:module";
import { PNG } from "pngjs";

const require = createRequire(import.meta.url);

const mockGetOverpassData = vi.fn();

const overpassPath = require.resolve("../../lib/overpass.js");
require.cache[overpassPath] = {
  id: overpassPath,
  filename: overpassPath,
  loaded: true,
  exports: {
    getOverpassData: mockGetOverpassData,
  },
};

const renderer = require("../../lib/renderer.js");
const config = require("../../lib/config.js");

const { roadWidth, drawOsmElement, generateTile } = renderer;
const { TILE_SIZE } = config;

function createPng() {
  return new PNG({ width: TILE_SIZE, height: TILE_SIZE });
}

const theme = {
  grass: [80, 160, 80, 255],
  darkGrass: [40, 100, 40, 255],
  lightGrass: [120, 200, 120, 255],

  water: [20, 100, 200, 255],
  waterLine: [10, 60, 160, 255],

  forest: [20, 120, 40, 255],
  forestLine: [10, 80, 30, 255],

  park: [90, 180, 90, 255],
  parkLine: [50, 130, 50, 255],

  building: [160, 140, 120, 255],
  buildingLine: [100, 90, 80, 255],

  roadOuter: [60, 60, 60, 255],
  roadInner: [220, 220, 220, 255],
  pathInner: [200, 180, 120, 255],
};

const tileBbox = {
  latMin: 0,
  lonMin: 0,
  latMax: 1,
  lonMax: 1,
};

const polygonGeometry = [
  { lat: 0.8, lon: 0.2 },
  { lat: 0.8, lon: 0.8 },
  { lat: 0.2, lon: 0.8 },
  { lat: 0.2, lon: 0.2 },
];

const lineGeometry = [
  { lat: 0.2, lon: 0.2 },
  { lat: 0.8, lon: 0.8 },
];

describe("renderer", () => {
  beforeEach(() => {
    mockGetOverpassData.mockReset();
  });

  it("roadWidth returns expected widths", () => {
    expect(roadWidth("motorway")).toBe(5);
    expect(roadWidth("trunk")).toBe(5);

    expect(roadWidth("primary")).toBe(4);
    expect(roadWidth("secondary")).toBe(4);

    expect(roadWidth("tertiary")).toBe(3);
    expect(roadWidth("residential")).toBe(3);

    expect(roadWidth("service")).toBe(2);
    expect(roadWidth("track")).toBe(2);
    expect(roadWidth("path")).toBe(2);
    expect(roadWidth("footway")).toBe(2);
    expect(roadWidth("cycleway")).toBe(2);
    expect(roadWidth("unknown")).toBe(2);
  });

  it("drawOsmElement ignores elements without geometry", () => {
    const png = createPng();

    expect(() => {
      drawOsmElement(png, { tags: { highway: "primary" } }, tileBbox, theme);
    }).not.toThrow();
  });

  it("drawOsmElement draws waterway line types", () => {
    const png = createPng();

    for (const waterway of ["river", "stream", "canal", "ditch"]) {
      expect(() => {
        drawOsmElement(
          png,
          {
            geometry: lineGeometry,
            tags: { waterway },
          },
          tileBbox,
          theme
        );
      }).not.toThrow();
    }
  });

  it("drawOsmElement draws water polygons", () => {
    const png = createPng();

    for (const tags of [
      { natural: "water" },
      { waterway: "riverbank" },
      { landuse: "reservoir" },
    ]) {
      expect(() => {
        drawOsmElement(
          png,
          {
            geometry: polygonGeometry,
            tags,
          },
          tileBbox,
          theme
        );
      }).not.toThrow();
    }
  });

  it("drawOsmElement draws nature polygons", () => {
    const png = createPng();

    for (const tags of [
      { landuse: "forest" },
      { natural: "wood" },
      { leisure: "park" },
      { landuse: "grass" },
    ]) {
      expect(() => {
        drawOsmElement(
          png,
          {
            geometry: polygonGeometry,
            tags,
          },
          tileBbox,
          theme
        );
      }).not.toThrow();
    }
  });

  it("drawOsmElement draws buildings", () => {
    const png = createPng();

    expect(() => {
      drawOsmElement(
        png,
        {
          geometry: polygonGeometry,
          tags: { building: "yes" },
        },
        tileBbox,
        theme
      );
    }).not.toThrow();
  });

  it("drawOsmElement draws roads and paths", () => {
    const png = createPng();

    for (const highway of ["primary", "residential", "path", "footway", "cycleway"]) {
      expect(() => {
        drawOsmElement(
          png,
          {
            geometry: lineGeometry,
            tags: { highway },
          },
          tileBbox,
          theme
        );
      }).not.toThrow();
    }
  });

  it("generateTile returns a PNG buffer", async () => {
    mockGetOverpassData.mockResolvedValue({
      elements: [],
    });

    const buffer = await generateTile(18, 135540, 90176, theme);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });

  it("generateTile renders all supported OSM element groups", async () => {
    mockGetOverpassData.mockResolvedValue({
      elements: [
        {
          geometry: polygonGeometry,
          tags: { natural: "water" },
        },
        {
          geometry: lineGeometry,
          tags: { waterway: "river" },
        },
        {
          geometry: polygonGeometry,
          tags: { landuse: "forest" },
        },
        {
          geometry: polygonGeometry,
          tags: { leisure: "park" },
        },
        {
          geometry: polygonGeometry,
          tags: { building: "yes" },
        },
        {
          geometry: lineGeometry,
          tags: { highway: "primary" },
        },
        {
          geometry: lineGeometry,
          tags: { highway: "path" },
        },
      ],
    });

    const buffer = await generateTile(18, 135540, 90176, theme);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });
});