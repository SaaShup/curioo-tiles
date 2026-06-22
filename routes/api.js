const express = require("express");
const packageJson = require("../package.json");
const { loadThemes, saveTheme } = require("../lib/themes");
const { client } = require("../lib/metrics");
const { KEYCLOAK_URL, KEYCLOAK_REALM, OVERPASS_CACHE_MAX_DISTANCE_METERS, getTileZoomRange, setTileZoomRange, getTileApiKeys } = require("../lib/config");
const { keycloak, requireAllowedEditorEmail, makeInitials } = require("../lib/auth");
const { getCachedOverpassDataForPoint } = require("../lib/overpass");

function parseFiniteQueryNumber(value) {
  if (Array.isArray(value) || value === undefined || value === "") {
    return NaN;
  }

  return Number(value);
}

function parseOverpassCacheQuery(query) {
  const lat = parseFiniteQueryNumber(query.lat);
  const lon = parseFiniteQueryNumber(query.lon);
  const distanceMeters = query.d === undefined || query.d === ""
    ? OVERPASS_CACHE_MAX_DISTANCE_METERS
    : parseFiniteQueryNumber(query.d);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    !Number.isFinite(distanceMeters) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180 ||
    distanceMeters < 1 ||
    distanceMeters > OVERPASS_CACHE_MAX_DISTANCE_METERS
  ) {
    return null;
  }

  return { lat, lon, distanceMeters };
}

function parseOverpassFilters(value) {
  if (Array.isArray(value) || value === undefined || value === "") {
    return [];
  }

  const rawValue = value.toString().trim();
  const filterValue = rawValue.startsWith("[") && rawValue.endsWith("]")
    ? rawValue.slice(1, -1)
    : rawValue;

  return filterValue
    .split(",")
    .map((part) => {
      const [key, ...valueParts] = part.split(":");
      const tagKey = key?.trim();
      const tagValue = valueParts.join(":").trim();

      if (!tagKey || !tagValue) {
        return null;
      }

      return { key: tagKey, value: tagValue };
    })
    .filter(Boolean);
}

function filterOverpassData(data, filters) {
  if (!filters.length) {
    return data;
  }

  return {
    ...data,
    elements: (data.elements || []).filter((element) =>
      filters.some((filter) => element.tags?.[filter.key] === filter.value)
    ),
  };
}

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
    res.json({ tileZoomRange: getTileZoomRange() });
  });

  router.get("/api/overpass", (req, res) => {
    const parsed = parseOverpassCacheQuery(req.query);

    if (!parsed) {
      return res.status(400).json({
        error: `lat and lon query parameters are required. Optional d must be between 1 and ${OVERPASS_CACHE_MAX_DISTANCE_METERS} meters.`,
      });
    }

    const data = getCachedOverpassDataForPoint(
      parsed.lat,
      parsed.lon,
      parsed.distanceMeters
    );

    if (!data) {
      return res.status(404).json({ error: "Overpass cache not found" });
    }

    return res.json(filterOverpassData(data, parseOverpassFilters(req.query.f)));
  });

  router.put("/api/config/tile-zoom-range", requireAllowedEditorEmail, (req, res) => {
    try {
      const tileZoomRange = setTileZoomRange(req.body?.tileZoomRange);
      res.json({ ok: true, tileZoomRange });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
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
    const themeName = req.params.theme.toLowerCase();

    saveTheme(themeName, req.body);
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
