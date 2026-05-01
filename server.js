const express = require("express");
const { PNG } = require("pngjs");
const fs = require("fs");
const path = require("path");

const app = express();

const TILE_SIZE = 256;
const PORT = 3000;
const CACHE_DIR = path.join(__dirname, "cache");

const ZONE_SIZE_DEGREES = 0.02;
const OVERPASS_URL =
  process.env.OVERPASS_URL || "http://overpass";

let overpassQueue = Promise.resolve();

const pendingZoneRequests = new Map();

function queuedOverpassFetch(bbox) {
  overpassQueue = overpassQueue.then(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return fetchOverpass(bbox);
  });

  return overpassQueue;
}

function drawPixel(png, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= TILE_SIZE || y < 0 || y >= TILE_SIZE) return;

  const idx = (y * TILE_SIZE + x) << 2;
  png.data[idx] = r;
  png.data[idx + 1] = g;
  png.data[idx + 2] = b;
  png.data[idx + 3] = a;
}

function noise(x, y, seed = 0) {
  let n = x * 374761393 + y * 668265263 + seed * 1442695041;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

function lerp(a, b, t) {
  return a * (1 - t) + b * t;
}

function drawBackground(png, tileX, tileY) {
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const wx = tileX * TILE_SIZE + x;
      const wy = tileY * TILE_SIZE + y;

      const small = noise(Math.floor(wx / 6), Math.floor(wy / 6), 1);
      const patches = noise(Math.floor(wx / 28), Math.floor(wy / 28), 2);
      const mud = noise(Math.floor(wx / 40), Math.floor(wy / 40), 3);
      const mudType = noise(Math.floor(wx / 80), Math.floor(wy / 80), 4);
      const dots = noise(wx, wy, 99);

      let r = 115;
      let g = 175;
      let b = 85;
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
        r = 45;
        g = 120;
        b = 45;
      }

      if (dots < 0.01) {
        r = 150;
        g = 205;
        b = 90;
      }
      if (mud > 0.65) {
        const blend = Math.min((mud - 0.65) * 3, 1);
        let mudR, mudG, mudB;
        if (mudType < 0.33) {
          mudR = 95;
          mudG = 70;
          mudB = 50;
        } else if (mudType < 0.66) {
          mudR = 150;
          mudG = 95;
          mudB = 65;
        } else {
          mudR = 170;
          mudG = 150;
          mudB = 95;
        }
        mudR += Math.floor(small * 15);
        mudG += Math.floor(small * 10);
        mudB += Math.floor(small * 8);
        r = lerp(r, mudR, blend);
        g = lerp(g, mudG, blend);
        b = lerp(b, mudB, blend);
      }
      drawPixel(png, x, y, r, g, b);
    }
  }
}

function tile2bbox(x, y, z) {
  const n = Math.pow(2, z);
  const lonMin = (x / n) * 360 - 180;
  const lonMax = ((x + 1) / n) * 360 - 180;
  const latMin =
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * 180) /
    Math.PI;
  const latMax =
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) /
    Math.PI;
  return { latMin, lonMin, latMax, lonMax };
}

function getZoneForLatLon(lat, lon) {
  const zoneLat = Math.floor(lat / ZONE_SIZE_DEGREES) * ZONE_SIZE_DEGREES;
  const zoneLon = Math.floor(lon / ZONE_SIZE_DEGREES) * ZONE_SIZE_DEGREES;
  return {
    latMin: zoneLat,
    lonMin: zoneLon,
    latMax: zoneLat + ZONE_SIZE_DEGREES,
    lonMax: zoneLon + ZONE_SIZE_DEGREES,
  };
}

function getZoneFromTile(z, x, y) {
  const bbox = tile2bbox(x, y, z);
  const centerLat = (bbox.latMin + bbox.latMax) / 2;
  const centerLon = (bbox.lonMin + bbox.lonMax) / 2;

  return getZoneForLatLon(centerLat, centerLon);
}

function getCachePathForZone(zone) {
  const latKey = zone.latMin.toFixed(4);
  const lonKey = zone.lonMin.toFixed(4);
  return path.join(CACHE_DIR, `zone_${latKey}_${lonKey}.json`);
}

function project(lat, lon, bbox) {
  const x = ((lon - bbox.lonMin) / (bbox.lonMax - bbox.lonMin)) * TILE_SIZE;
  const y = ((bbox.latMax - lat) / (bbox.latMax - bbox.latMin)) * TILE_SIZE;

  return {
    x: Math.round(x),
    y: Math.round(y),
  };
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
    drawLine(
      png,
      points[i].x,
      points[i].y,
      points[i + 1].x,
      points[i + 1].y,
      width,
      r,
      g,
      b,
      a
    );
  }
}

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + 0.000001) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function drawPolygon(png, points, r, g, b, a = 255) {
  if (points.length < 3) return;
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
      if (pointInPolygon(x, y, points)) {
        drawPixel(png, x, y, r, g, b, a);
      }
    }
  }
}

async function fetchOverpass(bbox) {
  const query = `
[out:json][timeout:25];
(
  way["natural"="water"](${bbox.latMin},${bbox.lonMin},${bbox.latMax},${bbox.lonMax});
  way["waterway"="riverbank"](${bbox.latMin},${bbox.lonMin},${bbox.latMax},${bbox.lonMax});
  way["natural"="river"](${bbox.latMin},${bbox.lonMin},${bbox.latMax},${bbox.lonMax});
  way["natural"="steam"](${bbox.latMin},${bbox.lonMin},${bbox.latMax},${bbox.lonMax});
  way["natural"="canal"](${bbox.latMin},${bbox.lonMin},${bbox.latMax},${bbox.lonMax});
  way["natural"="ditch"](${bbox.latMin},${bbox.lonMin},${bbox.latMax},${bbox.lonMax});
  way["landuse"="reservoir"](${bbox.latMin},${bbox.lonMin},${bbox.latMax},${bbox.lonMax});
  way["landuse"="forest"](${bbox.latMin},${bbox.lonMin},${bbox.latMax},${bbox.lonMax});
  way["natural"="wood"](${bbox.latMin},${bbox.lonMin},${bbox.latMax},${bbox.lonMax});
  way["leisure"="park"](${bbox.latMin},${bbox.lonMin},${bbox.latMax},${bbox.lonMax});
  way["landuse"="grass"](${bbox.latMin},${bbox.lonMin},${bbox.latMax},${bbox.lonMax});
);
out geom;
`;
  const body = new URLSearchParams();
  body.set("data", query);
  const response = await fetch(OVERPASS_URL + "/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "CuriooCityTileServer/1.0",
    },
    body,
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(text);
    throw new Error(`Overpass error: ${response.status}`);
  }
  return JSON.parse(text);
}

async function getOverpassData(z, x, y) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const zone = getZoneFromTile(z, x, y);
  const file = getCachePathForZone(zone);
  if (fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  }
  const zoneKey = `${zone.latMin.toFixed(4)}_${zone.lonMin.toFixed(4)}`;
  if (pendingZoneRequests.has(zoneKey)) {
    console.log("Waiting for existing Overpass zone:", zoneKey);
    return await pendingZoneRequests.get(zoneKey);
  }
  const promise = (async () => {
    try {
      console.log("Fetching Overpass zone:", zoneKey, zone);
      const data = await queuedOverpassFetch(zone);
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
      return data;
    } catch (err) {
      console.error("Overpass failed, saving empty cache:", err.message);
      const empty = { elements: [] };
      fs.writeFileSync(file, JSON.stringify(empty, null, 2));
      return empty;
    } finally {
      pendingZoneRequests.delete(zoneKey);
    }
  })();
  pendingZoneRequests.set(zoneKey, promise);
  return await promise;
}

function roadWidth(highway) {
  switch (highway) {
    case "motorway":
    case "trunk":
      return 5;
    case "primary":
    case "secondary":
      return 4;
    case "tertiary":
    case "residential":
      return 3;
    case "service":
    case "track":
    case "path":
    case "footway":
    case "cycleway":
      return 2;
    default:
      return 2;
  }
}

function drawOsmElement(png, el, tileBbox) {
  if (!el.geometry || !Array.isArray(el.geometry)) return;
  const tags = el.tags || {};
  const points = el.geometry.map((p) => project(p.lat, p.lon, tileBbox));
  if (
    tags.waterway === "river" ||
    tags.waterway === "stream" ||
    tags.waterway === "canal" ||
    tags.waterway === "ditch"
  ) {
    const width =
      tags.waterway === "river" ? 3 :
      tags.waterway === "canal" ? 2 :
      1;

    drawPolyline(png, points, width + 1, 45, 115, 170);
    drawPolyline(png, points, width, 80, 165, 215);
    return;
  }
  if (
    tags.natural === "water" ||
    tags.waterway === "riverbank" ||
    tags.landuse === "reservoir"
  ) {
    drawPolygon(png, points, 70, 145, 195);
    drawPolyline(png, points, 1, 45, 115, 170);
    return;
  }
  if (tags.landuse === "forest" || tags.natural === "wood") {
    drawPolygon(png, points, 55, 125, 65);
    drawPolyline(png, points, 1, 35, 95, 45);
    return;
  }
  if (tags.leisure === "park" || tags.landuse === "grass") {
    drawPolygon(png, points, 105, 170, 85);
    drawPolyline(png, points, 1, 75, 140, 65);
    return;
  }
  if (tags.building) {
    drawPolygon(png, points, 185, 165, 135);
    drawPolyline(png, points, 1, 130, 115, 95);
    return;
  }
  if (tags.highway) {
    const width = roadWidth(tags.highway);
    drawPolyline(png, points, width + 1, 125, 120, 110);
    if (
      tags.highway === "path" ||
      tags.highway === "footway" ||
      tags.highway === "cycleway"
    ) {
      drawPolyline(png, points, width, 215, 205, 165);
    } else {
      drawPolyline(png, points, width, 225, 215, 185);
    }
  }
}

async function generateTile(z, x, y) {
  const png = new PNG({
    width: TILE_SIZE,
    height: TILE_SIZE,
  });
  const tileBbox = tile2bbox(x, y, z);
  drawBackground(png,x,y);
  const data = await getOverpassData(z, x, y);
  const elements = data.elements || [];
  elements.forEach((el) => {
    const tags = el.tags || {};
    if (
      tags.natural === "water" ||
      tags.waterway === "riverbank" ||
      tags.waterway === "river" ||
      tags.waterway === "stream" ||
      tags.waterway === "canal" ||
      tags.waterway === "ditch" ||
      tags.landuse === "reservoir"
    ) {
      drawOsmElement(png, el, tileBbox);
    }
  });
  elements.forEach((el) => {
    const tags = el.tags || {};
    if (
      tags.landuse === "forest" ||
      tags.natural === "wood" ||
      tags.leisure === "park" ||
      tags.landuse === "grass"
    ) {
      drawOsmElement(png, el, tileBbox);
    }
  });
  elements.forEach((el) => {
    if (el.tags && el.tags.building) {
      drawOsmElement(png, el, tileBbox);
    }
  });
  elements.forEach((el) => {
    if (el.tags && el.tags.highway) {
      drawOsmElement(png, el, tileBbox);
    }
  });
  return PNG.sync.write(png);
}

app.get("/:z/:x/:y.png", async (req, res) => {
  const z = Number(req.params.z);
  const x = Number(req.params.x);
  const y = Number(req.params.y);
  if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y)) {
    return res.status(400).send("Invalid tile coordinates");
  }
  if (z < 15 || z > 18) {
    return res.status(404).send("Only zoom 15 to 18 supported");
  }
  const buffer = await generateTile(z, x, y);
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.send(buffer);
});

app.listen(PORT, () => {
  console.log(`Tile server running on http://localhost:${PORT}/{z}/{x}/{y}.png`);
});
