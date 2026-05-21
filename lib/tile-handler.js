const { loadThemes } = require("./themes");
const { DEFAULT_THEME, getTileZoomRange } = require("./config");
const { tileRequests, tileRenderDuration, tileMemoryTiles } = require("./metrics");
const { generateTile } = require("./renderer");

function isZoomSupported(z) {
  const [minZoom, maxZoom] = getTileZoomRange();
  return z >= minZoom && z <= maxZoom;
}

const UNSUPPORTED_ZOOM_MESSAGE = "Unsupported zoom level";

function createTileHandler(previewThemes) {
  return async function handleTileRequest(req, res, themeName) {
    const z = Number(req.params.z);
    const x = Number(req.params.x);
    const y = Number(req.params.y);

    if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y)) {
      return res.status(400).send("Invalid tile coordinates");
    }

    if (!isZoomSupported(z)) {
      return res.status(404).send(UNSUPPORTED_ZOOM_MESSAGE);
    }

    const THEMES = loadThemes();
    const finalThemeName = (themeName || DEFAULT_THEME).toLowerCase();

    const theme =
      previewThemes[finalThemeName] ||
      THEMES[finalThemeName] ||
      THEMES[DEFAULT_THEME] ||
      THEMES.forest;

    const end = tileRenderDuration.startTimer({ theme: finalThemeName });
    tileMemoryTiles.inc();

    try {
      const buffer = await generateTile(z, x, y, theme);
      tileRequests.inc({ theme: finalThemeName, status: "success" });
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.send(buffer);
    } catch (err) {
      tileRequests.inc({ theme: finalThemeName, status: "error" });
      console.error("Tile render failed:", err);
      res.status(500).send("Tile render failed");
    } finally {
      tileMemoryTiles.dec();
      end();
    }
  };
}

module.exports = { createTileHandler, isZoomSupported, UNSUPPORTED_ZOOM_MESSAGE };
