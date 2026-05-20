const path = require("node:path");

const TILE_SIZE = 256;
const PORT = Number(process.env.PORT || 3000);
const CACHE_DIR = path.join(__dirname, "..", "cache");
const DEBUG = process.env.DEBUG === "true";

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || "https://connect.curioo.city";
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || "curioo";
const DEFAULT_THEME = (process.env.THEME || "forest").toLowerCase();

const ZONE_SIZE_DEGREES = 0.02;
const OVERPASS_URL = process.env.OVERPASS_URL || "https://overpass";

function parseTileZoomRange(envValue) {
  if (!envValue?.toString().trim()) {
    return [18, 18];
  }

  let parsed;

  try {
    parsed = JSON.parse(envValue);
  } catch (err) {
    throw new Error("TILE_ZOOM_RANGE must be a JSON array like [18,18]");
  }

  if (
    !Array.isArray(parsed) ||
    parsed.length !== 2 ||
    !Number.isInteger(parsed[0]) ||
    !Number.isInteger(parsed[1]) ||
    parsed[0] < 0 ||
    parsed[1] < parsed[0]
  ) {
    throw new Error("TILE_ZOOM_RANGE must be [from,to] with non-negative integers and to >= from");
  }

  return parsed;
}

function parseApiKeys(envValue) {
  if (!envValue?.toString().trim()) {
    return [];
  }

  let keys = [];

  try {
    const parsed = JSON.parse(envValue);
    if (Array.isArray(parsed)) {
      keys = parsed;
    }
  } catch (err) {
    console.warn("Failed to parse JSON, fallback to CSV:", err);
    keys = envValue.split(",");
  }

  return keys
    .map((key) => (key || "").toString().trim())
    .filter(Boolean);
}

const TILE_ZOOM_RANGE = parseTileZoomRange(process.env.TILE_ZOOM_RANGE);
const TILE_API_KEYS = parseApiKeys(process.env.TILE_API_KEYS);

function getTileApiKeys() {
  return parseApiKeys(process.env.TILE_API_KEYS);
}

function debugLog(...args) {
  if (DEBUG) console.log(...args);
}

module.exports = {
  TILE_SIZE,
  PORT,
  CACHE_DIR,
  DEBUG,
  KEYCLOAK_URL,
  KEYCLOAK_REALM,
  DEFAULT_THEME,
  ZONE_SIZE_DEGREES,
  OVERPASS_URL,
  TILE_ZOOM_RANGE,
  parseTileZoomRange,
  TILE_API_KEYS,
  getTileApiKeys,
  debugLog,
};
