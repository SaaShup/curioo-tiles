import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const draw = require("../../lib/draw.js");
const config = require("../../lib/config.js");

const {
  clampColor,
  drawPixel,
  noise,
  drawBackground,
  drawLine,
  drawPolyline,
  pointInPolygon,
  drawTexturedPolygon,
} = draw;

const { TILE_SIZE } = config;

function createPng() {
  return {
    data: Buffer.alloc(TILE_SIZE * TILE_SIZE * 4),
  };
}

function getPixel(png, x, y) {
  const idx = (y * TILE_SIZE + x) << 2;
  return [
    png.data[idx],
    png.data[idx + 1],
    png.data[idx + 2],
    png.data[idx + 3],
  ];
}

describe("draw", () => {
  it("clampColor clamps and rounds values", () => {
    expect(clampColor(-10)).toBe(0);
    expect(clampColor(260)).toBe(255);
    expect(clampColor(12.6)).toBe(13);
  });

  it("drawPixel writes a pixel inside bounds", () => {
    const png = createPng();

    drawPixel(png, 10, 20, 12.6, -5, 300, 128.4);

    expect(getPixel(png, 10, 20)).toEqual([13, 0, 255, 128]);
  });

  it("drawPixel ignores pixels outside bounds", () => {
    const png = createPng();

    drawPixel(png, -1, 0, 255, 255, 255, 255);
    drawPixel(png, TILE_SIZE, 0, 255, 255, 255, 255);
    drawPixel(png, 0, -1, 255, 255, 255, 255);
    drawPixel(png, 0, TILE_SIZE, 255, 255, 255, 255);

    expect([...png.data]).toEqual([...Buffer.alloc(TILE_SIZE * TILE_SIZE * 4)]);
  });

  it("noise returns deterministic values between 0 and 1", () => {
    const a = noise(10, 20, 1);
    const b = noise(10, 20, 1);
    const c = noise(10, 20, 2);

    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(1);
    expect(c).not.toBe(a);
  });

  it("drawBackground fills the full tile", () => {
    const png = createPng();

    const theme = {
      grass: [80, 160, 80, 255],
      darkGrass: [40, 100, 40, 255],
      lightGrass: [120, 200, 120, 255],
    };

    drawBackground(png, 0, 0, theme);

    expect(getPixel(png, 0, 0)[3]).toBe(255);
    expect(getPixel(png, TILE_SIZE - 1, TILE_SIZE - 1)[3]).toBe(255);
  });

  it("drawLine draws horizontal and diagonal lines", () => {
    const png = createPng();

    drawLine(png, 1, 1, 5, 1, 1, 255, 0, 0, 255);
    drawLine(png, 10, 10, 13, 13, 1, 0, 255, 0, 255);

    expect(getPixel(png, 1, 1)).toEqual([255, 0, 0, 255]);
    expect(getPixel(png, 5, 1)).toEqual([255, 0, 0, 255]);
    expect(getPixel(png, 10, 10)).toEqual([0, 255, 0, 255]);
    expect(getPixel(png, 13, 13)).toEqual([0, 255, 0, 255]);
  });

  it("drawLine draws vertical line", () => {
    const png = createPng();

    drawLine(png, 4, 2, 4, 8, 1, 10, 20, 30, 255);

    expect(getPixel(png, 4, 2)).toEqual([10, 20, 30, 255]);
    expect(getPixel(png, 4, 8)).toEqual([10, 20, 30, 255]);
  });

  it("drawPolyline draws connected segments", () => {
    const png = createPng();

    drawPolyline(
      png,
      [
        { x: 1, y: 1 },
        { x: 5, y: 1 },
        { x: 5, y: 5 },
      ],
      1,
      20,
      30,
      40,
      255
    );

    expect(getPixel(png, 1, 1)).toEqual([20, 30, 40, 255]);
    expect(getPixel(png, 5, 1)).toEqual([20, 30, 40, 255]);
    expect(getPixel(png, 5, 5)).toEqual([20, 30, 40, 255]);
  });

  it("pointInPolygon detects inside and outside points", () => {
    const polygon = [
      { x: 10, y: 10 },
      { x: 50, y: 10 },
      { x: 50, y: 50 },
      { x: 10, y: 50 },
    ];

    expect(pointInPolygon(20, 20, polygon)).toBe(true);
    expect(pointInPolygon(5, 5, polygon)).toBe(false);
  });

  it("drawTexturedPolygon ignores polygons with less than 3 points", () => {
    const png = createPng();

    drawTexturedPolygon(
      png,
      [
        { x: 1, y: 1 },
        { x: 5, y: 5 },
      ],
      [255, 0, 0, 255]
    );

    expect([...png.data]).toEqual([...Buffer.alloc(TILE_SIZE * TILE_SIZE * 4)]);
  });

  it("drawTexturedPolygon fills inside polygon with default options", () => {
    const png = createPng();

    const polygon = [
      { x: 10, y: 10 },
      { x: 40, y: 10 },
      { x: 40, y: 40 },
      { x: 10, y: 40 },
    ];

    drawTexturedPolygon(png, polygon, [100, 120, 140, 255]);

    expect(getPixel(png, 20, 20)[3]).toBe(255);
    expect(getPixel(png, 5, 5)).toEqual([0, 0, 0, 0]);
  });

  it("drawTexturedPolygon supports alpha override and clipped bounds", () => {
    const png = createPng();

    const polygon = [
      { x: -10, y: -10 },
      { x: 20, y: -10 },
      { x: 20, y: 20 },
      { x: -10, y: 20 },
    ];

    drawTexturedPolygon(png, polygon, [100, 120, 140, 255], {
      alpha: 123,
      dotChance: 0,
      variation: 0,
      darken: 0,
      lighten: 0,
    });

    expect(getPixel(png, 5, 5)[3]).toBe(123);
  });
});