const fs = require("fs");
const zlib = require("zlib");
const { CACHE_DIR, OVERPASS_URL, debugLog } = require("./config");
const { getZoneFromTile, getCachePathForZone } = require("./geo");
const { overpassRequests, overpassCache } = require("./metrics");

let overpassQueue = Promise.resolve();
const pendingZoneRequests = new Map();

function queuedOverpassFetch(bbox) {
  overpassQueue = overpassQueue.then(async () => {
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

async function getOverpassData(z, x, y) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const zone = getZoneFromTile(z, x, y);
  const file = getCachePathForZone(zone);
  const brFile = `${file}.br`;

  if (fs.existsSync(brFile)) {
    overpassCache.inc({ result: "hit" });
    const compressed = fs.readFileSync(brFile);
    const json = zlib.brotliDecompressSync(compressed).toString("utf8");
    return JSON.parse(json);
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

module.exports = {
  fetchOverpass,
  getOverpassData,
};
