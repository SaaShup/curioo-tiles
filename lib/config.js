const fs = require("node:fs");
const path = require("node:path");

const TILE_SIZE = 256;
const PORT = Number(process.env.PORT || 3000);
const CACHE_DIR = path.join(__dirname, "..", "cache");
const TILE_RUNTIME_CONFIG_FILE =
  process.env.TILE_RUNTIME_CONFIG_FILE ||
  path.join(__dirname, "..", "runtime-config.json");
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
  } catch {
    throw new Error("TILE_ZOOM_RANGE must be a JSON array like [18,18]");
  }

  return validateTileZoomRange(parsed);
}

function validateTileZoomRange(parsed) {
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 2 ||
    !Number.isInteger(parsed[0]) ||
    !Number.isInteger(parsed[1]) ||
    parsed[0] < 3 ||
    parsed[1] > 20 ||
    parsed[1] < parsed[0]
  ) {
    throw new Error("TILE_ZOOM_RANGE must be [from,to] with integers where from >= 3, to <= 20, and to >= from");
  }

  return [parsed[0], parsed[1]];
}

function loadPersistedTileZoomRange(defaultRange) {
  if (!fs.existsSync(TILE_RUNTIME_CONFIG_FILE)) {
    return defaultRange;
  }

  try {
    const persisted = JSON.parse(fs.readFileSync(TILE_RUNTIME_CONFIG_FILE, "utf8"));
    return validateTileZoomRange(persisted.tileZoomRange);
  } catch (err) {
    console.warn("Failed to load persisted tile zoom range:", err.message);
    return defaultRange;
  }
}

function savePersistedTileZoomRange(range) {
  fs.mkdirSync(path.dirname(TILE_RUNTIME_CONFIG_FILE), { recursive: true });
  fs.writeFileSync(
    TILE_RUNTIME_CONFIG_FILE,
    JSON.stringify({ tileZoomRange: range }, null, 2)
  );
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

let tileZoomRange = loadPersistedTileZoomRange(
  parseTileZoomRange(process.env.TILE_ZOOM_RANGE)
);
const TILE_API_KEYS = parseApiKeys(process.env.TILE_API_KEYS);

function getTileZoomRange() {
  return [...tileZoomRange];
}

function setTileZoomRange(range) {
  const nextRange = validateTileZoomRange(range);
  savePersistedTileZoomRange(nextRange);
  tileZoomRange = nextRange;
  return getTileZoomRange();
}

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
  TILE_RUNTIME_CONFIG_FILE,
  DEBUG,
  KEYCLOAK_URL,
  KEYCLOAK_REALM,
  DEFAULT_THEME,
  ZONE_SIZE_DEGREES,
  OVERPASS_URL,
  get TILE_ZOOM_RANGE() {
    return getTileZoomRange();
  },
  parseTileZoomRange,
  validateTileZoomRange,
  loadPersistedTileZoomRange,
  savePersistedTileZoomRange,
  getTileZoomRange,
  setTileZoomRange,
  TILE_API_KEYS,
  getTileApiKeys,
  debugLog,
};
