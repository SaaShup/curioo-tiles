const client = require("prom-client");

client.collectDefaultMetrics();

const tileRequests = new client.Counter({
  name: "tile_requests_total",
  help: "Total tile requests",
  labelNames: ["theme", "status"],
});

const tileRenderDuration = new client.Histogram({
  name: "tile_render_duration_seconds",
  help: "Tile render duration in seconds",
  labelNames: ["theme"],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

const tileMemoryTiles = new client.Gauge({
  name: "tile_memory_tiles",
  help: "Current number of tiles being rendered in memory",
});

tileMemoryTiles.set(0);

const overpassRequests = new client.Counter({
  name: "overpass_requests_total",
  help: "Total Overpass requests",
  labelNames: ["status"],
});

const overpassCache = new client.Counter({
  name: "overpass_cache_total",
  help: "Overpass cache hits and misses",
  labelNames: ["result"],
});

module.exports = {
  client,
  tileRequests,
  tileRenderDuration,
  tileMemoryTiles,
  overpassRequests,
  overpassCache,
};
