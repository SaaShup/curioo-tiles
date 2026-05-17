const express = require("express");
const { createTileHandler } = require("../lib/tile-handler");
const { getTileApiKeys } = require("../lib/config");

function getRequestedApiKey(req) {
  return (
    req.query.key ||
    req.query.apikey ||
    req.query.api_key ||
    ""
  ).toString();
}

function isApiKeyValid(req) {
  const configuredKeys = getTileApiKeys();
  if (!configuredKeys.length) {
    return true;
  }

  const requestedKey = getRequestedApiKey(req).trim();
  return configuredKeys.includes(requestedKey);
}

function rejectUnauthorized(req, res) {
  return res.status(401).send("Unauthorized API key");
}

function createTileRouter(previewThemes) {
  const router = express.Router();
  const handleTileRequest = createTileHandler(previewThemes);

  router.get("/:theme/:z/:x/:y.png", async (req, res) => {
    if (!isApiKeyValid(req)) {
      return rejectUnauthorized(req, res);
    }
    return handleTileRequest(req, res, req.params.theme);
  });

  router.get("/:z/:x/:y.png", async (req, res) => {
    if (!isApiKeyValid(req)) {
      return rejectUnauthorized(req, res);
    }
    return handleTileRequest(req, res, null);
  });

  return router;
}

module.exports = { createTileRouter };
