const { TILE_SIZE } = require("./config");

function clampColor(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function drawPixel(png, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= TILE_SIZE || y < 0 || y >= TILE_SIZE) return;
  const idx = (y * TILE_SIZE + x) << 2;
  png.data[idx] = clampColor(r);
  png.data[idx + 1] = clampColor(g);
  png.data[idx + 2] = clampColor(b);
  png.data[idx + 3] = clampColor(a);
}

function noise(x, y, seed = 0) {
  let n = x * 374761393 + y * 668265263 + seed * 1442695041;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

function drawBackground(png, tileX, tileY, theme) {
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const wx = tileX * TILE_SIZE + x;
      const wy = tileY * TILE_SIZE + y;

      const small = noise(Math.floor(wx / 6), Math.floor(wy / 6), 1);
      const patches = noise(Math.floor(wx / 28), Math.floor(wy / 28), 2);
      const dots = noise(wx, wy, 99);

      let [r, g, b, a = 255] = theme.grass;

      r += Math.floor(small * 26) - 13;
      g += Math.floor(small * 34) - 17;
      b += Math.floor(small * 20) - 10;

      if (patches > 0.62) {
        r -= 14;
        g -= 22;
      }

      if (patches < 0.25) {
        r += 12;
        g += 18;
      }

      if (dots > 0.985) {
        [r, g, b, a = 255] = theme.darkGrass;
      }

      if (dots < 0.01) {
        [r, g, b, a = 255] = theme.lightGrass;
      }

      drawPixel(png, x, y, r, g, b, a);
    }
  }
}

function drawLine(png, x0, y0, x1, y1, width, r, g, b, a = 255) {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    for (let yy = -width; yy <= width; yy++) {
      for (let xx = -width; xx <= width; xx++) {
        if (xx * xx + yy * yy <= width * width) {
          drawPixel(png, x0 + xx, y0 + yy, r, g, b, a);
        }
      }
    }

    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function drawPolyline(png, points, width, r, g, b, a = 255) {
  for (let i = 0; i < points.length - 1; i++) {
    drawLine(png, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y, width, r, g, b, a);
  }
}

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.000001) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function drawTexturedPolygon(png, points, baseColor, options = {}) {
  if (points.length < 3) return;

  const {
    seed = 1,
    variation = 18,
    patchScale = 20,
    dotChance = 0.015,
    darken = 18,
    lighten = 14,
    alpha,
  } = options;

  let minX = TILE_SIZE;
  let minY = TILE_SIZE;
  let maxX = 0;
  let maxY = 0;

  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  minX = Math.max(0, minX);
  minY = Math.max(0, minY);
  maxX = Math.min(TILE_SIZE - 1, maxX);
  maxY = Math.min(TILE_SIZE - 1, maxY);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!pointInPolygon(x, y, points)) continue;

      const small = noise(Math.floor(x / 4), Math.floor(y / 4), seed);
      const patches = noise(Math.floor(x / patchScale), Math.floor(y / patchScale), seed + 10);
      const dots = noise(x, y, seed + 99);

      let [r, g, b, a = 255] = baseColor;
      if (alpha !== undefined) a = alpha;

      r += Math.floor(small * variation) - variation / 2;
      g += Math.floor(small * variation) - variation / 2;
      b += Math.floor(small * variation) - variation / 2;

      if (patches > 0.7) {
        r -= darken;
        g -= darken;
        b -= darken;
      }

      if (patches < 0.25) {
        r += lighten;
        g += lighten;
        b += lighten;
      }

      if (dots > 1 - dotChance) {
        r -= 25;
        g -= 25;
        b -= 25;
      }

      drawPixel(png, x, y, r, g, b, a);
    }
  }
}

module.exports = {
  clampColor,
  drawPixel,
  noise,
  drawBackground,
  drawLine,
  drawPolyline,
  pointInPolygon,
  drawTexturedPolygon,
};
