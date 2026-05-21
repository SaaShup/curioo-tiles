const fs = require("node:fs");
const path = require("node:path");
const { TILE_RUNTIME_CONFIG_DIR } = require("./config");

const DEFAULT_THEMES_FILE = path.join(__dirname, "..", "defaults", "themes.json");
const THEMES_FILE = path.join(TILE_RUNTIME_CONFIG_DIR, "themes.json");

function readThemesFile(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function mergeThemes(defaultThemes, savedThemes = {}) {
  return Object.entries(savedThemes).reduce(
    (themes, [name, savedTheme]) => {
      const baseTheme = defaultThemes[name] || defaultThemes.forest || {};
      themes[name] = {
        ...baseTheme,
        ...savedTheme,
      };
      return themes;
    },
    { ...defaultThemes }
  );
}

function loadThemes() {
  const defaultThemes = readThemesFile(DEFAULT_THEMES_FILE);

  if (!fs.existsSync(THEMES_FILE)) {
    return defaultThemes;
  }

  return mergeThemes(defaultThemes, readThemesFile(THEMES_FILE));
}

function saveThemes(themes) {
  fs.mkdirSync(path.dirname(THEMES_FILE), { recursive: true });
  fs.writeFileSync(THEMES_FILE, JSON.stringify(themes, null, 2));
}

module.exports = {
  DEFAULT_THEMES_FILE,
  THEMES_FILE,
  loadThemes,
  mergeThemes,
  saveThemes,
};
