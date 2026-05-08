const { loadThemes } = require("./themes");
const { DEFAULT_THEME } = require("./config");
const { tileRequests, tileRenderDuration } = require("./metrics");
const { generateTile } = require("./renderer");

function createTileHandler(previewThemes) {
  return async function handleTileRequest(req, res, themeName) {
    const z = Number(req.params.z);
    const x = Number(req.params.x);
    const y = Number(req.params.y);

    if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y)) {
      return res.status(400).send("Invalid tile coordinates");
    }

    if (z !== 18) {
      return res.status(404).send("Only zoom 18 supported");
    }

    const THEMES = loadThemes();
    const finalThemeName = (themeName || DEFAULT_THEME).toLowerCase();

    const theme =
      previewThemes[finalThemeName] ||
      THEMES[finalThemeName] ||
      THEMES[DEFAULT_THEME] ||
      THEMES.forest;

    const end = tileRenderDuration.startTimer({ theme: finalThemeName });

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
      end();
    }
  };
}

module.exports = { createTileHandler };
