const { TILE_SIZE, ZONE_SIZE_DEGREES, CACHE_DIR } = require("./config");
const path = require("path");

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
  return { x: Math.round(x), y: Math.round(y) };
}

module.exports = {
  tile2bbox,
  getZoneForLatLon,
  getZoneFromTile,
  getCachePathForZone,
  project,
};
