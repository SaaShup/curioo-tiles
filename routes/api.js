const express = require("express");
const packageJson = require("../package.json");
const { loadThemes, saveThemes } = require("../lib/themes");
const { client } = require("../lib/metrics");
const { KEYCLOAK_URL, KEYCLOAK_REALM, TILE_ZOOM_RANGE, getTileApiKeys } = require("../lib/config");
const { keycloak, requireAllowedEditorEmail, makeInitials } = require("../lib/auth");

function createApiRouter(previewThemes) {
  const router = express.Router();

  router.get("/metrics", async (req, res) => {
    res.setHeader("Content-Type", client.register.contentType);
    res.send(await client.register.metrics());
  });

  router.get("/api/version", (req, res) => {
    res.json({ version: packageJson.version });
  });

  router.get("/api/config", (req, res) => {
    res.json({ tileZoomRange: TILE_ZOOM_RANGE });
  });

  router.get("/api/login", keycloak.protect(), (req, res) => {
    res.redirect("/editor");
  });

  router.get("/api/logout", (req, res) => {
    const redirectUri = encodeURIComponent(`${req.protocol}://${req.get("host")}/editor`);
    const idToken = req.kauth?.grant?.id_token?.token;

    if (!idToken) {
      req.session.destroy(() => res.redirect("/editor"));
      return;
    }

    req.session.destroy(() => {
      res.redirect(
        `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}` +
          `/protocol/openid-connect/logout` +
          `?id_token_hint=${encodeURIComponent(idToken)}` +
          `&post_logout_redirect_uri=${redirectUri}`
      );
    });
  });

  router.get("/api/me", (req, res) => {
    const token = req.kauth?.grant?.access_token?.content;

    if (!token) {
      return res.json({ authenticated: false });
    }

    const name = token.name || token.preferred_username || token.email || "User";

    res.json({
      authenticated: true,
      email: token.email,
      name,
      initials: makeInitials(name),
    });
  });

  router.get("/api/tile-api-keys", keycloak.protect(), (req, res) => {
    res.json({ keys: getTileApiKeys() });
  });

  router.get("/api/themes", (req, res) => {
    res.json(loadThemes());
  });

  router.put("/api/themes/:theme", keycloak.protect(), requireAllowedEditorEmail, (req, res) => {
    const themes = loadThemes();
    const themeName = req.params.theme.toLowerCase();

    themes[themeName] = req.body;
    saveThemes(themes);
    delete previewThemes[themeName];

    res.json({ ok: true, theme: themeName });
  });

  router.post("/api/preview-theme/:theme", requireAllowedEditorEmail, (req, res) => {
    const themeName = req.params.theme.toLowerCase();
    previewThemes[themeName] = req.body;
    res.json({ ok: true, preview: themeName });
  });

  router.delete("/api/preview-theme/:theme", requireAllowedEditorEmail, (req, res) => {
    const themeName = req.params.theme.toLowerCase();
    delete previewThemes[themeName];
    res.json({ ok: true, cleared: themeName });
  });

  return router;
}

module.exports = { createApiRouter };
