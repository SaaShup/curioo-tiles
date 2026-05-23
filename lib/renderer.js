const sharp = require("sharp");
const { PNG } = require("pngjs");
const { TILE_SIZE } = require("./config");
const { tile2bbox, project } = require("./geo");
const { drawBackground, drawPolyline, drawTexturedPolygon } = require("./draw");
const { getOverpassData } = require("./overpass");

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

function getRoadInnerColor(highway, theme) {
  return ["path", "footway", "cycleway"].includes(highway)
    ? theme.pathInner
    : theme.roadInner;
}

function drawRoadElement(png, el, tileBbox, theme, layer = "all") {
  if (!el.geometry || !Array.isArray(el.geometry)) return;

  const tags = el.tags || {};
  if (!tags.highway) return;

  const points = el.geometry.map((p) => project(p.lat, p.lon, tileBbox));
  const width = roadWidth(tags.highway);

  if (layer === "all" || layer === "outer") {
    drawPolyline(png, points, width + 1, ...theme.roadOuter);
  }

  if (layer === "all" || layer === "inner") {
    drawPolyline(png, points, width, ...getRoadInnerColor(tags.highway, theme));
  }
}

function drawRoads(png, elements, tileBbox, theme) {
  const roads = elements.filter((el) => el.tags?.highway);

  roads.forEach((el) => drawRoadElement(png, el, tileBbox, theme, "outer"));
  roads.forEach((el) => drawRoadElement(png, el, tileBbox, theme, "inner"));
}

function drawOsmElement(png, el, tileBbox, theme) {
  if (!el.geometry || !Array.isArray(el.geometry)) return;

  const tags = el.tags || {};
  const points = el.geometry.map((p) => project(p.lat, p.lon, tileBbox));

  if (["river", "stream", "canal", "ditch"].includes(tags.waterway)) {
    let width = 1;
    if (tags.waterway === "river") {
      width = 3;
    } else if (tags.waterway === "canal") {
      width = 2;
    }
    drawPolyline(png, points, width + 1, ...theme.waterLine);
    drawPolyline(png, points, width, ...theme.water);
    return;
  }

  if (tags.natural === "water" || tags.waterway === "riverbank" || tags.landuse === "reservoir") {
    drawTexturedPolygon(png, points, theme.water, {
      seed: 20,
      variation: 12,
      patchScale: 30,
      dotChance: 0.008,
      darken: 12,
      lighten: 8,
    });
    drawPolyline(png, points, 1, ...theme.waterLine);
    return;
  }

  if (tags.landuse === "forest" || tags.natural === "wood") {
    drawTexturedPolygon(png, points, theme.forest, {
      seed: 30,
      variation: 24,
      patchScale: 16,
      dotChance: 0.035,
      darken: 24,
      lighten: 12,
    });
    drawPolyline(png, points, 1, ...theme.forestLine);
    return;
  }

  if (tags.leisure === "park" || tags.landuse === "grass") {
    drawTexturedPolygon(png, points, theme.park, {
      seed: 40,
      variation: 18,
      patchScale: 22,
      dotChance: 0.018,
      darken: 14,
      lighten: 12,
    });
    drawPolyline(png, points, 1, ...theme.parkLine);
    return;
  }

  if (tags.building) {
    drawTexturedPolygon(png, points, theme.building, {
      seed: 50,
      variation: 8,
      patchScale: 12,
      dotChance: 0.004,
      darken: 8,
      lighten: 6,
    });
    drawPolyline(png, points, 1, ...theme.buildingLine);
    return;
  }

  if (tags.highway) {
    drawRoadElement(png, el, tileBbox, theme);
  }
}

function isWaterElement(tags) {
  return tags.natural === "water" ||
    tags.waterway === "riverbank" ||
    tags.waterway === "river" ||
    tags.waterway === "stream" ||
    tags.waterway === "canal" ||
    tags.waterway === "ditch" ||
    tags.landuse === "reservoir";
}

function isNatureElement(tags) {
  return tags.landuse === "forest" ||
    tags.natural === "wood" ||
    tags.leisure === "park" ||
    tags.landuse === "grass";
}

async function generateTile(z, x, y, theme) {
  const png = new PNG({ width: TILE_SIZE, height: TILE_SIZE });
  const tileBbox = tile2bbox(x, y, z);

  drawBackground(png, x, y, theme);

  const data = await getOverpassData(z, x, y);
  const elements = data.elements || [];

  elements.forEach((el) => isWaterElement(el.tags || {}) && drawOsmElement(png, el, tileBbox, theme));
  elements.forEach((el) => isNatureElement(el.tags || {}) && drawOsmElement(png, el, tileBbox, theme));
  elements.forEach((el) => el.tags?.building && drawOsmElement(png, el, tileBbox, theme));
  drawRoads(png, elements, tileBbox, theme);

  return sharp(png.data, {
    raw: {
      width: TILE_SIZE,
      height: TILE_SIZE,
      channels: 4,
    },
  })
    .png({
      compressionLevel: 9,
      palette: true,
    })
    .toBuffer();
}

module.exports = {
  roadWidth,
  drawRoadElement,
  drawRoads,
  drawOsmElement,
  generateTile,
};
