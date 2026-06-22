const fs = require("node:fs");
const zlib = require("node:zlib");
const { CACHE_DIR, OVERPASS_URL, debugLog } = require("./config");
const { getZonesFromTile, getZonesForBbox, getCachePathForZone } = require("./geo");
const { overpassRequests, overpassCache } = require("./metrics");

let overpassQueue = Promise.resolve();
const pendingZoneRequests = new Map();

function queuedOverpassFetch(bbox) {
  overpassQueue = overpassQueue
    .catch(() => {
      // Prevent one failed Overpass request from breaking the whole queue forever
    })
    .then(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return fetchOverpass(bbox);
    });

  return overpassQueue;
}

async function fetchOverpass(bbox) {
  const query = `
[out:json][timeout:25];
(
  way["natural"="water"](${bbox.latMin},${bbox.lonMin},${bbox.latMax},${bbox.lonMax});
  way["waterway"~"riverbank|river|stream|canal|ditch|drain"](${bbox.latMin},${bbox.lonMin},${bbox.latMax},${bbox.lonMax});
  way["landuse"="reservoir"](${bbox.latMin},${bbox.lonMin},${bbox.latMax},${bbox.lonMax});
  way["landuse"="forest"](${bbox.latMin},${bbox.lonMin},${bbox.latMax},${bbox.lonMax});
  way["natural"="wood"](${bbox.latMin},${bbox.lonMin},${bbox.latMax},${bbox.lonMax});
  node["natural"="tree"](${bbox.latMin},${bbox.lonMin},${bbox.latMax},${bbox.lonMax});
  way["natural"="tree_row"](${bbox.latMin},${bbox.lonMin},${bbox.latMax},${bbox.lonMax});
  way["leisure"="park"](${bbox.latMin},${bbox.lonMin},${bbox.latMax},${bbox.lonMax});
  way["landuse"="grass"](${bbox.latMin},${bbox.lonMin},${bbox.latMax},${bbox.lonMax});
  way["building"](${bbox.latMin},${bbox.lonMin},${bbox.latMax},${bbox.lonMax});
  way["highway"](${bbox.latMin},${bbox.lonMin},${bbox.latMax},${bbox.lonMax});
);
out geom;
`;

  const body = new URLSearchParams();
  body.set("data", query);

  const response = await fetch(`${OVERPASS_URL}/api/interpreter`, {
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

async function getOverpassDataForZone(zone) {
  const file = getCachePathForZone(zone);
  const brFile = `${file}.br`;

  if (fs.existsSync(brFile)) {
    overpassCache.inc({ result: "hit" });
    return readCachedOverpassDataForZone(zone);
  }

  const zoneKey = `${zone.latMin.toFixed(4)}_${zone.lonMin.toFixed(4)}`;

  if (pendingZoneRequests.has(zoneKey)) {
    debugLog("Waiting for existing Overpass zone:", zoneKey);
    return await pendingZoneRequests.get(zoneKey);
  }

  const promise = (async () => {
    try {
      debugLog("Fetching Overpass zone:", zoneKey, zone);
      overpassCache.inc({ result: "miss" });

      const data = await queuedOverpassFetch(zone);
      const json = JSON.stringify(data);
      const br = zlib.brotliCompressSync(Buffer.from(json));

      fs.writeFileSync(brFile, br);
      overpassRequests.inc({ status: "success" });
      return data;
    } catch (err) {
      console.error("Overpass failed, saving empty cache:", err.message);
      overpassRequests.inc({ status: "error" });

      const empty = { elements: [] };
      const json = JSON.stringify(empty);
      const br = zlib.brotliCompressSync(Buffer.from(json));

      fs.writeFileSync(brFile, br);
      return empty;
    } finally {
      pendingZoneRequests.delete(zoneKey);
    }
  })();

  pendingZoneRequests.set(zoneKey, promise);
  return await promise;
}

function readCachedOverpassDataForZone(zone) {
  const file = getCachePathForZone(zone);
  const brFile = `${file}.br`;

  if (!fs.existsSync(brFile)) {
    return null;
  }

  const compressed = fs.readFileSync(brFile);
  const json = zlib.brotliDecompressSync(compressed).toString("utf8");
  return JSON.parse(json);
}

function mergeOverpassData(zoneData) {
  const seen = new Set();
  const elements = [];

  for (const data of zoneData) {
    for (const element of data.elements || []) {
      const key = element.type && element.id
        ? `${element.type}:${element.id}`
        : JSON.stringify(element);

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      elements.push(element);
    }
  }

  return { elements };
}

function getBboxAroundLatLon(lat, lon, distanceMeters) {
  const metersPerDegreeLat = 111_320;
  const latDelta = distanceMeters / metersPerDegreeLat;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const lonDelta = Math.abs(cosLat) < 1e-12
    ? 180
    : distanceMeters / (metersPerDegreeLat * Math.abs(cosLat));

  return {
    latMin: Math.max(-90, lat - latDelta),
    lonMin: Math.max(-180, lon - lonDelta),
    latMax: Math.min(90, lat + latDelta),
    lonMax: Math.min(180, lon + lonDelta),
  };
}

function getCachedOverpassDataForPoint(lat, lon, distanceMeters) {
  const bbox = getBboxAroundLatLon(lat, lon, distanceMeters);
  const zones = getZonesForBbox(bbox);
  const zoneData = [];

  for (const zone of zones) {
    const data = readCachedOverpassDataForZone(zone);

    if (data) {
      zoneData.push(data);
    }
  }

  if (!zoneData.length) {
    return null;
  }

  return mergeOverpassData(zoneData);
}

async function getOverpassData(z, x, y) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const zones = getZonesFromTile(z, x, y);
  const zoneData = await Promise.all(
    zones.map((zone) => getOverpassDataForZone(zone))
  );

  return mergeOverpassData(zoneData);
}

module.exports = {
  fetchOverpass,
  getBboxAroundLatLon,
  getCachedOverpassDataForPoint,
  getOverpassData,
  getOverpassDataForZone,
  mergeOverpassData,
  readCachedOverpassDataForZone,
};
