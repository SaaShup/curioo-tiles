require("dotenv").config();

const express = require("express");
const path = require("node:path");
const { PORT } = require("./lib/config");
const { sessionMiddleware, keycloak } = require("./lib/auth");
const { createApiRouter } = require("./routes/api");
const { createTileRouter } = require("./routes/tiles");

const app = express();
const previewThemes = {};

app.use((req, res, next) => {
  res.setHeader("X-Powered-By", "TileServer");
  next();
});

app.use(sessionMiddleware);
app.set("trust proxy", true);
app.use(keycloak.middleware());

app.get("/healthz", (req, res) => res.json({ ok: true }));
app.get(["/editor", "/editor/"], (req, res) => {
  res.sendFile(path.join(__dirname, "public", "editor.html"));
});
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

app.use(createApiRouter(previewThemes));
app.use(createTileRouter(previewThemes));

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Tile server running on port ${PORT}`);
  });
}

module.exports = app;
