const express = require("express");
const { createTileHandler } = require("../lib/tile-handler");

function createTileRouter(previewThemes) {
  const router = express.Router();
  const handleTileRequest = createTileHandler(previewThemes);

  router.get("/:theme/:z/:x/:y.png", async (req, res) => {
    return handleTileRequest(req, res, req.params.theme);
  });

  router.get("/:z/:x/:y.png", async (req, res) => {
    return handleTileRequest(req, res, null);
  });

  return router;
}

module.exports = { createTileRouter };
