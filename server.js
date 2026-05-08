const express = require("express");
const path = require("path");
const { PORT } = require("./lib/config");
const { sessionMiddleware, keycloak } = require("./lib/auth");
const { createApiRouter } = require("./routes/api");
const { createTileRouter } = require("./routes/tiles");

const app = express();
const previewThemes = {};

app.use(sessionMiddleware);
app.set("trust proxy", true);
app.use(keycloak.middleware());
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
