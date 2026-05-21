const fs = require("node:fs");
const path = require("node:path");
const { TILE_RUNTIME_CONFIG_DIR } = require("./config");

const DEFAULT_THEMES_FILE = path.join(__dirname, "..", "defaults", "themes.json");
const THEMES_FILE = path.join(TILE_RUNTIME_CONFIG_DIR, "themes.json");

function readThemesFile(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readSavedThemes() {
  if (!fs.existsSync(THEMES_FILE)) {
    return {};
  }

  return readThemesFile(THEMES_FILE);
}

function colorsEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function diffTheme(baseTheme, theme) {
  return Object.entries(theme).reduce((diff, [key, value]) => {
    if (!colorsEqual(value, baseTheme[key])) {
      diff[key] = value;
    }

    return diff;
  }, {});
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
  return mergeThemes(defaultThemes, readSavedThemes());
}

function saveThemes(themes) {
  fs.mkdirSync(path.dirname(THEMES_FILE), { recursive: true });
  fs.writeFileSync(THEMES_FILE, JSON.stringify(themes, null, 2));
}

function saveTheme(themeName, theme) {
  const normalizedThemeName = themeName.toLowerCase();
  const defaultThemes = readThemesFile(DEFAULT_THEMES_FILE);
  const savedThemes = readSavedThemes();
  const baseTheme = defaultThemes[normalizedThemeName] || defaultThemes.forest || {};
  const diff = diffTheme(baseTheme, theme);

  if (Object.keys(diff).length === 0) {
    delete savedThemes[normalizedThemeName];
  } else {
    savedThemes[normalizedThemeName] = diff;
  }

  saveThemes(savedThemes);
}

module.exports = {
  DEFAULT_THEMES_FILE,
  THEMES_FILE,
  diffTheme,
  loadThemes,
  mergeThemes,
  readSavedThemes,
  saveTheme,
  saveThemes,
};
